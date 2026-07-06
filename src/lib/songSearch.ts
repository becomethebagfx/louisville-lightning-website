// Free song sourcing: official 30-second preview clips of commercial tracks,
// no key, no login. Walk-up clips are 10-20s, so a preview covers the use case.
//
// Reliability comes from a three-layer fallback chain (real iPhones on
// cellular hit content blockers and carrier-IP rate limits that desktop
// testing never sees):
//   1. Plain fetch() to Apple's iTunes Search API. The endpoint reflects the
//      request Origin in access-control-allow-origin, so CORS works.
//   2. JSONP script tag to the same API, for environments where fetch/CORS
//      fails (the API also officially supports `callback=`).
//   3. Deezer's search API via JSONP - a different provider on a different
//      domain, so it survives Apple rate-limiting a shared carrier IP.
// Both preview CDNs (audio-ssl.itunes.apple.com, *.dzcdn.net) send
// access-control-allow-origin: *, so the picked clip fetches straight to a
// Blob and flows into the same upload/trim machinery as a hand-picked MP3.

export interface SongResult {
  trackName: string
  artistName: string
  artworkUrl: string
  previewUrl: string
}

interface ItunesTrack {
  trackName?: string
  artistName?: string
  artworkUrl60?: string
  artworkUrl100?: string
  previewUrl?: string
}

interface DeezerTrack {
  title?: string
  artist?: { name?: string }
  album?: { cover_small?: string; cover?: string }
  preview?: string
}

const TIMEOUT_MS = 8000

function mapItunes(results: ItunesTrack[]): SongResult[] {
  return results
    .filter((r): r is Required<Pick<ItunesTrack, 'previewUrl'>> & ItunesTrack => !!r.previewUrl)
    .map(r => ({
      trackName: r.trackName ?? 'Unknown track',
      artistName: r.artistName ?? 'Unknown artist',
      artworkUrl: r.artworkUrl60 ?? r.artworkUrl100 ?? '',
      previewUrl: r.previewUrl,
    }))
}

function mapDeezer(results: DeezerTrack[]): SongResult[] {
  return results
    .filter((r): r is Required<Pick<DeezerTrack, 'preview'>> & DeezerTrack => !!r.preview)
    .map(r => ({
      trackName: r.title ?? 'Unknown track',
      artistName: r.artist?.name ?? 'Unknown artist',
      artworkUrl: r.album?.cover_small ?? r.album?.cover ?? '',
      previewUrl: r.preview,
    }))
}

const itunesUrl = (term: string, limit: number) =>
  `https://itunes.apple.com/search?media=music&entity=song&limit=${limit}` +
  `&term=${encodeURIComponent(term)}`

async function searchItunesFetch(term: string, limit: number): Promise<SongResult[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(itunesUrl(term, limit), { signal: controller.signal })
    if (!resp.ok) throw new Error(`iTunes search HTTP ${resp.status}`)
    const data = (await resp.json()) as { results?: ItunesTrack[] }
    return mapItunes(data.results ?? [])
  } finally {
    clearTimeout(timer)
  }
}

let jsonpCounter = 0

// Generic JSONP loader: resolves with whatever the callback receives.
function jsonp<T>(buildUrl: (cbName: string) => string): Promise<T> {
  return new Promise((resolve, reject) => {
    const cbName = `__songSearchCb${++jsonpCounter}`
    const w = window as unknown as Record<string, unknown>
    const script = document.createElement('script')

    const cleanup = () => {
      delete w[cbName]
      script.remove()
    }
    const timer = setTimeout(() => {
      // Leave a self-deleting shim behind: a response landing after the timeout
      // would otherwise throw a global ReferenceError calling the deleted
      // callback. The shim removes itself if the late response arrives, and a
      // grace-period timer removes it otherwise so it cannot leak on window.
      w[cbName] = () => { delete w[cbName] }
      script.remove()
      setTimeout(() => { delete w[cbName] }, 30000)
      reject(new Error('Song search timed out'))
    }, TIMEOUT_MS)

    w[cbName] = (data: T) => {
      clearTimeout(timer)
      cleanup()
      resolve(data)
    }
    script.onerror = () => {
      clearTimeout(timer)
      cleanup()
      reject(new Error('Song search script failed'))
    }
    script.src = buildUrl(cbName)
    document.head.appendChild(script)
  })
}

async function searchItunesJsonp(term: string, limit: number): Promise<SongResult[]> {
  const data = await jsonp<{ results?: ItunesTrack[] }>(
    cb => `${itunesUrl(term, limit)}&callback=${cb}`
  )
  return mapItunes(data.results ?? [])
}

async function searchDeezerJsonp(term: string, limit: number): Promise<SongResult[]> {
  const data = await jsonp<{ data?: DeezerTrack[] }>(
    cb =>
      `https://api.deezer.com/search?q=${encodeURIComponent(term)}` +
      `&limit=${limit}&output=jsonp&callback=${cb}`
  )
  return mapDeezer(data.data ?? [])
}

export async function searchSongs(term: string, limit = 6): Promise<SongResult[]> {
  const attempts = [
    () => searchItunesFetch(term, limit),
    () => searchItunesJsonp(term, limit),
    () => searchDeezerJsonp(term, limit),
  ]
  let lastError: unknown = new Error('Song search failed')
  for (const attempt of attempts) {
    try {
      const results = await attempt()
      // An empty result set from one provider is a valid answer only if the
      // provider actually responded; return it rather than cascading, since
      // "no matches" should read as no matches, not as an error.
      return results
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

export async function fetchPreviewBlob(previewUrl: string): Promise<Blob> {
  // Same flaky-cellular guard as search: without a timeout, a stalled clip
  // download leaves the import button spinning until the browser's own (long)
  // network timeout, with every result locked behind importingRef.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const resp = await fetch(previewUrl, { signal: controller.signal })
    if (!resp.ok) throw new Error(`Preview fetch failed (${resp.status})`)
    return await resp.blob()
  } finally {
    clearTimeout(timer)
  }
}
