import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '../../lib/types';
import { saveAudio, getAudio, deleteAudio } from '../../lib/db';

interface Props {
  player: Player | null;
  onSave: (player: Player) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function EditPlayerModal({ player, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(player?.name ?? '');
  const [number, setNumber] = useState(player?.number ?? '');
  const [songName, setSongName] = useState(player?.songName ?? '');
  const [hasAudio, setHasAudio] = useState(false);
  const [audioFileName, setAudioFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingBlob = useRef<Blob | null>(null);

  useEffect(() => {
    if (player) {
      getAudio(player.id).then(blob => {
        if (blob) {
          setHasAudio(true);
          setAudioFileName('Current clip loaded');
        }
      });
    }
  }, [player]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingBlob.current = file;
    setAudioFileName(file.name);
    if (!songName) {
      setSongName(file.name.replace(/\.[^.]+$/, ''));
    }
  }

  async function handleSave() {
    if (!name.trim()) return;

    const id = player?.id ?? crypto.randomUUID();
    const saved: Player = {
      id,
      name: name.trim(),
      number: number.trim() || '?',
      songName: songName.trim(),
    };

    if (pendingBlob.current) {
      await saveAudio(id, pendingBlob.current);
    }

    onSave(saved);
    onClose();
  }

  async function handleRemoveAudio() {
    if (player) {
      await deleteAudio(player.id);
    }
    pendingBlob.current = null;
    setHasAudio(false);
    setAudioFileName('');
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-navy-800 border border-gold-500/20 rounded-t-2xl sm:rounded-2xl p-6 space-y-5"
          onClick={e => e.stopPropagation()}
        >
          <h2 className="text-stadium text-2xl text-gold-500">
            {player ? 'Edit Player' : 'Add Player'}
          </h2>

          {/* Name */}
          <div>
            <label className="block text-xs text-white/50 font-accent uppercase tracking-wider mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Player name"
              className="w-full px-4 py-3 rounded-lg bg-navy-700 border border-white/10 text-white placeholder-white/25 outline-none focus:border-gold-500/50 transition-colors"
              autoFocus
            />
          </div>

          {/* Number */}
          <div>
            <label className="block text-xs text-white/50 font-accent uppercase tracking-wider mb-1.5">Jersey Number</label>
            <input
              type="text"
              value={number}
              onChange={e => setNumber(e.target.value)}
              placeholder="#"
              maxLength={3}
              className="w-full px-4 py-3 rounded-lg bg-navy-700 border border-white/10 text-white placeholder-white/25 outline-none focus:border-gold-500/50 transition-colors"
            />
          </div>

          {/* Song name */}
          <div>
            <label className="block text-xs text-white/50 font-accent uppercase tracking-wider mb-1.5">Song Title</label>
            <input
              type="text"
              value={songName}
              onChange={e => setSongName(e.target.value)}
              placeholder="Walk-up song title"
              className="w-full px-4 py-3 rounded-lg bg-navy-700 border border-white/10 text-white placeholder-white/25 outline-none focus:border-gold-500/50 transition-colors"
            />
          </div>

          {/* Audio file */}
          <div>
            <label className="block text-xs text-white/50 font-accent uppercase tracking-wider mb-1.5">Audio Clip</label>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 px-4 py-3 rounded-lg bg-navy-700 border border-white/10 text-left text-white/60 hover:border-gold-500/30 transition-colors truncate"
              >
                {audioFileName || 'Choose audio file...'}
              </button>
              {(hasAudio || audioFileName) && (
                <button
                  onClick={handleRemoveAudio}
                  className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-white/30">MP3, M4A, WAV, or any audio format</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {player && onDelete && (
              <button
                onClick={() => { onDelete(); onClose(); }}
                className="px-5 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-accent uppercase tracking-wider text-sm font-semibold hover:bg-red-500/20 transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-lg bg-white/5 border border-white/10 font-accent uppercase tracking-wider text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="btn-lightning text-sm disabled:opacity-30"
            >
              Save
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
