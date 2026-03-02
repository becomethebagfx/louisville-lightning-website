const DB_NAME = 'lightning-walkup'
const DB_VERSION = 1
const AUDIO_STORE = 'audio'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(AUDIO_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveAudio(playerId: string, blob: Blob): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite')
    tx.objectStore(AUDIO_STORE).put(blob, playerId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAudio(playerId: string): Promise<Blob | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readonly')
    const request = tx.objectStore(AUDIO_STORE).get(playerId)
    request.onsuccess = () => resolve(request.result ?? undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function deleteAudio(playerId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite')
    tx.objectStore(AUDIO_STORE).delete(playerId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
