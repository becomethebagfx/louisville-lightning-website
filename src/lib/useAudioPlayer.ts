import { useState, useRef, useCallback } from 'react'
import { getAudioSync, getAudio } from './db'

// Uses HTML Audio elements (not AudioContext) so playback ignores the iOS
// ringer/silent switch. Audio blobs are preloaded into memory on page mount
// (see preloadAllAudio in db.ts) so the blob lookup is synchronous — this
// preserves the user gesture chain that Safari requires for audio.play().

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
      audioRef.current.currentTime = 0
      audioRef.current.onended = null
      audioRef.current.onloadedmetadata = null
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

  const play = useCallback(async (playerId: string, startTime?: number, clipDuration?: number) => {
    const requestId = ++requestRef.current
    cleanup()

    // Try sync from preloaded memory cache (preserves gesture chain)
    let blob = getAudioSync(playerId)

    if (blob) {
      // Fast path: blob in memory, everything stays synchronous in the gesture
      const url = URL.createObjectURL(blob)
      urlRef.current = url

      const audio = new Audio()
      audioRef.current = audio
      audio.src = url

      audio.onended = () => {
        if (requestRef.current === requestId) {
          cleanup()
          setPlayingId(null)
        }
      }

      // Wait for metadata so seeking works reliably
      if (typeof startTime === 'number' && startTime > 0) {
        await new Promise<void>((resolve) => {
          audio.onloadedmetadata = () => resolve()
          setTimeout(resolve, 2000)
        })
        if (requestRef.current !== requestId) return
        audio.currentTime = startTime
      }

      if (clipDuration && clipDuration > 0 && clipDuration <= 600) {
        timerRef.current = setTimeout(() => {
          if (requestRef.current === requestId) {
            cleanup()
            setPlayingId(null)
          }
        }, clipDuration * 1000)
      }

      try {
        setPlayingId(playerId)
        await audio.play()
      } catch {
        cleanup()
        setPlayingId(null)
      }
    } else {
      // Slow path: blob not preloaded yet, fetch async (may fail on Safari
      // first visit, but will work on retry since it gets cached)
      setPlayingId(playerId)

      blob = await getAudio(playerId)
      if (!blob || requestRef.current !== requestId) {
        if (requestRef.current === requestId) setPlayingId(null)
        return
      }

      const url = URL.createObjectURL(blob)
      urlRef.current = url

      const audio = new Audio()
      audioRef.current = audio
      audio.src = url

      audio.onended = () => {
        if (requestRef.current === requestId) {
          cleanup()
          setPlayingId(null)
        }
      }

      if (typeof startTime === 'number' && startTime > 0) {
        await new Promise<void>((resolve) => {
          audio.onloadedmetadata = () => resolve()
          setTimeout(resolve, 2000)
        })
        if (requestRef.current !== requestId) return
        audio.currentTime = startTime
      }

      if (clipDuration && clipDuration > 0 && clipDuration <= 600) {
        timerRef.current = setTimeout(() => {
          if (requestRef.current === requestId) {
            cleanup()
            setPlayingId(null)
          }
        }, clipDuration * 1000)
      }

      try {
        await audio.play()
      } catch {
        cleanup()
        setPlayingId(null)
      }
    }
  }, [cleanup])

  return { playingId, play, stop }
}
