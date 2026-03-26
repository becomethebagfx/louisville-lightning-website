import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FieldTapInput from './FieldTapInput'
import VoiceNoteButton from './VoiceNoteButton'
import type { ScoutedTeam, ScoutedPlayer, ScoutObservation, NewObservation } from '../../lib/useScoutObservations'

/* ─── Constants ─── */
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

/* ─── Mini spray chart ─── */
function MiniSprayChart({ observations }: { observations: ScoutObservation[] }) {
  const w = 200, h = 220
  const home = { x: 100, y: 195 }
  const first = { x: 148, y: 143 }
  const second = { x: 100, y: 100 }
  const third = { x: 52, y: 143 }
  const arcR = 170

  function toSvg(x: number, y: number) {
    return { x: 7 + (x / 100) * (w - 14), y: 7 + (y / 100) * (h - 28) }
  }

  const withLoc = observations.filter(o => o.location_x != null && o.location_y != null)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[200px] mx-auto">
      <path
        d={`M ${home.x} ${home.y} L ${third.x - 40} ${third.y - 55} A ${arcR} ${arcR} 0 0 1 ${first.x + 40} ${first.y - 55} Z`}
        fill="rgba(34,120,60,0.15)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"
      />
      <polygon
        points={`${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`}
        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"
      />
      {withLoc.map((o, i) => {
        const pt = toSvg(o.location_x!, o.location_y!)
        const color = o.result === 'hit' ? '#22c55e' : o.result === 'strikeout' || o.result === 'out' ? '#ef4444' : '#f5b800'
        return (
          <g key={o.id}>
            <line x1={home.x} y1={home.y} x2={pt.x} y2={pt.y} stroke={color} strokeWidth="1" opacity="0.4" />
            <circle cx={pt.x} cy={pt.y} r={8} fill={color} opacity="0.85" />
            <text x={pt.x} y={pt.y + 3.5} textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">{i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}

/* ─── Helpers ─── */
function hitTypeLabel(t: string | null) {
  if (!t) return null
  const map: Record<string, string> = { ground_ball: 'GB', fly_ball: 'FB', pop_fly: 'PF', line_drive: 'LD' }
  return map[t] || t
}

function ResultBadge({ result }: { result: string | null }) {
  if (!result) return null
  const styles: Record<string, string> = {
    hit: 'bg-green-500/20 text-green-400', out: 'bg-red-500/20 text-red-400',
    strikeout: 'bg-red-500/20 text-red-400', walk: 'bg-blue-500/20 text-blue-400',
    error: 'bg-yellow-500/20 text-yellow-400', hbp: 'bg-purple-500/20 text-purple-400',
  }
  const labels: Record<string, string> = { hit: 'Hit', out: 'Out', strikeout: 'K', walk: 'BB', error: 'E', hbp: 'HBP' }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles[result] || 'bg-white/10 text-white/50'}`}>
      {labels[result] || result}
    </span>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* ─── Edit Observation Modal ─── */
function EditObsModal({
  obs,
  onSave,
  onClose,
}: {
  obs: ScoutObservation
  onSave: (id: string, updates: Partial<NewObservation>) => Promise<boolean>
  onClose: () => void
}) {
  const [hitType, setHitType] = useState(obs.hit_type)
  const [result, setResult] = useState(obs.result)
  const [location, setLocation] = useState<{ x: number; y: number } | null>(
    obs.location_x != null ? { x: obs.location_x, y: obs.location_y! } : null
  )
  const [notes, setNotes] = useState(obs.notes || '')
  const [playerName, setPlayerName] = useState(obs.player_name || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const ok = await onSave(obs.id, {
      hit_type: hitType,
      result: result,
      location_x: location?.x ?? null,
      location_y: location?.y ?? null,
      notes: notes.trim() || null,
      player_name: playerName.trim() || null,
    })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto pt-6 pb-6 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className="bg-navy-800 border border-gold-500/20 rounded-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div>
            <h3 className="text-white font-accent uppercase tracking-wider text-sm font-bold">
              Edit #{obs.player_number}
            </h3>
            <p className="text-white/30 text-xs">{obs.team_name}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Player name */}
          <div>
            <label className="block text-xs font-accent uppercase tracking-wider text-white/40 mb-1.5">Name</label>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="Last name"
              className="w-full px-3 py-2 rounded-lg bg-navy-700 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-gold-500/40 text-sm"
            />
          </div>

          {/* Field */}
          <div className="bg-navy-900/50 rounded-xl p-3 border border-white/5">
            <FieldTapInput value={location} onChange={setLocation} hitType={hitType} />
          </div>

          {/* Hit type */}
          <div className="grid grid-cols-4 gap-1.5">
            {HIT_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setHitType(hitType === t.value ? null : t.value)}
                className={`py-2 rounded-lg border text-center text-xs font-accent ${
                  hitType === t.value ? 'bg-gold-500/20 border-gold-500/40 text-gold-500' : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Result */}
          <div className="grid grid-cols-3 gap-1.5">
            {RESULTS.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setResult(result === r.value ? null : r.value)}
                className={`py-1.5 rounded-lg border text-center text-xs font-bold font-accent ${
                  result === r.value ? r.color : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Notes */}
          <div className="flex gap-2">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes..."
              rows={2}
              className="flex-1 px-3 py-2 rounded-lg bg-navy-700 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-gold-500/40 text-sm resize-none"
            />
            <VoiceNoteButton onTranscript={text => setNotes(prev => prev ? `${prev} ${text}` : text)} />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-gold-500 text-navy-900 font-accent uppercase tracking-wider text-sm font-bold hover:bg-gold-400 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Single observation row with edit/delete ─── */
function ObservationRow({
  obs,
  index,
  onEdit,
  onDelete,
}: {
  obs: ScoutObservation
  index: number
  onEdit: (obs: ScoutObservation) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex items-start gap-2 text-sm border-t border-white/5 pt-2">
      <span className="text-white/20 text-xs mt-0.5 shrink-0">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {obs.hit_type && (
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/50 text-xs font-accent">
              {hitTypeLabel(obs.hit_type)}
            </span>
          )}
          <ResultBadge result={obs.result} />
        </div>
        {obs.notes && <p className="text-white/50 text-xs mt-1 italic">{obs.notes}</p>}
        <div className="flex gap-2 mt-1 text-[10px] text-white/20">
          <span>{timeAgo(obs.created_at)}</span>
          {obs.coach_name && <span>by {obs.coach_name}</span>}
        </div>
      </div>
      {/* Edit / Delete buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(obs)}
          className="p-1.5 rounded-lg text-white/20 hover:text-gold-500 hover:bg-gold-500/10 transition-colors"
          title="Edit"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(obs.id); setConfirmDelete(false) }}
              className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 rounded-lg bg-white/5 text-white/40 text-[10px]"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Player card within a team ─── */
function PlayerObsCard({
  player,
  onEdit,
  onDelete,
}: {
  player: ScoutedPlayer
  onEdit: (obs: ScoutObservation) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasLocations = player.observations.some(o => o.location_x != null)
  const hitCount = player.observations.filter(o => o.result === 'hit').length
  const outCount = player.observations.filter(o => o.result === 'out' || o.result === 'strikeout').length
  const walkCount = player.observations.filter(o => o.result === 'walk').length
  const total = player.observations.length

  return (
    <div className="bg-navy-800 border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left active:bg-white/5 transition-colors"
      >
        <div className="w-12 h-12 rounded-lg bg-navy-700 border border-gold-500/20 flex items-center justify-center shrink-0">
          <span className="text-xl font-black text-gold-500 font-accent">{player.playerNumber}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {player.playerName && (
              <span className="text-white text-sm font-semibold truncate">{player.playerName}</span>
            )}
            <span className="text-white/30 text-xs">{total} AB</span>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
            {hitCount > 0 && <span className="text-green-400 text-xs">{hitCount} H</span>}
            {outCount > 0 && <span className="text-red-400 text-xs">{outCount} O</span>}
            {walkCount > 0 && <span className="text-blue-400 text-xs">{walkCount} BB</span>}
            {total > 0 && hitCount > 0 && (
              <span className="text-gold-500 text-xs font-bold">
                .{Math.round((hitCount / total) * 1000).toString().padStart(3, '0')}
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-white/20 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {hasLocations && (
                <div className="pt-2">
                  <MiniSprayChart observations={player.observations} />
                </div>
              )}
              {player.observations.map((obs, i) => (
                <ObservationRow
                  key={obs.id}
                  obs={obs}
                  index={i}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Main live scout view ─── */
interface Props {
  teams: ScoutedTeam[]
  onUpdate: (id: string, updates: Partial<NewObservation>) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}

export default function LiveScoutView({ teams, onUpdate, onDelete }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [editingObs, setEditingObs] = useState<ScoutObservation | null>(null)

  const activeTeam = teams.find(t => t.teamName === selectedTeam)

  if (teams.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <svg className="w-12 h-12 mx-auto text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-white/30 text-sm">No live observations yet</p>
        <p className="text-white/15 text-xs">Tap "Add" above to start scouting</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Team list or team detail */}
      {!activeTeam ? (
        <>
          <p className="text-white/40 text-xs font-accent uppercase tracking-wider text-center mb-2">
            Select a team
          </p>
          {teams.map((team, i) => {
            const hitCount = team.players.reduce((s, p) => s + p.observations.filter(o => o.result === 'hit').length, 0)
            const totalAB = team.totalObservations
            return (
              <motion.button
                key={team.teamName}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedTeam(team.teamName)}
                className="w-full p-4 bg-navy-800/50 border border-white/5 rounded-xl text-left hover:bg-navy-800 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-accent uppercase tracking-wider text-sm font-bold">
                      {team.teamName}
                    </h3>
                    <p className="text-white/30 text-xs mt-0.5">
                      {team.players.length} players / {team.totalObservations} obs / {timeAgo(team.lastScouted)}
                    </p>
                  </div>
                  <div className="text-right">
                    {totalAB > 0 && hitCount > 0 && (
                      <p className="text-lg font-black font-accent text-gold-500">
                        .{Math.round((hitCount / totalAB) * 1000).toString().padStart(3, '0')}
                      </p>
                    )}
                    <div className="flex gap-2 text-xs">
                      {hitCount > 0 && <span className="text-green-400">{hitCount} H</span>}
                      <span className="text-white/30">{totalAB} AB</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </>
      ) : (
        <>
          {/* Back button + team header */}
          <button
            onClick={() => setSelectedTeam(null)}
            className="flex items-center gap-2 text-white/40 hover:text-white text-xs font-accent uppercase tracking-wider mb-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Teams
          </button>

          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-accent uppercase tracking-wider text-white font-bold">
                {activeTeam.teamName}
              </h3>
              <p className="text-white/30 text-xs">
                {activeTeam.players.length} players / {activeTeam.totalObservations} observations
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {activeTeam.players.map(player => (
              <PlayerObsCard
                key={player.playerNumber}
                player={player}
                onEdit={setEditingObs}
                onDelete={onDelete}
              />
            ))}
          </div>
        </>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editingObs && (
          <EditObsModal
            obs={editingObs}
            onSave={onUpdate}
            onClose={() => setEditingObs(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
