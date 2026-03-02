import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onUnlock: (pin: string) => boolean;
  onClose: () => void;
}

export default function PinModal({ onUnlock, onClose }: Props) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;

    const next = [...digits];
    next[index] = value;
    setDigits(next);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === 3) {
      const pin = next.join('');
      if (pin.length === 4) {
        const ok = onUnlock(pin);
        if (!ok) {
          setShake(true);
          setTimeout(() => {
            setShake(false);
            setDigits(['', '', '', '']);
            inputRefs.current[0]?.focus();
          }, 500);
        }
      }
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={shake ? { x: [0, -12, 12, -12, 12, 0], scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={shake ? { duration: 0.4 } : { type: 'spring', damping: 20 }}
          className="bg-navy-800 border border-gold-500/20 rounded-2xl p-8 mx-4 w-full max-w-xs space-y-6"
          onClick={e => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gold-500/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-stadium text-2xl text-gold-500">Coach PIN</h2>
            <p className="text-sm text-white/40 mt-1">Enter 4-digit PIN to edit roster</p>
          </div>

          <div className="flex justify-center gap-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-14 h-14 text-center text-2xl font-bold rounded-lg bg-navy-700 border border-white/10 text-white outline-none focus:border-gold-500/50 transition-colors"
              />
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg bg-white/5 border border-white/10 text-white/50 font-accent uppercase tracking-wider text-sm font-semibold hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
