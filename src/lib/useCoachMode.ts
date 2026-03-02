import { useState, useCallback } from 'react'

const SESSION_KEY = 'lightning-coach-unlocked'
const COACH_PIN = import.meta.env.VITE_COACH_PIN || '2026'

export function useCoachMode() {
  const [isCoach, setIsCoach] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true')

  const unlock = useCallback((pin: string): boolean => {
    if (pin === COACH_PIN) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setIsCoach(true)
      return true
    }
    return false
  }, [])

  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setIsCoach(false)
  }, [])

  return { isCoach, unlock, lock }
}
