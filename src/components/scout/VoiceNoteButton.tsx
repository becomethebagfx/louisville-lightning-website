import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  onTranscript: (text: string) => void
}

// Check for browser support
const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    : null

/** Voice-to-text button using Web Speech API */
export default function VoiceNoteButton({ onTranscript }: Props) {
  const [isListening, setIsListening] = useState(false)
  const [interim, setInterim] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const toggle = useCallback(() => {
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Try Chrome or Safari.')
      return
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      setInterim('')
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }
      setInterim(interimText)
      if (finalText) {
        onTranscript(finalText)
        setInterim('')
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      setInterim('')
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Check your browser permissions.')
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterim('')
    }

    recognition.start()
    setIsListening(true)
  }, [isListening, onTranscript])

  if (!SpeechRecognition) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className={`p-2.5 rounded-xl border transition-all ${
          isListening
            ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
            : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
        }`}
        title={isListening ? 'Stop recording' : 'Voice note'}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isListening ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          )}
        </svg>
      </button>
      {interim && (
        <div className="absolute bottom-full left-0 right-0 mb-2 px-3 py-1.5 bg-navy-700 border border-white/10 rounded-lg text-xs text-white/50 italic whitespace-nowrap overflow-hidden text-ellipsis">
          {interim}...
        </div>
      )}
    </div>
  )
}

