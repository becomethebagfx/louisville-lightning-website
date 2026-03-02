import { useState } from 'react';
import { motion, Reorder, useDragControls, AnimatePresence } from 'framer-motion';
import type { Player } from '../lib/types';
import { useRoster } from '../lib/useRoster';
import { useAudioPlayer } from '../lib/useAudioPlayer';
import { useCoachMode } from '../lib/useCoachMode';
import { deleteAudio } from '../lib/db';
import SpeakerSetup from '../components/walkup/SpeakerSetup';
import PlayerCard from '../components/walkup/PlayerCard';
import EditPlayerModal from '../components/walkup/EditPlayerModal';
import PinModal from '../components/walkup/PinModal';
import NowPlaying from '../components/walkup/NowPlaying';
import InstallBanner from '../components/walkup/InstallBanner';

function ReorderablePlayer({
  player,
  isPlaying,
  isCoach,
  onPlay,
  onStop,
  onEdit,
  audioVersion,
}: {
  player: Player;
  isPlaying: boolean;
  isCoach: boolean;
  onPlay: () => void;
  onStop: () => void;
  onEdit: () => void;
  audioVersion: number;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={player}
      className="list-none"
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.03, boxShadow: '0 8px 32px rgba(245,184,0,0.3)', zIndex: 50 }}
    >
      <PlayerCard
        player={player}
        isPlaying={isPlaying}
        isCoach={isCoach}
        onPlay={onPlay}
        onStop={onStop}
        onEdit={onEdit}
        audioVersion={audioVersion}
        onDragStart={(e) => controls.start(e)}
      />
    </Reorder.Item>
  );
}

export default function WalkUpPage() {
  const { players, addPlayer, updatePlayer, removePlayer, reorderPlayers } = useRoster();
  const { playingId, play, stop } = useAudioPlayer();
  const { isCoach, unlock, lock } = useCoachMode();
  const [editingPlayer, setEditingPlayer] = useState<Player | null | 'new'>(null);
  const [audioVersion, setAudioVersion] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const playingPlayer = playingId ? players.find(p => p.id === playingId) : null;

  function requireCoach(action: () => void) {
    if (isCoach) {
      action();
    } else {
      setPendingAction(() => action);
      setShowPinModal(true);
    }
  }

  function handlePinUnlock(pin: string): boolean {
    const ok = unlock(pin);
    if (ok) {
      setShowPinModal(false);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    }
    return ok;
  }

  function handleDelete(id: string) {
    if (playingId === id) stop();
    deleteAudio(id);
    removePlayer(id);
  }

  return (
    <div className="min-h-screen pt-16">
      {/* Hero header */}
      <div className="relative py-12 md:py-16 bg-navy-800 overflow-hidden">
        <div className="absolute inset-0 stripe-pattern opacity-50" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />

        <div className="relative max-w-lg mx-auto px-4 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <img
              src="/assets/logo-transparent.png"
              alt="Louisville Lightning"
              className="w-20 h-20 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(245,184,0,0.4)]"
            />
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-stadium text-4xl md:text-5xl"
          >
            <span className="text-white">WALK-UP</span>{' '}
            <span className="text-gradient-gold glow-gold-subtle">SONGS</span>
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-3 text-white/50 font-body"
          >
            Tap a player to blast their walk-up song
          </motion.p>

          {/* Lock/unlock toggle */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-4"
          >
            <button
              onClick={() => isCoach ? lock() : setShowPinModal(true)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-accent uppercase tracking-wider transition-all ${
                isCoach
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
                  : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/10'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isCoach ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                )}
              </svg>
              {isCoach ? 'Coach Mode' : 'Locked'}
            </button>
          </motion.div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Install banner */}
        <InstallBanner />

        {/* Speaker setup */}
        <SpeakerSetup />

        {/* Player list */}
        {players.length === 0 ? (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center py-16 space-y-5"
          >
            <svg
              className="w-16 h-16 mx-auto text-gold-500/30"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
            </svg>
            <p className="text-white/40 text-lg font-accent uppercase tracking-wider">
              No players yet
            </p>
            <button
              onClick={() => requireCoach(() => setEditingPlayer('new'))}
              className="btn-lightning text-base"
            >
              Add First Player
            </button>
          </motion.div>
        ) : (
          <Reorder.Group
            axis="y"
            values={players}
            onReorder={reorderPlayers}
            className="space-y-3"
          >
            {players.map((player) => (
              <ReorderablePlayer
                key={player.id}
                player={player}
                isPlaying={playingId === player.id}
                isCoach={isCoach}
                onPlay={() => play(player.id, player.startTime, player.clipDuration)}
                onStop={stop}
                onEdit={() => requireCoach(() => setEditingPlayer(player))}
                audioVersion={audioVersion}
              />
            ))}
          </Reorder.Group>
        )}

        {/* Add player button — only in coach mode */}
        {players.length > 0 && isCoach && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <button
              onClick={() => setEditingPlayer('new')}
              className="w-full py-4 rounded-lg border-2 border-dashed border-gold-500/20 text-gold-500/60 font-accent uppercase tracking-wider text-sm font-semibold hover:border-gold-500/40 hover:text-gold-500/80 hover:bg-gold-500/5 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Player
            </button>
          </motion.div>
        )}
      </div>

      {/* Now Playing overlay */}
      <AnimatePresence>
        {playingPlayer && (
          <NowPlaying player={playingPlayer} onStop={stop} />
        )}
      </AnimatePresence>

      {/* PIN modal */}
      {showPinModal && (
        <PinModal
          onUnlock={handlePinUnlock}
          onClose={() => { setShowPinModal(false); setPendingAction(null); }}
        />
      )}

      {/* Edit modal */}
      {editingPlayer !== null && (
        <EditPlayerModal
          player={editingPlayer === 'new' ? null : editingPlayer}
          onSave={p => {
            if (editingPlayer === 'new') addPlayer(p);
            else updatePlayer(p);
            setAudioVersion(v => v + 1);
          }}
          onDelete={editingPlayer !== 'new' ? () => handleDelete(editingPlayer.id) : undefined}
          onClose={() => setEditingPlayer(null)}
        />
      )}
    </div>
  );
}
