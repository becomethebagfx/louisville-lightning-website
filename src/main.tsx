import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Auto-update: check for a new deployed version every 60s and refresh to it
// automatically - but never reload while a walk-up song is playing (so a
// mid-game deploy can't cut a song off). If a song is playing, wait and retry.
const isSongPlaying = () =>
  Array.from(document.querySelectorAll('audio')).some((a) => !a.paused && !a.ended)

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      setInterval(() => { registration.update() }, 60_000)
    }
  },
  onNeedRefresh() {
    const applyWhenSafe = () => {
      if (isSongPlaying()) {
        setTimeout(applyWhenSafe, 5_000)
      } else {
        updateSW(true)
      }
    }
    applyWhenSafe()
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
