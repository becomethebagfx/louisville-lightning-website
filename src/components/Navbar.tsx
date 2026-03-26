import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Navbar() {
  const location = useLocation();
  const isWalkup = location.pathname === '/walkup';
  const isScout = location.pathname === '/scout';
  const isHome = !isWalkup && !isScout;

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-40 bg-navy-900/90 backdrop-blur-xl border-b border-gold-500/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/assets/logo-transparent.png"
              alt="Louisville Lightning"
              className="w-10 h-10 group-hover:drop-shadow-[0_0_10px_rgba(245,184,0,0.5)] transition-all"
            />
            <span className="text-stadium text-lg hidden sm:block">
              <span className="text-white">LOUISVILLE</span>{' '}
              <span className="text-gold-500">LIGHTNING</span>
            </span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-1">
            <Link
              to="/"
              className={`px-3 py-2 rounded-lg font-accent uppercase tracking-wider text-xs sm:text-sm transition-all ${
                isHome
                  ? 'text-gold-500 bg-gold-500/10'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              Home
            </Link>
            <Link
              to="/walkup"
              className={`px-3 py-2 rounded-lg font-accent uppercase tracking-wider text-xs sm:text-sm transition-all flex items-center gap-1.5 ${
                isWalkup
                  ? 'text-gold-500 bg-gold-500/10'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              Songs
            </Link>
            <Link
              to="/scout"
              className={`px-3 py-2 rounded-lg font-accent uppercase tracking-wider text-xs sm:text-sm transition-all flex items-center gap-1.5 ${
                isScout
                  ? 'text-gold-500 bg-gold-500/10'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Scout
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
