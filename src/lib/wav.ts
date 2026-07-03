// Re-encode decoded audio to mono 16-bit PCM WAV. Used for coach-recorded
// intros: MediaRecorder produces webm/opus on Chrome, which iOS Safari
// cannot play. WAV plays everywhere and a ~5s intro is only ~200KB.

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const rate = buffer.sampleRate
  const len = buffer.length

  // Downmix to mono
  const mono = new Float32Array(len)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < len; i++) mono[i] += data[i] / buffer.numberOfChannels
  }

  const bytesPerSample = 2
  const dataSize = len * bytesPerSample
  const out = new ArrayBuffer(44 + dataSize)
  const view = new DataView(out)

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * bytesPerSample, true) // byte rate
  view.setUint16(32, bytesPerSample, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([out], { type: 'audio/wav' })
}
