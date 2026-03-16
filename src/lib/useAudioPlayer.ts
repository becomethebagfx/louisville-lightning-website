import { useState, useRef, useCallback } from 'react'
import { getAudio } from './db'

// Use Web Audio API instead of HTML Audio elements.
// AudioContext.resume() called synchronously in a user gesture permanently
// unlocks the context — subsequent plays work even after async operations.
// HTML Audio elements lose their gesture unlock when src changes, which
// causes inconsistent playback failures on Safari/iOS.

let sharedCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext()
  return sharedCtx
}

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const requestRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch { /* already stopped */ }
      sourceRef.current.disconnect()
      sourceRef.current = null
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

    const ctx = getCtx()
    // Unlock AudioContext in user gesture — this is synchronous and the
    // "running" state persists across awaits, unlike HTML Audio elements.
    if (ctx.state === 'suspended') ctx.resume()

    setPlayingId(playerId)

    const blob = await getAudio(playerId)
    if (!blob || requestRef.current !== requestId) {
      if (requestRef.current === requestId) setPlayingId(null)
      return
    }

    let audioBuffer: AudioBuffer
    try {
      const arrayBuffer = await blob.arrayBuffer()
      if (requestRef.current !== requestId) return
      audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      if (requestRef.current !== requestId) return
    } catch {
      setPlayingId(null)
      return
    }

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    sourceRef.current = source

    const offset = (typeof startTime === 'number' && startTime >= 0) ? startTime : 0
    const duration = (clipDuration && clipDuration > 0 && clipDuration <= 600) ? clipDuration : undefined

    source.onended = () => {
      if (requestRef.current === requestId) {
        cleanup()
        setPlayingId(null)
      }
    }

    if (duration) {
      source.start(0, offset, duration)
      // Safety timer in case onended doesn't fire (e.g. page backgrounded)
      timerRef.current = setTimeout(() => {
        if (requestRef.current === requestId) {
          cleanup()
          setPlayingId(null)
        }
      }, duration * 1000 + 500)
    } else {
      source.start(0, offset)
    }
  }, [cleanup])

  return { playingId, play, stop }
}
