import { useState, useRef, useCallback } from 'react'
import { getAudio } from './db'

// Tiny silent WAV (44 bytes) used to unlock audio playback on Safari/iOS
// Safari requires audio.play() to be called synchronously within a user gesture.
// Without this, the async getAudio() call breaks the gesture chain and Safari
// silently refuses to play.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

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

    // Play a silent WAV immediately within the user gesture to unlock the
    // audio element on Safari/iOS. This must happen synchronously before
    // any await, otherwise Safari drops the gesture context.
    const audio = new Audio(SILENT_WAV)
    audioRef.current = audio
    try { await audio.play() } catch { /* silent unlock may fail on non-Safari, that's fine */ }

    const blob = await getAudio(playerId)
    if (!blob || requestRef.current !== requestId) return

    const url = URL.createObjectURL(blob)
    urlRef.current = url
    audio.pause()
    audio.src = url

    if (typeof startTime === 'number' && startTime >= 0) {
      audio.currentTime = startTime
    }

    audio.onended = () => {
      cleanup()
      setPlayingId(null)
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
  }, [cleanup])

  return { playingId, play, stop }
}
