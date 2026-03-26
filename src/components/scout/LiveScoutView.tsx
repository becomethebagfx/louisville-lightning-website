import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ScoutedTeam, ScoutedPlayer, ScoutObservation } from '../../lib/useScoutObservations'

/* ─── Mini spray chart for observations ─── */
function MiniSprayChart({ observations }: { observations: ScoutObservation[] }) {
  const w = 200, h = 220
  const home = { x: 100, y: 195 }
  const first = { x: 148, y: 143 }
  const second = { x: 100, y: 100 }
  const third = { x: 52, y: 143 }
  const arcR = 170

  function toSvg(x: number, y: number) {
    return {
      x: 7 + (x / 100) * (w - 14),
      y: 7 + (y / 100) * (h - 28),
    }
  }

  const withLoc = observations.filter(o => o.location_x != null && o.location_y != null)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[200px] mx-auto">
      <path
        d={`M ${home.x} ${home.y} L ${third.x - 40} ${third.y - 55} A ${arcR} ${arcR} 0 0 1 ${first.x + 40} ${first.y - 55} Z`}
        fill="rgba(34,120,60,0.15)"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
      />
      <polygon
        points={`${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="0.8"
      />
      {withLoc.map((o, i) => {
        const pt = toSvg(o.location_x!, o.location_y!)
        const color = o.result === 'hit' ? '#22c55e'
          : o.result === 'strikeout' || o.result === 'out' ? '#ef4444'
          : '#f5b800'
        return (
          <g key={o.id}>
            <line x1={home.x} y1={home.y} x2={pt.x} y2={pt.y} stroke={color} strokeWidth="1" opacity="0.4" />
            <circle cx={pt.x} cy={pt.y} r={8} fill={color} opacity="0.85" />
            <text x={pt.x} y={pt.y + 3.5} textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">
              {i + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ─── Hit type label ─── */
function hitTypeLabel(t: string | null) {
  if (!t) return null
  const map: Record<string, string> = {
    ground_ball: 'GB', fly_ball: 'FB', pop_fly: 'PF', line_drive: 'LD',
  }
  return map[t] || t
}

/* ─── Result badge ─── */
function ResultBadge({ result }: { result: string | null }) {
  if (!result) return null
  const styles: Record<string, string> = {
    hit: 'bg-green-500/20 text-green-400',
    out: 'bg-red-500/20 text-red-400',
    strikeout: 'bg-red-500/20 text-red-400',
    walk: 'bg-blue-500/20 text-blue-400',
    error: 'bg-yellow-500/20 text-yellow-400',
    hbp: 'bg-purple-500/20 text-purple-400',
  }
  const labels: Record<string, string> = {
    hit: 'Hit', out: 'Out', strikeout: 'K', walk: 'BB', error: 'E', hbp: 'HBP',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles[result] || 'bg-white/10 text-white/50'}`}>
      {labels[result] || result}
    </span>
  )
}

/* ─── Time ago helper ─── */
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

/* ─── Player observations card ─── */
function PlayerObsCard({ player }: { player: ScoutedPlayer }) {
  const [expanded, setExpanded] = useState(false)
  const hasLocations = player.observations.some(o => o.location_x != null)
  const hitCount = player.observations.filter(o => o.result === 'hit').length
  const outCount = player.observations.filter(o => o.result === 'out' || o.result === 'strikeout').length

  return (
    <div className="bg-navy-800 border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left active:bg-white/5 transition-colors"
      >
        {/* Big number */}
        <div className="w-12 h-12 rounded-lg bg-navy-700 border border-gold-500/20 flex items-center justify-center shrink-0">
          <span className="text-xl font-black text-gold-500 font-accent">
            {player.playerNumber}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {player.playerName && (
              <span className="text-white text-sm font-semibold truncate">{player.playerName}</span>
            )}
            <span className="text-white/30 text-xs">
              {player.observations.length} obs
            </span>
          </div>
          <div className="flex gap-2 mt-0.5">
            {hitCount > 0 && <span className="text-green-400 text-xs">{hitCount} H</span>}
            {outCount > 0 && <span className="text-red-400 text-xs">{outCount} O</span>}
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
              {/* Mini spray chart if any have locations */}
              {hasLocations && (
                <div className="pt-2">
                  <MiniSprayChart observations={player.observations} />
                </div>
              )}

              {/* Observation list */}
              {player.observations.map((obs, i) => (
                <div key={obs.id} className="flex items-start gap-2 text-sm border-t border-white/5 pt-2">
                  <span className="text-white/20 text-xs mt-0.5 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {obs.hit_type && (
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/50 text-xs font-accent">
                          {hitTypeLabel(obs.hit_type)}
                        </span>
                      )}
                      <ResultBadge result={obs.result} />
                      {obs.location_x != null && (
                        <span className="text-white/20 text-[10px]">
                          ({Math.round(obs.location_x)}, {Math.round(obs.location_y!)})
                        </span>
                      )}
                    </div>
                    {obs.notes && (
                      <p className="text-white/50 text-xs mt-1 italic">{obs.notes}</p>
                    )}
                    <div className="flex gap-2 mt-1 text-[10px] text-white/20">
                      <span>{timeAgo(obs.created_at)}</span>
                      {obs.coach_name && <span>by {obs.coach_name}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Main live scout view ─── */
export default function LiveScoutView({ teams }: { teams: ScoutedTeam[] }) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  if (teams.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <svg className="w-12 h-12 mx-auto text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-white/30 text-sm">No live observations yet</p>
        <p className="text-white/15 text-xs">Tap "Add Observation" above to start scouting</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {teams.map(team => (
        <div key={team.teamName} className="space-y-2">
          <button
            onClick={() => setExpandedTeam(expandedTeam === team.teamName ? null : team.teamName)}
            className="w-full flex items-center justify-between p-4 bg-navy-800/50 border border-white/5 rounded-xl hover:bg-navy-800 transition-colors"
          >
            <div className="text-left">
              <h3 className="text-white font-accent uppercase tracking-wider text-sm font-bold">
                {team.teamName}
              </h3>
              <p className="text-white/30 text-xs mt-0.5">
                {team.players.length} players / {team.totalObservations} observations / last {timeAgo(team.lastScouted)}
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-white/20 transition-transform ${expandedTeam === team.teamName ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <AnimatePresence>
            {expandedTeam === team.teamName && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pl-2">
                  {team.players.map(player => (
                    <PlayerObsCard key={player.playerNumber} player={player} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
