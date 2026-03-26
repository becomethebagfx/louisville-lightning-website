import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FieldTapInput from './FieldTapInput'
import VoiceNoteButton from './VoiceNoteButton'
import type { NewObservation } from '../../lib/useScoutObservations'

interface Props {
  onSubmit: (obs: NewObservation) => Promise<boolean>
  recentTeams: string[]
}

const HIT_TYPES = [
  { value: 'ground_ball', label: 'GB', full: 'Ground Ball' },
  { value: 'fly_ball', label: 'FB', full: 'Fly Ball' },
  { value: 'pop_fly', label: 'PF', full: 'Pop Fly' },
  { value: 'line_drive', label: 'LD', full: 'Line Drive' },
] as const

const RESULTS = [
  { value: 'hit', label: 'Hit', color: 'bg-green-500/20 border-green-500/40 text-green-400' },
  { value: 'out', label: 'Out', color: 'bg-red-500/20 border-red-500/40 text-red-400' },
  { value: 'strikeout', label: 'K', color: 'bg-red-500/20 border-red-500/40 text-red-400' },
  { value: 'walk', label: 'BB', color: 'bg-blue-500/20 border-blue-500/40 text-blue-400' },
  { value: 'error', label: 'E', color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400' },
  { value: 'hbp', label: 'HBP', color: 'bg-purple-500/20 border-purple-500/40 text-purple-400' },
] as const

type HitType = typeof HIT_TYPES[number]['value']
type ResultType = typeof RESULTS[number]['value']

export default function LiveScoutInput({ onSubmit, recentTeams }: Props) {
  const [teamName, setTeamName] = useState('')
  const [playerNumber, setPlayerNumber] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [hitType, setHitType] = useState<HitType | null>(null)
  const [result, setResult] = useState<ResultType | null>(null)
  const [location, setLocation] = useState<{ x: number; y: number } | null>(null)
  const [notes, setNotes] = useState('')
  const [coachName, setCoachName] = useState(() => {
    try { return localStorage.getItem('scout-coach-name') || '' } catch { return '' }
  })
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false)

  const canSubmit = teamName.trim() && playerNumber.trim() && !saving

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setSaving(true)

    // Remember coach name for next time
    if (coachName.trim()) {
      try { localStorage.setItem('scout-coach-name', coachName.trim()) } catch {}
    }

    const obs: NewObservation = {
      team_name: teamName.trim(),
      player_number: playerNumber.trim(),
      player_name: playerName.trim() || null,
      hit_type: hitType,
      result: result,
      location_x: location?.x ?? null,
      location_y: location?.y ?? null,
      notes: notes.trim() || null,
      coach_name: coachName.trim() || null,
    }

    const ok = await onSubmit(obs)
    setSaving(false)

    if (ok) {
      // Reset form but keep team name and coach name for rapid entry
      setPlayerNumber('')
      setPlayerName('')
      setHitType(null)
      setResult(null)
      setLocation(null)
      setNotes('')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 1500)
    }
  }, [canSubmit, teamName, playerNumber, playerName, hitType, result, location, notes, coachName, onSubmit])

  const handleVoiceTranscript = useCallback((text: string) => {
    setNotes(prev => prev ? `${prev} ${text}` : text)
  }, [])

  // Filter suggestions
  const suggestions = recentTeams.filter(t =>
    t.toLowerCase().includes(teamName.toLowerCase()) && t.toLowerCase() !== teamName.toLowerCase()
  )

  return (
    <div className="space-y-4">
      {/* Team Name */}
      <div className="relative">
        <label className="block text-xs font-accent uppercase tracking-wider text-white/40 mb-1.5">
          Team <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={teamName}
          onChange={e => { setTeamName(e.target.value); setShowTeamSuggestions(true) }}
          onFocus={() => setShowTeamSuggestions(true)}
          onBlur={() => setTimeout(() => setShowTeamSuggestions(false), 200)}
          placeholder="e.g. Bullitt Bats"
          className="w-full px-4 py-3 rounded-xl bg-navy-700 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-gold-500/40 text-sm"
        />
        {/* Team suggestions dropdown */}
        {showTeamSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-navy-700 border border-white/10 rounded-xl overflow-hidden shadow-xl">
            {suggestions.map(t => (
              <button
                key={t}
                onMouseDown={() => { setTeamName(t); setShowTeamSuggestions(false) }}
                className="w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Player Number + Name (side by side) */}
      <div className="grid grid-cols-[100px_1fr] gap-3">
        <div>
          <label className="block text-xs font-accent uppercase tracking-wider text-white/40 mb-1.5">
            # <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={playerNumber}
            onChange={e => setPlayerNumber(e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="24"
            className="w-full px-4 py-3 rounded-xl bg-navy-700 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-gold-500/40 text-sm text-center text-2xl font-black font-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-accent uppercase tracking-wider text-white/40 mb-1.5">
            Name <span className="text-white/20">(optional)</span>
          </label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Last name"
            className="w-full px-4 py-3 rounded-xl bg-navy-700 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-gold-500/40 text-sm"
          />
        </div>
      </div>

      {/* Field Tap */}
      <div className="bg-navy-800 rounded-2xl p-4 border border-white/5">
        <FieldTapInput
          value={location}
          onChange={setLocation}
          hitType={hitType}
        />
      </div>

      {/* Hit Type */}
      <div>
        <label className="block text-xs font-accent uppercase tracking-wider text-white/40 mb-2">
          Hit Type
        </label>
        <div className="grid grid-cols-4 gap-2">
          {HIT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setHitType(hitType === t.value ? null : t.value)}
              className={`py-2.5 rounded-xl border text-center transition-all text-sm font-accent ${
                hitType === t.value
                  ? 'bg-gold-500/20 border-gold-500/40 text-gold-500'
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
              }`}
            >
              <div className="text-lg font-bold">{t.label}</div>
              <div className="text-[9px] opacity-60 mt-0.5">{t.full}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      <div>
        <label className="block text-xs font-accent uppercase tracking-wider text-white/40 mb-2">
          Result
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {RESULTS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setResult(result === r.value ? null : r.value)}
              className={`py-2 rounded-xl border text-center transition-all text-sm font-bold font-accent ${
                result === r.value ? r.color : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes with voice input */}
      <div>
        <label className="block text-xs font-accent uppercase tracking-wider text-white/40 mb-1.5">
          Notes
        </label>
        <div className="flex gap-2">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Quick notes... e.g. 'Always pulls to left', 'Weak against low pitches'"
            rows={2}
            className="flex-1 px-4 py-3 rounded-xl bg-navy-700 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-gold-500/40 text-sm resize-none"
          />
          <VoiceNoteButton onTranscript={handleVoiceTranscript} />
        </div>
      </div>

      {/* Coach Name */}
      <div>
        <label className="block text-xs font-accent uppercase tracking-wider text-white/40 mb-1.5">
          Your Name <span className="text-white/20">(optional)</span>
        </label>
        <input
          type="text"
          value={coachName}
          onChange={e => setCoachName(e.target.value)}
          placeholder="Coach name"
          className="w-full px-4 py-3 rounded-xl bg-navy-700 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-gold-500/40 text-sm"
        />
      </div>

      {/* Submit */}
      <div className="relative">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-4 rounded-xl font-accent uppercase tracking-wider text-sm font-bold transition-all ${
            canSubmit
              ? 'bg-gold-500 text-navy-900 hover:bg-gold-400 active:scale-[0.98]'
              : 'bg-white/5 text-white/20 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          ) : (
            'Log Observation'
          )}
        </button>

        {/* Success flash */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center bg-green-500 rounded-xl"
            >
              <span className="text-white font-accent font-bold tracking-wider flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                SAVED
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
