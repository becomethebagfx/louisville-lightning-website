import { useState, useEffect, useCallback, useRef } from 'react'
import type { Player } from './types'
import { supabase } from './supabase'
import {
  loadTeamManifest,
  saveTeamManifest,
  type TeamKey,
  type TeamManifest,
} from './db'

const LEGACY_STORAGE_KEY = 'lightning-roster'
const storageKey = (team: TeamKey) => `lightning-roster-${team}`

// DELIBERATE: no player names are seeded here. These are minors and this
// repository is public, so hard-coded names ship inside the JS bundle and are
// readable on GitHub. Coaches add their own players in the app, and those stay
// in that device's localStorage. Rosters already saved on a device are
// untouched: loadLocal() returns stored data before it ever reaches this list.
const DEFAULT_ROSTER: Player[] = []

function loadLocal(team: TeamKey): Player[] {
  try {
    const raw = localStorage.getItem(storageKey(team))
    if (raw) return JSON.parse(raw)
    if (team === 'yellow') {
      // Migrate from the single-roster era
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacy) return JSON.parse(legacy)
      return DEFAULT_ROSTER
    }
    return []
  } catch {
    return team === 'yellow' ? DEFAULT_ROSTER : []
  }
}

function saveLocal(team: TeamKey, players: Player[]) {
  try { localStorage.setItem(storageKey(team), JSON.stringify(players)) } catch { /* ignore */ }
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

export function useRoster(team: TeamKey) {
  const [players, setPlayers] = useState<Player[]>(() => loadLocal(team))
  const manifestRef = useRef<TeamManifest | null>(null)

  // Reload the local snapshot when the active team changes
  useEffect(() => {
    setPlayers(loadLocal(team))
  }, [team])

  // Sync from Supabase on mount + subscribe to realtime changes
  useEffect(() => {
    if (!supabase) return

    const sb = supabase
    let disposed = false

    const refetch = async () => {
      const [{ data, error }, manifest] = await Promise.all([
        sb.from('players').select('*').order('sort_order'),
        loadTeamManifest(),
      ])
      if (disposed || error || !data) {
        if (error) console.error('Failed to load roster from Supabase:', error)
        return
      }

      const all = data.map(rowToPlayer)

      // First-run migration: no manifest yet means every existing player is
      // Yellow (the original single roster).
      let m = manifest
      if (!m) {
        m = { yellow: { playerIds: all.map(p => p.id) }, blue: { playerIds: [] } }
        saveTeamManifest(m)
      } else {
        const known = new Set([...m.yellow.playerIds, ...m.blue.playerIds])
        let changed = false

        // A just-added player's manifest upload may still be in flight when
        // the realtime refetch downloads teams.json: let this device's local
        // placement win before the orphan sweep, or a Blue add would be
        // misfiled to Yellow. Removed rows fail the `all` check, so a stale
        // local manifest cannot resurrect a deleted player.
        const local = manifestRef.current
        if (local) {
          for (const t of ['yellow', 'blue'] as TeamKey[]) {
            for (const id of local[t].playerIds) {
              if (!known.has(id) && all.some(p => p.id === id)) {
                m = { ...m, [t]: { playerIds: [...m[t].playerIds, id] } }
                known.add(id)
                changed = true
              }
            }
          }
        }

        // Adopt truly-unassigned rows (added before this feature or by a
        // stale client) into Yellow so no player can vanish from both teams.
        const orphans = all.filter(p => !known.has(p.id)).map(p => p.id)
        if (orphans.length > 0) {
          m = { ...m, yellow: { playerIds: [...m.yellow.playerIds, ...orphans] } }
          changed = true
        }
        if (changed) saveTeamManifest(m)
      }
      manifestRef.current = m

      const memberIds = new Set(m[team].playerIds)
      const fetched = all.filter(p => memberIds.has(p.id))
      setPlayers(fetched)
      saveLocal(team, fetched)
    }

    refetch()

    const channel = sb
      .channel(`roster-sync-${team}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        refetch()
      })
      .subscribe()

    return () => {
      disposed = true
      sb.removeChannel(channel)
    }
  }, [team])

  // Persist locally whenever players change. Skip the render where the team
  // just changed: `players` still holds the previous team's roster there.
  const prevTeamRef = useRef(team)
  useEffect(() => {
    if (prevTeamRef.current !== team) {
      prevTeamRef.current = team
      return
    }
    saveLocal(team, players)
  }, [team, players])

  const addToManifest = useCallback((id: string) => {
    const m = manifestRef.current ?? { yellow: { playerIds: [] }, blue: { playerIds: [] } }
    if (!m[team].playerIds.includes(id)) {
      const next = { ...m, [team]: { playerIds: [...m[team].playerIds, id] } }
      manifestRef.current = next
      saveTeamManifest(next)
    }
  }, [team])

  const removeFromManifest = useCallback((id: string) => {
    const m = manifestRef.current
    if (!m) return
    const next: TeamManifest = {
      yellow: { playerIds: m.yellow.playerIds.filter(x => x !== id) },
      blue: { playerIds: m.blue.playerIds.filter(x => x !== id) },
    }
    manifestRef.current = next
    saveTeamManifest(next)
  }, [])

  const addPlayer = useCallback((player: Player) => {
    addToManifest(player.id)
    setPlayers(prev => {
      const next = [...prev, player]
      if (supabase) {
        supabase.from('players').upsert(playerToRow(player, next.length - 1)).then(({ error }) => {
          if (error) console.error('Failed to add player:', error)
        })
      }
      return next
    })
  }, [addToManifest])

  const updatePlayer = useCallback((player: Player) => {
    setPlayers(prev => {
      const idx = prev.findIndex(p => p.id === player.id)
      const next = prev.map(p => (p.id === player.id ? player : p))
      if (supabase) {
        supabase.from('players').upsert(playerToRow(player, idx >= 0 ? idx : undefined)).then(({ error }) => {
          if (error) console.error('Failed to update player:', error)
        })
      }
      return next
    })
  }, [])

  const removePlayer = useCallback((id: string) => {
    removeFromManifest(id)
    setPlayers(prev => {
      const next = prev.filter(p => p.id !== id)
      if (supabase) {
        supabase.from('players').delete().eq('id', id).then(({ error }) => {
          if (error) console.error('Failed to delete player:', error)
        })
      }
      return next
    })
  }, [removeFromManifest])

  const reorderPlayers = useCallback((reordered: Player[]) => {
    setPlayers(reordered)
  }, [])

  const saveOrder = useCallback(async (): Promise<boolean> => {
    const sb = supabase
    if (!sb) return true
    // Individual updates instead of upsert (upsert fails due to NOT NULL
    // columns). Values 0..n per team; cross-team ties are harmless because
    // ordering is only ever compared within one team's subset.
    const results = await Promise.all(
      players.map((p, i) =>
        sb.from('players').update({ sort_order: i }).eq('id', p.id)
      )
    )
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      console.error('Failed to save order:', failed.map(r => r.error))
      return false
    }
    return true
  }, [players])

  return { players, addPlayer, updatePlayer, removePlayer, reorderPlayers, saveOrder }
}
