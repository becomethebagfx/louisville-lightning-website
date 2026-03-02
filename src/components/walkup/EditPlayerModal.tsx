import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '../../lib/types';
import { saveAudio, getAudio, deleteAudio } from '../../lib/db';

interface Props {
  player: Player | null;
  onSave: (player: Player) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function EditPlayerModal({ player, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(player?.name ?? '');
  const [number, setNumber] = useState(player?.number ?? '');
  const [songName, setSongName] = useState(player?.songName ?? '');
  const [hasAudio, setHasAudio] = useState(false);
  const [audioFileName, setAudioFileName] = useState('');
  const [startTime, setStartTime] = useState(player?.startTime ?? 0);
  const [clipDuration, setClipDuration] = useState(player?.clipDuration ?? 15);
  const [audioDuration, setAudioDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingBlob = useRef<Blob | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  const stopPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setIsPreviewing(false);
  }, []);

  useEffect(() => {
    return () => stopPreview();
  }, [stopPreview]);

  const [audioError, setAudioError] = useState('');

  async function loadAudioBlob(blob: Blob) {
    audioBlobRef.current = blob;
    setAudioError('');
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setAudioDuration(audioBuffer.duration);

      // Generate waveform data (64 bars)
      const rawData = audioBuffer.getChannelData(0);
      const bars = 64;
      const blockSize = Math.floor(rawData.length / bars);
      const peaks: number[] = [];
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j]);
        }
        peaks.push(sum / blockSize);
      }
      const max = Math.max(...peaks, 0.01);
      setWaveform(peaks.map(p => p / max));
    } catch (err) {
      console.error('Failed to decode audio:', err);
      setAudioError('Could not read this audio file. Try a different format (MP3, M4A, WAV).');
      setWaveform([]);
      setAudioDuration(0);
    } finally {
      audioCtx.close();
    }
  }

  useEffect(() => {
    if (player) {
      getAudio(player.id).then(blob => {
        if (blob) {
          setHasAudio(true);
          setAudioFileName('Current clip loaded');
          loadAudioBlob(blob);
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
    setStartTime(0);
    setClipDuration(15);
    loadAudioBlob(file);
  }

  async function handlePreview() {
    if (isPreviewing) {
      stopPreview();
      return;
    }

    const blob = pendingBlob.current || audioBlobRef.current;
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    const audio = new Audio(url);
    previewAudioRef.current = audio;

    audio.currentTime = startTime;
    audio.onended = () => stopPreview();

    if (clipDuration > 0) {
      previewTimerRef.current = setTimeout(() => stopPreview(), clipDuration * 1000);
    }

    try {
      setIsPreviewing(true);
      await audio.play();
    } catch {
      stopPreview();
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
      startTime: startTime > 0 ? startTime : undefined,
      clipDuration: clipDuration > 0 && clipDuration < audioDuration ? clipDuration : undefined,
    };

    if (pendingBlob.current) {
      await saveAudio(id, pendingBlob.current);
    }

    stopPreview();
    onSave(saved);
    onClose();
  }

  async function handleRemoveAudio() {
    stopPreview();
    if (player) {
      await deleteAudio(player.id);
    }
    pendingBlob.current = null;
    audioBlobRef.current = null;
    setHasAudio(false);
    setAudioFileName('');
    setWaveform([]);
    setAudioDuration(0);
    setStartTime(0);
    setClipDuration(15);
  }

  const hasAudioData = waveform.length > 0 && audioDuration > 0;
  const endTime = Math.min(startTime + clipDuration, audioDuration);

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
          className="w-full max-w-md bg-navy-800 border border-gold-500/20 rounded-t-2xl sm:rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
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
              maxLength={50}
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
              maxLength={100}
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
              accept="audio/*,video/*,.mp3,.m4a,.wav,.aac,.ogg,.mp4,.mov,.webm,.opus,.flac"
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
            {audioError && (
              <p className="mt-1.5 text-xs text-red-400">{audioError}</p>
            )}
            <p className="mt-1.5 text-xs text-white/30">MP3, M4A, WAV, or any audio format</p>
          </div>

          {/* Waveform Trimmer */}
          {hasAudioData && (
            <div className="space-y-3">
              <label className="block text-xs text-white/50 font-accent uppercase tracking-wider">Clip Selection</label>

              {/* Waveform visualization */}
              <div className="relative h-16 bg-navy-900 rounded-lg overflow-hidden">
                {/* Waveform bars */}
                <div className="absolute inset-0 flex items-center gap-px px-1">
                  {waveform.map((peak, i) => {
                    const barPos = i / waveform.length;
                    const startPos = startTime / audioDuration;
                    const endPos = endTime / audioDuration;
                    const inRange = barPos >= startPos && barPos <= endPos;
                    return (
                      <div
                        key={i}
                        className="flex-1 flex items-center justify-center"
                        style={{ height: '100%' }}
                      >
                        <div
                          className={`w-full rounded-sm transition-colors ${
                            inRange ? 'bg-gold-500' : 'bg-white/15'
                          }`}
                          style={{ height: `${Math.max(peak * 100, 4)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Selection overlay indicators */}
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-gold-400"
                  style={{ left: `${(startTime / audioDuration) * 100}%` }}
                >
                  <div className="absolute -top-0.5 -left-1.5 w-3 h-3 bg-gold-400 rounded-full" />
                </div>
                <div
                  className="absolute top-0 bottom-0 border-r-2 border-gold-400"
                  style={{ left: `${(endTime / audioDuration) * 100}%` }}
                >
                  <div className="absolute -bottom-0.5 -left-1.5 w-3 h-3 bg-gold-400 rounded-full" />
                </div>
              </div>

              {/* Time display */}
              <div className="flex justify-between text-xs text-white/40 font-accent">
                <span>{formatTime(startTime)}</span>
                <span className="text-gold-500">{formatTime(clipDuration)} clip</span>
                <span>{formatTime(audioDuration)}</span>
              </div>

              {/* Start time slider */}
              <div>
                <label className="block text-xs text-white/40 mb-1">Start at</label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(audioDuration - 5, 0)}
                  step={0.5}
                  value={startTime}
                  onChange={e => setStartTime(parseFloat(e.target.value))}
                  className="w-full accent-gold-500"
                />
              </div>

              {/* Duration slider */}
              <div>
                <label className="block text-xs text-white/40 mb-1">Play for</label>
                <input
                  type="range"
                  min={5}
                  max={Math.min(60, audioDuration - startTime)}
                  step={1}
                  value={Math.min(clipDuration, audioDuration - startTime)}
                  onChange={e => setClipDuration(parseFloat(e.target.value))}
                  className="w-full accent-gold-500"
                />
                <div className="flex justify-between text-xs text-white/30 mt-0.5">
                  <span>5s</span>
                  <span>{Math.min(60, Math.floor(audioDuration - startTime))}s</span>
                </div>
              </div>

              {/* Preview button */}
              <button
                onClick={handlePreview}
                className={`w-full py-3 rounded-lg font-accent uppercase tracking-wider text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  isPreviewing
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gold-500/10 border border-gold-500/30 text-gold-500 hover:bg-gold-500/20'
                }`}
              >
                {isPreviewing ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                    Stop Preview
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Preview Clip
                  </>
                )}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {player && onDelete && (
              <button
                onClick={() => { stopPreview(); onDelete(); onClose(); }}
                className="px-5 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-accent uppercase tracking-wider text-sm font-semibold hover:bg-red-500/20 transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => { stopPreview(); onClose(); }}
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
