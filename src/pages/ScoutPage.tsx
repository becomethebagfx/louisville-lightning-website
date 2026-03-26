import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCoachMode } from '../lib/useCoachMode'
import PinModal from '../components/walkup/PinModal'
import { scoutTeams } from '../lib/scoutData'
import type { ScoutTeam, ScoutPlayer, AtBat } from '../lib/scoutData'

/* ─────────────── Spray Chart SVG ─────────────── */
function SprayChart({ plays }: { plays: AtBat[] }) {
  const w = 300, h = 320
  // Diamond coords
  const home = { x: 150, y: 285 }
  const first = { x: 222, y: 210 }
  const second = { x: 150, y: 145 }
  const third = { x: 78, y: 210 }
  // Outfield arc radius
  const arcR = 250

  // Convert percentage coords (0-100) to SVG coords
  function toSvg(loc: { x: number; y: number }) {
    const svgX = 10 + (loc.x / 100) * (w - 20)
    const svgY = 10 + (loc.y / 100) * (h - 40)
    return { x: svgX, y: svgY }
  }

  const playsWithLoc = plays.filter(p => p.location)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[300px] mx-auto">
      {/* Grass */}
      <path
        d={`M ${home.x} ${home.y} L ${third.x - 60} ${third.y - 80} A ${arcR} ${arcR} 0 0 1 ${first.x + 60} ${first.y - 80} Z`}
        fill="rgba(34,120,60,0.15)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1.5"
      />
      {/* Infield diamond */}
      <polygon
        points={`${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1"
      />
      {/* Base dots */}
      {[home, first, second, third].map((b, i) => (
        <g key={i}>
          <rect
            x={b.x - 4} y={b.y - 4} width={8} height={8}
            fill="rgba(255,255,255,0.3)"
            transform={`rotate(45 ${b.x} ${b.y})`}
          />
        </g>
      ))}
      {/* Pitcher circle */}
      <circle cx={150} cy={215} r={4} fill="rgba(255,255,255,0.2)" />

      {/* Hit dots with lines from home */}
      {playsWithLoc.map((play, i) => {
        const pt = toSvg(play.location!)
        const isHit = play.result === 'hit'
        const color = isHit ? '#22c55e' : '#ef4444'
        return (
          <g key={i}>
            <line
              x1={home.x} y1={home.y}
              x2={pt.x} y2={pt.y}
              stroke={color}
              strokeWidth="1.5"
              opacity="0.5"
            />
            <circle
              cx={pt.x} cy={pt.y} r={10}
              fill={color}
              opacity="0.9"
            />
            <text
              x={pt.x} y={pt.y + 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="white"
            >
              {i + 1}
            </text>
          </g>
        )
      })}

      {/* Legend */}
      <circle cx={20} cy={h - 12} r={5} fill="#22c55e" />
      <text x={30} y={h - 8} fontSize="10" fill="rgba(255,255,255,0.6)">Hit</text>
      <circle cx={65} cy={h - 12} r={5} fill="#ef4444" />
      <text x={75} y={h - 8} fontSize="10" fill="rgba(255,255,255,0.6)">Out</text>
    </svg>
  )
}

/* ─────────────── Player Detail Modal ─────────────── */
function PlayerDetail({
  player,
  onClose,
}: {
  player: ScoutPlayer
  onClose: () => void
}) {
  const avgNum = parseFloat(player.avg)
  const avgColor = avgNum >= 0.5 ? 'text-green-400' : avgNum > 0 ? 'text-gold-500' : 'text-red-400'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto pt-8 pb-8 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-navy-800 border border-gold-500/20 rounded-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-navy-700 p-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-gold-500/10 border-2 border-gold-500/30 flex items-center justify-center">
              <span className="text-4xl font-black text-gold-500 font-accent">
                {player.number}
              </span>
            </div>
            <div>
              <p className="text-white/40 text-xs font-accent uppercase tracking-wider">
                {player.firstName} {player.lastName}
              </p>
              <p className={`text-3xl font-black font-accent ${avgColor}`}>
                {player.avg}
              </p>
              <p className="text-white/50 text-sm">
                {player.hits}-for-{player.atBats}
                {player.rbi > 0 && <span className="ml-2 text-gold-500">{player.rbi} RBI</span>}
              </p>
            </div>
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-2 mt-3">
            {player.singles > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/60 text-xs">{player.singles} 1B</span>
            )}
            {player.doubles > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-500 text-xs">{player.doubles} 2B</span>
            )}
            {player.triples > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs">{player.triples} 3B</span>
            )}
            {player.strikeouts > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs">{player.strikeouts} K</span>
            )}
          </div>
        </div>

        {/* Scouting summary */}
        <div className="px-5 py-3 border-b border-white/5">
          <p className="text-white/70 text-sm italic">{player.summary}</p>
        </div>

        {/* Spray chart */}
        {player.plays.some(p => p.location) && (
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-xs font-accent uppercase tracking-wider text-white/40 mb-3">
              Spray Chart
            </h3>
            <SprayChart plays={player.plays} />
          </div>
        )}

        {/* Play-by-play */}
        <div className="px-5 py-4">
          <h3 className="text-xs font-accent uppercase tracking-wider text-white/40 mb-3">
            Play History
          </h3>
          <div className="space-y-2">
            {player.plays.map((play, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-sm"
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  play.result === 'hit'
                    ? 'bg-green-500/20 text-green-400'
                    : play.result === 'strikeout'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {i + 1}
                </span>
                <span className={
                  play.result === 'hit' ? 'text-green-400' : 'text-white/50'
                }>
                  {play.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─────────────── Player Card in Lineup ─────────────── */
function LineupCard({
  player,
  index,
  onClick,
}: {
  player: ScoutPlayer
  index: number
  onClick: () => void
}) {
  const avgNum = parseFloat(player.avg)
  const threatLevel =
    avgNum >= 0.667 ? 'border-red-500/40 bg-red-500/5' :
    avgNum >= 0.5 ? 'border-gold-500/30 bg-gold-500/5' :
    avgNum > 0 ? 'border-white/10 bg-white/5' :
    'border-white/5 bg-white/[0.02]'

  // Quick summary of what they did
  const quickNote = player.plays
    .filter(p => p.result !== 'strikeout')
    .map(p => {
      const desc = p.description
      // Extract the key info: "GB to SS", "LD to LF", etc
      const match = desc.match(/(?:on a |into )?(ground ball|line drive|fly ball|pop fly|hard ground ball|fielder's choice)(?:\s+to\s+(.+))?/i)
      if (match) {
        const type = match[1].replace('ground ball', 'GB').replace('hard ground ball', 'Hard GB').replace('line drive', 'LD').replace('fly ball', 'FB').replace('pop fly', 'PF').replace("fielder's choice", 'FC')
        const target = match[2]?.replace(' baseman', '').replace(' fielder', '').replace('short ', 'S').toUpperCase() || ''
        return `${type}${target ? ' → ' + target : ''}`
      }
      if (desc.toLowerCase().includes('struck out')) return 'K'
      return desc.split(' ').slice(0, 3).join(' ')
    })
    .join(', ')

  return (
    <motion.button
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] ${threatLevel}`}
    >
      {/* Lineup # */}
      <span className="text-white/20 text-xs font-accent w-4 text-right shrink-0">
        {index + 1}
      </span>

      {/* BIG jersey number */}
      <div className="w-14 h-14 rounded-lg bg-navy-700 border border-gold-500/20 flex items-center justify-center shrink-0">
        <span className="text-2xl font-black text-gold-500 font-accent leading-none">
          {player.number}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold truncate">
            {player.firstName} {player.lastName}
          </span>
          <span className={`text-sm font-black font-accent ${
            avgNum >= 0.5 ? 'text-green-400' : avgNum > 0 ? 'text-gold-500' : 'text-red-400'
          }`}>
            {player.avg}
          </span>
        </div>
        <p className="text-white/40 text-xs truncate mt-0.5">
          {player.hits}-{player.atBats}
          {player.rbi > 0 && ` | ${player.rbi} RBI`}
          {player.strikeouts > 0 && ` | ${player.strikeouts} K`}
        </p>
        {quickNote && (
          <p className="text-white/30 text-[10px] truncate mt-0.5 font-mono">
            {quickNote}
          </p>
        )}
      </div>

      {/* Chevron */}
      <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </motion.button>
  )
}

/* ─────────────── Team Card ─────────────── */
function TeamCard({
  team,
  onClick,
  index,
}: {
  team: ScoutTeam
  onClick: () => void
  index: number
}) {
  const hitCount = team.players.reduce((s, p) => s + p.hits, 0)
  const kCount = team.players.reduce((s, p) => s + p.strikeouts, 0)

  return (
    <motion.button
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      className="w-full card-electric p-6 text-left active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-accent uppercase tracking-wider text-white font-bold">
            {team.name}
          </h3>
          <p className="text-white/40 text-sm mt-1">{team.gameDate}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black font-accent text-gold-500">{team.teamAvg}</p>
          <p className="text-white/40 text-xs">Team AVG</p>
        </div>
      </div>
      <div className="flex gap-4 mt-4 text-xs text-white/50">
        <span>{team.players.length} batters</span>
        <span>{hitCount} hits</span>
        <span>{kCount} K</span>
      </div>
    </motion.button>
  )
}

/* ─────────────── Main Scout Page ─────────────── */
export default function ScoutPage() {
  const { isCoach, unlock } = useCoachMode()
  const [showPinModal, setShowPinModal] = useState(!isCoach)
  const [selectedTeam, setSelectedTeam] = useState<ScoutTeam | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<ScoutPlayer | null>(null)

  function handlePinUnlock(pin: string): boolean {
    const ok = unlock(pin)
    if (ok) setShowPinModal(false)
    return ok
  }

  // If not in coach mode, show pin modal
  if (!isCoach && showPinModal) {
    return (
      <div className="min-h-screen pt-16 bg-navy-900">
        <PinModal
          onUnlock={handlePinUnlock}
          onClose={() => setShowPinModal(false)}
        />
      </div>
    )
  }

  if (!isCoach) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center space-y-4">
          <svg className="w-16 h-16 mx-auto text-gold-500/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-white/40 font-accent uppercase tracking-wider">Coach Access Required</p>
          <button
            onClick={() => setShowPinModal(true)}
            className="btn-lightning text-sm"
          >
            Enter PIN
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16">
      {/* Hero header */}
      <div className="relative py-10 md:py-14 bg-navy-800 overflow-hidden">
        <div className="absolute inset-0 stripe-pattern opacity-50" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />

        <div className="relative max-w-lg mx-auto px-4 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <img
              src="/assets/logo-transparent.png"
              alt="Louisville Lightning"
              className="w-16 h-16 mx-auto mb-3 drop-shadow-[0_0_20px_rgba(245,184,0,0.4)]"
            />
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-stadium text-3xl md:text-4xl"
          >
            <span className="text-white">OPPONENT</span>{' '}
            <span className="text-gradient-gold glow-gold-subtle">SCOUT</span>
          </motion.h1>
          {selectedTeam && (
            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onClick={() => { setSelectedTeam(null); setSelectedPlayer(null) }}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 text-sm font-accent uppercase tracking-wider transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              All Teams
            </motion.button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {!selectedTeam ? (
          /* Team selector */
          <div className="space-y-4">
            <p className="text-white/40 text-sm font-accent uppercase tracking-wider text-center mb-2">
              Select a team to scout
            </p>
            {scoutTeams.map((team, i) => (
              <TeamCard
                key={team.id}
                team={team}
                onClick={() => setSelectedTeam(team)}
                index={i}
              />
            ))}
          </div>
        ) : (
          /* Lineup view */
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-accent uppercase tracking-wider text-white font-bold">
                  {selectedTeam.name}
                </h2>
                <p className="text-white/40 text-xs mt-0.5">
                  Batting order &middot; {selectedTeam.gameDate}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black font-accent text-gold-500">{selectedTeam.teamAvg}</span>
                <p className="text-white/40 text-[10px]">TEAM AVG</p>
              </div>
            </div>

            <div className="space-y-2">
              {selectedTeam.players.map((player, i) => (
                <LineupCard
                  key={`${player.number}-${i}`}
                  player={player}
                  index={i}
                  onClick={() => setSelectedPlayer(player)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Player detail modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <PlayerDetail
            player={selectedPlayer}
            onClose={() => setSelectedPlayer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
