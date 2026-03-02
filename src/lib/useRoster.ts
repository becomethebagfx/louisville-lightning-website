import { useState, useEffect, useCallback } from 'react'
import type { Player } from './types'

const STORAGE_KEY = 'lightning-roster'

function loadRoster(): Player[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persist(players: Player[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players))
}

export function useRoster() {
  const [players, setPlayers] = useState<Player[]>(loadRoster)

  useEffect(() => {
    persist(players)
  }, [players])

  const addPlayer = useCallback((player: Player) => {
    setPlayers(prev => [...prev, player])
  }, [])

  const updatePlayer = useCallback((player: Player) => {
    setPlayers(prev => prev.map(p => (p.id === player.id ? player : p)))
  }, [])

  const removePlayer = useCallback((id: string) => {
    setPlayers(prev => prev.filter(p => p.id !== id))
  }, [])

  return { players, addPlayer, updatePlayer, removePlayer }
}
