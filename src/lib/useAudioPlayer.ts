import { useState, useRef, useCallback } from 'react'
import { getAudioSync, getAudio } from './db'

// Audio playback with Safari/iOS compatibility.
// Blobs are preloaded into memory on page mount (see db.ts). When available,
// play() grabs the blob synchronously and calls audio.play() within the same
// user gesture — required by Safari. Falls back to async fetch if preload
// hasn't finished (works on Chrome, may need a second tap on Safari).

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null)
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
  }, [cleanup])

  const startPlayback = useCallback((
    blob: Blob,
    playerId: string,
    requestId: number,
    startTime?: number,
    clipDuration?: number,
  ) => {
    const url = URL.createObjectURL(blob)
    urlRef.current = url

    const audio = document.createElement('audio')
    audio.src = url
    audio.preload = 'auto'
    audio.style.display = 'none'
    document.body.appendChild(audio)
    audioRef.current = audio

    if (typeof startTime === 'number' && startTime > 0) {
      audio.onloadedmetadata = () => {
        audio.currentTime = startTime
      }
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

  // NOT async — synchronous path for Safari gesture compatibility
  const play = useCallback((playerId: string, startTime?: number, clipDuration?: number) => {
    const requestId = ++requestRef.current
    cleanup()

    // Try sync from preloaded memory cache (preserves gesture chain for Safari)
    const blob = getAudioSync(playerId)

    if (blob) {
      startPlayback(blob, playerId, requestId, startTime, clipDuration)
    } else {
      // Async fallback — fetch blob then play.
      // Works on Chrome always. On Safari, may not play on first tap
      // (gesture expired), but blob gets cached for next tap.
      setPlayingId(playerId)
      getAudio(playerId).then(fetchedBlob => {
        if (!fetchedBlob || requestRef.current !== requestId) {
          if (requestRef.current === requestId) setPlayingId(null)
          return
        }
        startPlayback(fetchedBlob, playerId, requestId, startTime, clipDuration)
      })
    }
  }, [cleanup, startPlayback])

  return { playingId, play, stop }
}
