import { useState, useRef, useCallback } from 'react'
import {
  getAudioSync,
  getAudio,
  getAnnouncementSync,
  getAnnouncement,
} from './db'

// Audio playback with Safari/iOS compatibility.
// Blobs are preloaded into memory on page mount (see db.ts). When available,
// play() grabs the blob synchronously and calls audio.play() within the same
// user gesture - required by Safari. Falls back to async fetch if preload
// hasn't finished (works on Chrome, may need a second tap on Safari).
//
// Player intros: when an announcement blob exists for a player, play() runs
// intro-then-song on ONE reused <audio> element. iOS treats an element that
// started inside a user gesture as unlocked, so swapping src at `ended` and
// calling play() again keeps working without a second tap.

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isIntroSequence, setIsIntroSequence] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const requestRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onloadedmetadata = null
      audioRef.current.remove()
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    requestRef.current++
    cleanup()
    setPlayingId(null)
    setIsIntroSequence(false)
  }, [cleanup])

  const makeElement = useCallback((blob: Blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(blob)
    urlRef.current = url
    const audio = document.createElement('audio')
    audio.src = url
    audio.preload = 'auto'
    audio.style.display = 'none'
    document.body.appendChild(audio)
    audioRef.current = audio
    return audio
  }, [])

  const swapSource = useCallback((audio: HTMLAudioElement, blob: Blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(blob)
    urlRef.current = url
    audio.src = url
    return audio
  }, [])

  const startSongOn = useCallback((
    audio: HTMLAudioElement,
    playerId: string,
    requestId: number,
    startTime?: number,
    clipDuration?: number,
  ) => {
    if (typeof startTime === 'number' && startTime > 0) {
      audio.onloadedmetadata = () => {
        audio.currentTime = startTime
      }
    } else {
      audio.onloadedmetadata = null
    }

    audio.onended = () => {
      if (requestRef.current === requestId) {
        cleanup()
        setPlayingId(null)
      }
    }

    if (clipDuration && clipDuration > 0 && clipDuration <= 600) {
      timerRef.current = setTimeout(() => {
        if (requestRef.current === requestId) {
          cleanup()
          setPlayingId(null)
        }
      }, clipDuration * 1000)
    }

    setPlayingId(playerId)
    audio.play().catch(() => {
      cleanup()
      setPlayingId(null)
    })
  }, [cleanup])

  const startPlayback = useCallback((
    blob: Blob,
    playerId: string,
    requestId: number,
    startTime?: number,
    clipDuration?: number,
  ) => {
    const audio = makeElement(blob)
    startSongOn(audio, playerId, requestId, startTime, clipDuration)
  }, [makeElement, startSongOn])

  // Intro announcement first, then the walk-up song on the same element.
  const startIntroThenSong = useCallback((
    intro: Blob,
    song: Blob | null,
    playerId: string,
    requestId: number,
    startTime?: number,
    clipDuration?: number,
  ) => {
    const audio = makeElement(intro)

    audio.onended = () => {
      if (requestRef.current !== requestId) return
      if (song) {
        swapSource(audio, song)
        startSongOn(audio, playerId, requestId, startTime, clipDuration)
      } else {
        cleanup()
        setPlayingId(null)
      }
    }

    setPlayingId(playerId)
    audio.play().catch(() => {
      cleanup()
      setPlayingId(null)
    })
  }, [makeElement, swapSource, startSongOn, cleanup])

  // NOT async - synchronous path for Safari gesture compatibility
  const play = useCallback((playerId: string, startTime?: number, clipDuration?: number) => {
    const requestId = ++requestRef.current
    cleanup()
    setIsIntroSequence(false)

    // Try sync from preloaded memory cache (preserves gesture chain for Safari)
    const intro = getAnnouncementSync(playerId)
    const song = getAudioSync(playerId)

    if (intro) {
      startIntroThenSong(intro, song ?? null, playerId, requestId, startTime, clipDuration)
    } else if (song) {
      startPlayback(song, playerId, requestId, startTime, clipDuration)
    } else {
      // Async fallback - fetch blobs then play.
      // Works on Chrome always. On Safari, may not play on first tap
      // (gesture expired), but blobs get cached for next tap.
      setPlayingId(playerId)
      Promise.all([getAnnouncement(playerId), getAudio(playerId)]).then(([iBlob, sBlob]) => {
        if (requestRef.current !== requestId) return
        if (iBlob) {
          startIntroThenSong(iBlob, sBlob ?? null, playerId, requestId, startTime, clipDuration)
        } else if (sBlob) {
          startPlayback(sBlob, playerId, requestId, startTime, clipDuration)
        } else {
          setPlayingId(null)
        }
      })
    }
  }, [cleanup, startPlayback, startIntroThenSong])

  // Pregame mode: play every player's intro back to back in lineup order,
  // reusing one element (iOS-safe), with a short beat between players.
  const playIntros = useCallback((playerIds: string[]) => {
    const requestId = ++requestRef.current
    cleanup()

    const queue = playerIds.filter(id => getAnnouncementSync(id))
    if (queue.length === 0) return

    let index = 0
    const audio = makeElement(getAnnouncementSync(queue[0])!)

    const finish = () => {
      if (requestRef.current !== requestId) return
      cleanup()
      setPlayingId(null)
      setIsIntroSequence(false)
    }

    const playCurrent = () => {
      if (requestRef.current !== requestId) return
      if (index >= queue.length) {
        finish()
        return
      }
      const id = queue[index]
      const blob = getAnnouncementSync(id)
      if (!blob) {
        // Intro was removed mid-sequence - skip this player
        index++
        playCurrent()
        return
      }
      if (index > 0) swapSource(audio, blob)
      setPlayingId(id)
      audio.play().catch(() => {
        // Skip a bad intro instead of killing the whole pregame sequence
        if (requestRef.current !== requestId) return
        index++
        playCurrent()
      })
    }

    audio.onended = () => {
      if (requestRef.current !== requestId) return
      index++
      if (index >= queue.length) {
        finish()
        return
      }
      timerRef.current = setTimeout(playCurrent, 800)
    }

    setIsIntroSequence(true)
    playCurrent()
  }, [cleanup, makeElement, swapSource])

  return { playingId, isIntroSequence, play, stop, playIntros }
}
