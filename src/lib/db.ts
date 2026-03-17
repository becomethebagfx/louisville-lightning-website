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

// In-memory cache — preloaded on page mount so play() can grab blobs
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

// Public API — Supabase first, IndexedDB as cache/fallback

export function saveAudio(playerId: string, blob: Blob): void {
  memCache.set(playerId, blob)

  // Cache locally (non-blocking — don't let IndexedDB issues stall the UI)
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
    // IndexedDB unavailable (private browsing, etc.) — fall through to Supabase
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
