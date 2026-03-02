import { useState, useEffect, useRef } from 'react';

const DISMISS_KEY = 'lightning-install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    setIsIOS(ios);

    if (ios) {
      setShow(true);
      return;
    }

    function handlePrompt(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setShow(true);
    }

    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  }

  async function install() {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') dismiss();
    deferredPrompt.current = null;
  }

  if (!show) return null;

  return (
    <div className="card-electric rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gold-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-gold-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-accent uppercase tracking-wider text-sm text-gold-500 font-semibold">Add to Home Screen</p>
          {isIOS ? (
            <p className="text-xs text-white/40 mt-1">
              Tap <span className="inline-block px-1 bg-white/10 rounded text-white/60">Share</span> then{' '}
              <span className="inline-block px-1 bg-white/10 rounded text-white/60">Add to Home Screen</span>
            </p>
          ) : (
            <p className="text-xs text-white/40 mt-1">Install for quick access from your home screen</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isIOS && (
            <button
              onClick={install}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gold-500 text-navy-900 text-xs font-accent uppercase tracking-wider font-semibold hover:bg-gold-400 transition-colors"
            >
              Install
            </button>
          )}
          <button
            onClick={dismiss}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/10 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
