import { motion } from 'framer-motion';
import type { Player } from '../../lib/types';

interface Props {
  player: Player;
  onStop: () => void;
}

export default function NowPlaying({ player, onStop }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-navy-900/95 backdrop-blur-xl cursor-pointer"
      onClick={onStop}
    >
      {/* Pulsing jersey number */}
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        className="text-[10rem] leading-none text-stadium text-gold-500 drop-shadow-[0_0_60px_rgba(245,184,0,0.5)]"
      >
        {player.number}
      </motion.div>

      {/* Player name */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, type: 'spring', damping: 15 }}
        className="text-stadium text-4xl tracking-wide text-white mt-2"
      >
        {player.name}
      </motion.div>

      {/* Song name */}
      {player.songName && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-white/50 mt-3 font-body"
        >
          {player.songName}
        </motion.div>
      )}

      {/* Equalizer bars */}
      <div className="flex items-end gap-[5px] mt-10 h-12">
        {[0, 1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            className="w-2 rounded-full bg-gold-500"
            animate={{ height: ['12px', '48px', '20px', '40px', '12px'] }}
            transition={{
              repeat: Infinity,
              duration: 0.8 + i * 0.15,
              ease: 'easeInOut',
              delay: i * 0.1,
            }}
          />
        ))}
      </div>

      {/* Stop hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="mt-10 text-sm text-white/40 font-accent uppercase tracking-widest"
      >
        Tap anywhere to stop
      </motion.p>
    </motion.div>
  );
}
