import { useState, useEffect, useCallback } from 'react'
import type { Player } from './types'
import { supabase } from './supabase'

const STORAGE_KEY = 'lightning-roster'

const DEFAULT_ROSTER: Player[] = [
  { id: 'player-kask-k', name: 'Kask K', number: '?', songName: '' },
  { id: 'player-kash-d', name: 'Kash D', number: '?', songName: '' },
  { id: 'player-reid', name: 'Reid', number: '?', songName: '' },
  { id: 'player-elijah', name: 'Elijah', number: '25', songName: '' },
  { id: 'player-micah', name: 'Micah', number: '?', songName: '' },
  { id: 'player-colt', name: 'Colt', number: '?', songName: '' },
  { id: 'player-beau', name: 'Beau', number: '?', songName: '' },
  { id: 'player-mason', name: 'Mason', number: '?', songName: '' },
  { id: 'player-grayson', name: 'Grayson', number: '?', songName: '' },
  { id: 'player-cooper', name: 'Cooper', number: '?', songName: '' },
  { id: 'player-grant', name: 'Grant', number: '?', songName: '' },
]

function loadLocal(): Player[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_ROSTER
  } catch {
    return DEFAULT_ROSTER
  }
}

function saveLocal(players: Player[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(players)) } catch {}
}

function rowToPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    name: row.name as string,
    number: row.number as string,
    songName: (row.song_name as string) || '',
    startTime: row.start_time as number | undefined,
    clipDuration: row.clip_duration as number | undefined,
  }
}

function playerToRow(p: Player, sortOrder?: number) {
  return {
    id: p.id,
    name: p.name,
    number: p.number || '?',
    song_name: p.songName || '',
    start_time: p.startTime ?? null,
    clip_duration: p.clipDuration ?? null,
    ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
  }
}

export function useRoster() {
  const [players, setPlayers] = useState<Player[]>(loadLocal)

  // Sync from Supabase on mount
  useEffect(() => {
    if (!supabase) return
    supabase
      .from('players')
      .select('*')
      .order('sort_order')
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const fetched = data.map(rowToPlayer)
          setPlayers(fetched)
          saveLocal(fetched)
        }
      })
  }, [])

  // Persist locally whenever players change
  useEffect(() => {
    saveLocal(players)
  }, [players])

  const addPlayer = useCallback((player: Player) => {
    setPlayers(prev => {
      const next = [...prev, player]
      if (supabase) {
        supabase.from('players').insert(playerToRow(player, next.length - 1)).then()
      }
      return next
    })
  }, [])

  const updatePlayer = useCallback((player: Player) => {
    setPlayers(prev => {
      const next = prev.map(p => (p.id === player.id ? player : p))
      if (supabase) {
        supabase.from('players').update(playerToRow(player)).eq('id', player.id).then()
      }
      return next
    })
  }, [])

  const removePlayer = useCallback((id: string) => {
    setPlayers(prev => {
      const next = prev.filter(p => p.id !== id)
      if (supabase) {
        supabase.from('players').delete().eq('id', id).then()
      }
      return next
    })
  }, [])

  return { players, addPlayer, updatePlayer, removePlayer }
}
