import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Player } from '../../lib/types';
import { getAudio } from '../../lib/db';

interface Props {
  player: Player;
  index: number;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onEdit: () => void;
}

export default function PlayerCard({ player, index, isPlaying, onPlay, onStop, onEdit }: Props) {
  const [hasAudio, setHasAudio] = useState(false);

  useEffect(() => {
    getAudio(player.id).then(blob => setHasAudio(!!blob));
  }, [player.id]);

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.05 * index }}
      className={`relative rounded-lg overflow-hidden transition-all duration-300 ${
        isPlaying
          ? 'card-electric box-glow-gold'
          : 'card-electric hover:border-gold-500/40'
      }`}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Jersey number */}
        <div className={`flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center text-2xl font-black font-display transition-all ${
          isPlaying
            ? 'bg-gold-500 text-navy-900'
            : 'bg-gold-500/10 text-gold-500'
        }`}>
          {player.number}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold truncate font-accent uppercase tracking-wide">
            {player.name}
          </div>
          <div className="text-sm text-white/40 truncate">
            {player.songName || 'No song set'}
          </div>
        </div>

        {/* Play/Stop button */}
        {hasAudio ? (
          <button
            onClick={isPlaying ? onStop : onPlay}
            className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              isPlaying
                ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30'
                : 'bg-gold-500 hover:bg-gold-400 text-navy-900 shadow-lg shadow-gold-500/30'
            }`}
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        ) : (
          <button
            onClick={onEdit}
            className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 transition-all active:scale-90"
          >
            <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {/* Edit button */}
        <button
          onClick={onEdit}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>

      {/* Playing indicator */}
      {isPlaying && (
        <div className="h-1 bg-gold-500/20">
          <div className="h-full bg-gold-500 animate-pulse" style={{ width: '100%' }} />
        </div>
      )}
    </motion.div>
  );
}
