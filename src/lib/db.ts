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

// Public API — Supabase first, IndexedDB as cache/fallback

export async function saveAudio(playerId: string, blob: Blob): Promise<void> {
  // Save to local cache immediately
  await cacheAudio(playerId, blob)

  // Upload to Supabase Storage
  if (supabase) {
    await supabase.storage
      .from(BUCKET)
      .upload(`${playerId}.audio`, blob, { upsert: true })
  }
}

export async function getAudio(playerId: string): Promise<Blob | undefined> {
  // Try local cache first (fast, works offline)
  const cached = await getCachedAudio(playerId)
  if (cached) return cached

  // Fall back to Supabase Storage
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(`${playerId}.audio`)

    if (!error && data) {
      // Cache locally for next time
      await cacheAudio(playerId, data)
      return data
    }
  }

  return undefined
}

export async function deleteAudio(playerId: string): Promise<void> {
  await deleteCachedAudio(playerId)

  if (supabase) {
    await supabase.storage
      .from(BUCKET)
      .remove([`${playerId}.audio`])
  }
}
