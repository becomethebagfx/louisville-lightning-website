import { supabase } from './supabase'

const DB_NAME = 'lightning-walkup'
const STORE_NAME = 'audio'
const BUCKET = 'walkup-audio'

// IndexedDB helpers (local cache)
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function cacheAudio(playerId: string, blob: Blob): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, playerId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getCachedAudio(playerId: string): Promise<Blob | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(playerId)
    req.onsuccess = () => resolve(req.result ?? undefined)
    req.onerror = () => reject(req.error)
  })
}

async function deleteCachedAudio(playerId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(playerId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// In-memory cache - preloaded on page mount so play() can grab blobs
// synchronously, preserving the user gesture chain on Safari/iOS.
const memCache = new Map<string, Blob>()

export async function preloadAllAudio(playerIds: string[]): Promise<void> {
  await Promise.all(playerIds.map(async (id) => {
    if (memCache.has(id)) return
    const blob = await getAudio(id)
    if (blob) memCache.set(id, blob)
  }))
}

export function getAudioSync(playerId: string): Blob | undefined {
  return memCache.get(playerId)
}

// Public API - Supabase first, IndexedDB as cache/fallback

export function saveAudio(playerId: string, blob: Blob): void {
  memCache.set(playerId, blob)

  // Cache locally (non-blocking - don't let IndexedDB issues stall the UI)
  cacheAudio(playerId, blob).catch(err =>
    console.error('IndexedDB audio cache failed:', err)
  )

  // Upload to Supabase Storage (non-blocking)
  if (supabase) {
    supabase.storage
      .from(BUCKET)
      .upload(`${playerId}.audio`, blob, { upsert: true })
      .then(({ error }) => {
        if (error) console.error('Supabase audio upload failed:', error)
      })
  }
}

export async function getAudio(playerId: string): Promise<Blob | undefined> {
  // Check in-memory cache first
  const mem = memCache.get(playerId)
  if (mem) return mem

  // Try IndexedDB (fast, works offline)
  try {
    const cached = await getCachedAudio(playerId)
    if (cached) {
      memCache.set(playerId, cached)
      return cached
    }
  } catch {
    // IndexedDB unavailable (private browsing, etc.) - fall through to Supabase
  }

  // Fall back to Supabase Storage
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(`${playerId}.audio`)

    if (!error && data) {
      memCache.set(playerId, data)
      cacheAudio(playerId, data).catch(() => {})
      return data
    }
  }

  return undefined
}

export async function deleteAudio(playerId: string): Promise<void> {
  memCache.delete(playerId)
  deleteCachedAudio(playerId).catch(() => {})

  if (supabase) {
    await supabase.storage
      .from(BUCKET)
      .remove([`${playerId}.audio`])
  }
}

// ---- Team roster manifest ----
// Two teams share one players table (no schema change available); which
// player belongs to which team lives in a small JSON object in the same
// storage bucket. Last-write-wins on concurrent edits (roster edits are
// rare, coach-PIN-gated events).

export type TeamKey = 'yellow' | 'blue'

export interface TeamManifest {
  yellow: { playerIds: string[] }
  blue: { playerIds: string[] }
}

const TEAMS_OBJECT = 'teams.json'
const TEAMS_LOCAL_KEY = 'lightning-teams'

export async function loadTeamManifest(): Promise<TeamManifest | null> {
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(TEAMS_OBJECT)
    if (!error && data) {
      try {
        const parsed = JSON.parse(await data.text()) as TeamManifest
        if (parsed.yellow?.playerIds && parsed.blue?.playerIds) {
          localStorage.setItem(TEAMS_LOCAL_KEY, JSON.stringify(parsed))
          return parsed
        }
      } catch {
        // fall through to local cache
      }
    }
  }
  try {
    const raw = localStorage.getItem(TEAMS_LOCAL_KEY)
    return raw ? (JSON.parse(raw) as TeamManifest) : null
  } catch {
    return null
  }
}

export function saveTeamManifest(manifest: TeamManifest): void {
  try { localStorage.setItem(TEAMS_LOCAL_KEY, JSON.stringify(manifest)) } catch { /* ignore */ }
  if (supabase) {
    supabase.storage
      .from(BUCKET)
      .upload(TEAMS_OBJECT, new Blob([JSON.stringify(manifest)], { type: 'application/json' }), {
        upsert: true,
        contentType: 'application/json',
      })
      .then(({ error }) => {
        if (error) console.error('Team manifest upload failed:', error)
      })
  }
}

// ---- Player intro announcements ----
// Same storage machinery as songs: memCache + IndexedDB keyed with an
// 'ann:' prefix, Supabase object `${playerId}.announce` in the same bucket.

const annKey = (playerId: string) => `ann:${playerId}`

export async function preloadAllAnnouncements(playerIds: string[]): Promise<string[]> {
  const found: string[] = []
  await Promise.all(playerIds.map(async (id) => {
    const blob = await getAnnouncement(id)
    if (blob) found.push(id)
  }))
  return found
}

export function getAnnouncementSync(playerId: string): Blob | undefined {
  return memCache.get(annKey(playerId))
}

export function saveAnnouncement(playerId: string, blob: Blob): void {
  memCache.set(annKey(playerId), blob)

  cacheAudio(annKey(playerId), blob).catch(err =>
    console.error('IndexedDB intro cache failed:', err)
  )

  if (supabase) {
    supabase.storage
      .from(BUCKET)
      .upload(`${playerId}.announce`, blob, { upsert: true })
      .then(({ error }) => {
        if (error) console.error('Supabase intro upload failed:', error)
      })
  }
}

export async function getAnnouncement(playerId: string): Promise<Blob | undefined> {
  const mem = memCache.get(annKey(playerId))
  if (mem) return mem

  try {
    const cached = await getCachedAudio(annKey(playerId))
    if (cached) {
      memCache.set(annKey(playerId), cached)
      return cached
    }
  } catch {
    // IndexedDB unavailable - fall through to Supabase
  }

  if (supabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(`${playerId}.announce`)

    if (!error && data) {
      memCache.set(annKey(playerId), data)
      cacheAudio(annKey(playerId), data).catch(() => {})
      return data
    }
  }

  return undefined
}

export async function deleteAnnouncement(playerId: string): Promise<void> {
  memCache.delete(annKey(playerId))
  deleteCachedAudio(annKey(playerId)).catch(() => {})

  if (supabase) {
    await supabase.storage
      .from(BUCKET)
      .remove([`${playerId}.announce`])
  }
}
