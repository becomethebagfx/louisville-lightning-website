import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '../../lib/types';
import {
  saveAudio,
  getAudio,
  deleteAudio,
  getAnnouncement,
  saveAnnouncement,
  deleteAnnouncement,
} from '../../lib/db';
import { audioBufferToWavBlob } from '../../lib/wav';
import { searchSongs, fetchPreviewBlob, type SongResult } from '../../lib/songSearch';

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

  // Song search state
  const [songQuery, setSongQuery] = useState('');
  const [songResults, setSongResults] = useState<SongResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [importingUrl, setImportingUrl] = useState('');

  // Player intro (announcement) state
  const [introStatus, setIntroStatus] = useState<'none' | 'loaded' | 'pending'>('none');
  const [introLabel, setIntroLabel] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [introError, setIntroError] = useState('');
  const [isIntroPreviewing, setIsIntroPreviewing] = useState(false);
  const pendingIntroBlob = useRef<Blob | null>(null);
  const introRemovedRef = useRef(false);
  const introBlobRef = useRef<Blob | null>(null);
  const introFileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const introUrlRef = useRef<string | null>(null);

  const stopIntroPreview = useCallback(() => {
    if (introAudioRef.current) {
      introAudioRef.current.pause();
      introAudioRef.current.currentTime = 0;
    }
    if (introUrlRef.current) {
      URL.revokeObjectURL(introUrlRef.current);
      introUrlRef.current = null;
    }
    setIsIntroPreviewing(false);
  }, []);

  useEffect(() => {
    return () => {
      stopIntroPreview();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        // Detach onstop first: no decode/setState work on an unmounted modal
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
        recorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stopIntroPreview]);

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
      getAnnouncement(player.id).then(blob => {
        if (blob) {
          introBlobRef.current = blob;
          setIntroStatus('loaded');
          setIntroLabel('Current intro loaded');
        }
      });
    }
  }, [player]);

  async function startRecording() {
    setIntroError('');
    stopIntroPreview();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordChunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const raw = new Blob(recordChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        try {
          // Re-encode to WAV so Chrome-recorded webm plays on iPhones too.
          const ctx = new AudioContext();
          const buf = await ctx.decodeAudioData(await raw.arrayBuffer());
          ctx.close();
          const wav = audioBufferToWavBlob(buf);
          pendingIntroBlob.current = wav;
          introRemovedRef.current = false;
          setIntroStatus('pending');
          setIntroLabel(`Recorded intro (${buf.duration.toFixed(1)}s)`);
        } catch {
          setIntroError('Could not process the recording. Try again or upload a file.');
        }
        setIsRecording(false);
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      setIntroError('Microphone unavailable. Check permissions, or upload a file instead.');
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }

  function handleIntroFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIntroError('');
    stopIntroPreview();
    pendingIntroBlob.current = file;
    introRemovedRef.current = false;
    setIntroStatus('pending');
    setIntroLabel(file.name);
  }

  async function handleIntroPreview() {
    if (isIntroPreviewing) {
      stopIntroPreview();
      return;
    }
    stopPreview();
    const blob = pendingIntroBlob.current || introBlobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    introUrlRef.current = url;
    const audio = new Audio(url);
    introAudioRef.current = audio;
    audio.onended = () => stopIntroPreview();
    try {
      setIsIntroPreviewing(true);
      await audio.play();
    } catch {
      stopIntroPreview();
    }
  }

  function handleRemoveIntro() {
    stopIntroPreview();
    pendingIntroBlob.current = null;
    introBlobRef.current = null;
    introRemovedRef.current = true;
    setIntroStatus('none');
    setIntroLabel('');
  }

  async function handleSongSearch() {
    const term = songQuery.trim();
    if (!term || isSearching) return;
    setIsSearching(true);
    setSearchError('');
    setSongResults([]);
    try {
      const results = await searchSongs(term);
      setSongResults(results);
      if (results.length === 0) setSearchError('No songs found. Try a different search.');
    } catch {
      setSearchError('Search failed. Check your connection and try again.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleImportSong(result: SongResult) {
    if (importingUrl) return;
    setImportingUrl(result.previewUrl);
    setSearchError('');
    try {
      const blob = await fetchPreviewBlob(result.previewUrl);
      stopPreview();
      pendingBlob.current = blob;
      setSongName(`${result.trackName} - ${result.artistName}`);
      setAudioFileName(`${result.trackName} (30s clip)`);
      setHasAudio(false);
      setStartTime(0);
      setClipDuration(15);
      await loadAudioBlob(blob);
      setSongResults([]);
      setSongQuery('');
    } catch {
      setSearchError('Could not import that clip. Try another result or upload a file.');
    } finally {
      setImportingUrl('');
    }
  }

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
    stopIntroPreview();

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

  function handleSave() {
    if (!name.trim() || isRecording) return;

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
      saveAudio(id, pendingBlob.current);
    }

    if (pendingIntroBlob.current) {
      saveAnnouncement(id, pendingIntroBlob.current);
    } else if (introRemovedRef.current && player) {
      deleteAnnouncement(player.id);
    }

    stopPreview();
    stopIntroPreview();
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

          {/* Song search */}
          <div>
            <label className="block text-xs text-white/50 font-accent uppercase tracking-wider mb-1.5">
              Find a Song
            </label>
            <p className="text-xs text-white/30 mb-2">
              Searches real songs and grabs the official 30-second clip. No
              files needed.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={songQuery}
                onChange={e => setSongQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSongSearch(); } }}
                placeholder="Song or artist..."
                className="flex-1 px-4 py-3 rounded-lg bg-navy-700 border border-white/10 text-white placeholder-white/25 outline-none focus:border-gold-500/50 transition-colors"
              />
              <button
                type="button"
                onClick={handleSongSearch}
                disabled={isSearching || !songQuery.trim()}
                className="px-4 py-3 rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-500 text-sm font-accent uppercase tracking-wider hover:bg-gold-500/20 transition-colors disabled:opacity-30"
              >
                {isSearching ? '...' : 'Search'}
              </button>
            </div>
            {songResults.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {songResults.map(r => (
                  <li key={r.previewUrl}>
                    <button
                      type="button"
                      onClick={() => handleImportSong(r)}
                      disabled={!!importingUrl}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-navy-700 border border-white/10 hover:border-gold-500/40 transition-colors text-left disabled:opacity-50"
                    >
                      {r.artworkUrl ? (
                        <img src={r.artworkUrl} alt="" className="w-9 h-9 rounded flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-white/5 flex-shrink-0" />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-white truncate">{r.trackName}</span>
                        <span className="block text-xs text-white/40 truncate">{r.artistName}</span>
                      </span>
                      <span className="text-xs text-gold-500 font-accent uppercase tracking-wider flex-shrink-0">
                        {importingUrl === r.previewUrl ? 'Adding...' : 'Use'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searchError && (
              <p className="mt-1.5 text-xs text-red-400">{searchError}</p>
            )}
          </div>

          {/* Audio file */}
          <div>
            <label className="block text-xs text-white/50 font-accent uppercase tracking-wider mb-1.5">Or Upload Audio</label>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,video/*,.mp3,.m4a,.wav,.aac,.ogg,.mp4,.mov,.webm,.opus,.flac"
              onChange={handleFileChange}
              className="absolute w-0 h-0 opacity-0 overflow-hidden"
            />
            <div className="flex gap-2">
              <button
                type="button"
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

          {/* Player intro (announcement) */}
          <div>
            <label className="block text-xs text-white/50 font-accent uppercase tracking-wider mb-1.5">
              Player Intro
            </label>
            <p className="text-xs text-white/30 mb-2">
              PA-announcer intro that plays before the walk-up song. Record one
              or upload an audio file.
            </p>
            <input
              ref={introFileRef}
              type="file"
              accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.opus,.flac"
              onChange={handleIntroFile}
              className="absolute w-0 h-0 opacity-0 overflow-hidden"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex-1 px-3 py-3 rounded-lg border text-sm font-accent uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
                  isRecording
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'bg-navy-700 border-white/10 text-white/60 hover:border-gold-500/30'
                }`}
              >
                <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  {isRecording ? (
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  ) : (
                    <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z" />
                  )}
                </svg>
                {isRecording ? 'Stop' : 'Record'}
              </button>
              <button
                type="button"
                onClick={() => introFileRef.current?.click()}
                className="flex-1 px-3 py-3 rounded-lg bg-navy-700 border border-white/10 text-white/60 text-sm font-accent uppercase tracking-wider hover:border-gold-500/30 transition-colors"
              >
                Upload
              </button>
              {introStatus !== 'none' && (
                <button
                  type="button"
                  onClick={handleRemoveIntro}
                  className="px-3 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                >
                  Remove
                </button>
              )}
            </div>
            {introStatus !== 'none' && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleIntroPreview}
                  className={`px-3 py-2 rounded-lg text-xs font-accent uppercase tracking-wider transition-colors ${
                    isIntroPreviewing
                      ? 'bg-red-500 text-white'
                      : 'bg-gold-500/10 border border-gold-500/30 text-gold-500 hover:bg-gold-500/20'
                  }`}
                >
                  {isIntroPreviewing ? 'Stop' : 'Play Intro'}
                </button>
                <span className="text-xs text-white/40 truncate">{introLabel}</span>
                {introStatus === 'pending' && (
                  <span className="text-xs text-gold-500/80 whitespace-nowrap">Not saved yet</span>
                )}
              </div>
            )}
            {introError && (
              <p className="mt-1.5 text-xs text-red-400">{introError}</p>
            )}
          </div>

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
              disabled={!name.trim() || isRecording}
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
