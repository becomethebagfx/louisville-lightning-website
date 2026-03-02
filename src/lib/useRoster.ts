import { useState, useEffect, useCallback } from 'react'
import type { Player } from './types'

const STORAGE_KEY = 'lightning-roster'

const DEFAULT_ROSTER: Player[] = [
  { id: 'player-kask-k', name: 'Kask K', number: '', songName: '' },
  { id: 'player-kash-d', name: 'Kash D', number: '', songName: '' },
  { id: 'player-reid', name: 'Reid', number: '', songName: '' },
  { id: 'player-elijah', name: 'Elijah', number: '', songName: '' },
  { id: 'player-micah', name: 'Micah', number: '', songName: '' },
  { id: 'player-colt', name: 'Colt', number: '', songName: '' },
  { id: 'player-beau', name: 'Beau', number: '', songName: '' },
  { id: 'player-mason', name: 'Mason', number: '', songName: '' },
  { id: 'player-grayson', name: 'Grayson', number: '', songName: '' },
  { id: 'player-cooper', name: 'Cooper', number: '', songName: '' },
  { id: 'player-grant', name: 'Grant', number: '', songName: '' },
]

function loadRoster(): Player[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_ROSTER
  } catch {
    return DEFAULT_ROSTER
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
