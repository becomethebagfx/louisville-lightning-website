import { useState, useRef, useCallback } from 'react'
import { getAudioSync, getAudio } from './db'

// Fully synchronous play path — no async/await between user tap and
// audio.play(). Safari/iOS requires play() to happen synchronously
// within a user gesture. Blobs are preloaded into memory (see db.ts)
// so we can grab them without any async gap.

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

  // NOT async — everything between tap and play() is synchronous
  const play = useCallback((playerId: string, startTime?: number, clipDuration?: number) => {
    const requestId = ++requestRef.current
    cleanup()

    // Grab blob synchronously from preloaded memory cache
    let blob = getAudioSync(playerId)

    if (!blob) {
      // Not preloaded yet — fetch async and retry via a second click.
      // This only happens on very first visit before preload completes.
      getAudio(playerId).then(() => {
        // Blob is now cached for next tap
      })
      return
    }

    const url = URL.createObjectURL(blob)
    urlRef.current = url

    // Append to DOM — Safari handles in-DOM audio elements more reliably
    const audio = document.createElement('audio')
    audio.src = url
    audio.style.display = 'none'
    document.body.appendChild(audio)
    audioRef.current = audio

    // Handle seeking AFTER metadata loads (don't block play)
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

    // play() is called synchronously within the user gesture — no awaits above
    setPlayingId(playerId)
    audio.play().catch(() => {
      cleanup()
      setPlayingId(null)
    })
  }, [cleanup])

  return { playingId, play, stop }
}
