import { useState } from 'react';
import { motion } from 'framer-motion';

export default function SpeakerSetup() {
  const [tested, setTested] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function playTestSound() {
    // Create a short beep using Web Audio API
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
    setTested(true);
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="card-electric rounded-lg p-5 mb-8"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="font-accent uppercase tracking-wider text-sm text-white font-semibold">
              Speaker Setup
            </div>
            <div className="text-xs text-white/40">
              {tested ? 'Speaker connected' : 'Connect your Bluetooth speaker'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tested && (
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
          )}
          <svg
            className={`w-5 h-5 text-white/40 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mt-5 pt-5 border-t border-white/10 space-y-4"
        >
          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-500/20 text-gold-500 text-xs font-bold flex items-center justify-center">1</span>
              <p className="text-sm text-white/70">
                Open your phone's <strong className="text-white">Settings &gt; Bluetooth</strong> and pair your speaker
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-500/20 text-gold-500 text-xs font-bold flex items-center justify-center">2</span>
              <p className="text-sm text-white/70">
                Make sure the speaker shows as <strong className="text-white">Connected</strong> in your Bluetooth settings
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-500/20 text-gold-500 text-xs font-bold flex items-center justify-center">3</span>
              <p className="text-sm text-white/70">
                Tap the test button below to confirm audio plays through the speaker
              </p>
            </div>
          </div>

          {/* Test button */}
          <button
            onClick={playTestSound}
            className={`w-full py-3 rounded-lg font-accent uppercase tracking-wider text-sm font-semibold transition-all active:scale-95 ${
              tested
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gold-500 text-navy-900 hover:bg-gold-400'
            }`}
          >
            {tested ? 'Speaker Working' : 'Test Speaker'}
          </button>

          {/* Volume reminder */}
          <p className="text-xs text-white/30 text-center">
            Turn up your speaker volume before testing
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
