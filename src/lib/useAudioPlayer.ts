import { useState, useRef, useCallback } from 'react'
import { getAudio } from './db'

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const requestRef = useRef(0)

  const stop = useCallback(() => {
    requestRef.current++
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setPlayingId(null)
  }, [])

  const play = useCallback(async (playerId: string) => {
    const requestId = ++requestRef.current

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }

    const blob = await getAudio(playerId)
    if (!blob || requestRef.current !== requestId) return

    const url = URL.createObjectURL(blob)
    urlRef.current = url

    const audio = new Audio(url)
    audioRef.current = audio

    audio.onended = () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
      setPlayingId(null)
    }

    try {
      setPlayingId(playerId)
      await audio.play()
    } catch {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
      audioRef.current = null
      setPlayingId(null)
    }
  }, [])

  return { playingId, play, stop }
}
