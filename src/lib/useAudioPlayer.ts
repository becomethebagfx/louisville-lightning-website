import { useState, useRef, useCallback } from 'react'
import { getAudio } from './db'

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

    // Create a silent audio element immediately in the user gesture to satisfy iOS
    const audio = new Audio()
    audioRef.current = audio

    const blob = await getAudio(playerId)
    if (!blob || requestRef.current !== requestId) return

    const url = URL.createObjectURL(blob)
    urlRef.current = url
    audio.src = url

    if (startTime && startTime > 0) {
      audio.currentTime = startTime
    }

    audio.onended = () => {
      cleanup()
      setPlayingId(null)
    }

    if (clipDuration && clipDuration > 0) {
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
