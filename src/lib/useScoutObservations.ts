import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

export interface ScoutObservation {
  id: string
  team_name: string
  player_number: string
  player_name: string | null
  hit_type: 'ground_ball' | 'fly_ball' | 'pop_fly' | 'line_drive' | null
  result: 'hit' | 'out' | 'strikeout' | 'walk' | 'error' | 'hbp' | null
  location_x: number | null
  location_y: number | null
  notes: string | null
  coach_name: string | null
  created_at: string
}

export type NewObservation = Omit<ScoutObservation, 'id' | 'created_at'>

/** Group observations by team, then by player */
export interface ScoutedPlayer {
  playerNumber: string
  playerName: string | null
  observations: ScoutObservation[]
}

export interface ScoutedTeam {
  teamName: string
  players: ScoutedPlayer[]
  totalObservations: number
  lastScouted: string
}

function groupObservations(obs: ScoutObservation[]): ScoutedTeam[] {
  const teamMap = new Map<string, ScoutObservation[]>()
  for (const o of obs) {
    const key = o.team_name.toLowerCase().trim()
    if (!teamMap.has(key)) teamMap.set(key, [])
    teamMap.get(key)!.push(o)
  }

  const teams: ScoutedTeam[] = []
  for (const [, teamObs] of teamMap) {
    const playerMap = new Map<string, ScoutObservation[]>()
    for (const o of teamObs) {
      if (!playerMap.has(o.player_number)) playerMap.set(o.player_number, [])
      playerMap.get(o.player_number)!.push(o)
    }

    const players: ScoutedPlayer[] = []
    for (const [num, pObs] of playerMap) {
      players.push({
        playerNumber: num,
        playerName: pObs.find(o => o.player_name)?.player_name ?? null,
        observations: pObs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      })
    }
    players.sort((a, b) => parseInt(a.playerNumber) - parseInt(b.playerNumber))

    teams.push({
      teamName: teamObs[0].team_name,
      players,
      totalObservations: teamObs.length,
      lastScouted: teamObs.reduce((latest, o) =>
        new Date(o.created_at) > new Date(latest) ? o.created_at : latest,
        teamObs[0].created_at
      ),
    })
  }
  teams.sort((a, b) => new Date(b.lastScouted).getTime() - new Date(a.lastScouted).getTime())
  return teams
}

export function useScoutObservations() {
  const [observations, setObservations] = useState<ScoutObservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all observations
  const fetchAll = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const { data, error: err } = await supabase
      .from('scout_observations')
      .select('*')
      .order('created_at', { ascending: false })

    if (err) {
      console.error('Failed to load scout observations:', err)
      setError(err.message)
    } else {
      setObservations((data as ScoutObservation[]) ?? [])
    }
    setLoading(false)
  }, [])

  // Initial load + realtime subscription
  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    fetchAll()

    const channel = supabase
      .channel('scout-obs-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scout_observations' }, (payload) => {
        // Append new observation to the front (most recent first)
        setObservations(prev => [payload.new as ScoutObservation, ...prev])
      })
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [fetchAll])

  // Add a new observation
  const addObservation = useCallback(async (obs: NewObservation): Promise<boolean> => {
    if (!supabase) return false

    const { error: err } = await supabase
      .from('scout_observations')
      .insert(obs)

    if (err) {
      console.error('Failed to insert scout observation:', err)
      setError(err.message)
      return false
    }
    return true
  }, [])

  const scoutedTeams = groupObservations(observations)

  return {
    observations,
    scoutedTeams,
    loading,
    error,
    addObservation,
    refetch: fetchAll,
    isConnected: !!supabase,
  }
}
