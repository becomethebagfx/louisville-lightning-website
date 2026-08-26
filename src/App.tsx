import { Component, Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import TryoutsPage from './pages/TryoutsPage';
import RegisterPage from './pages/RegisterPage';
import WalkUpPage from './pages/WalkUpPage';
import ScoutPage from './pages/ScoutPage';

/* The raffle is code-split on purpose. It is an unlisted page reached from a
   text message, so the family opening the home page on a phone should never
   pay to download it, and the admin console (the heaviest of the two) should
   never sit in the bundle a stranger gets. Both load only when their route
   is actually visited. */
const RafflePage = lazy(() => import('./pages/RafflePage'));
const RaffleAdminPage = lazy(() => import('./pages/RaffleAdminPage'));

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-navy-900 px-4">
          <div className="text-center space-y-4">
            <div className="text-6xl text-gold-500 text-stadium">OOPS</div>
            <p className="text-white/60">Something went wrong.</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="btn-lightning text-sm"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* Shown while a lazy route chunk is in flight. Navy on navy with a gold mark,
   so a slow phone connection sees the site's own colors instead of a white
   flash against the dark page it just left. */
function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen flex items-center justify-center bg-navy-900 px-4"
    >
      <div className="text-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-10 h-10 mx-auto text-gold-500 animate-pulse drop-shadow-[0_0_20px_rgba(245,184,0,0.5)]"
        >
          <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
        </svg>
        <p className="mt-4 text-xs sm:text-sm tracking-[0.3em] uppercase text-gold-400/70 font-accent">
          Loading
        </p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Navbar />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tryouts" element={<TryoutsPage />} />
            {/* Shareable aliases: the roster announcement lives on the same page */}
            <Route path="/roster" element={<TryoutsPage />} />
            <Route path="/rosters" element={<TryoutsPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/walkup" element={<WalkUpPage />} />
            <Route path="/scout" element={<ScoutPage />} />
            {/* Unlisted on purpose: no Navbar link, kept out of search results by
                the conditional robots script in index.html. Link only. */}
            <Route path="/raffle" element={<RafflePage />} />
            <Route path="/raffle/admin" element={<RaffleAdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
