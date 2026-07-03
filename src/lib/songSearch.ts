// Free song sourcing via Apple's iTunes Search API: official 30-second
// preview clips of commercial tracks, no key, no login. Walk-up clips are
// 10-20s, so a 30s preview covers the whole use case.
//
// The search endpoint has no CORS headers, but officially supports JSONP
// (`callback=`), so search goes through a script tag. The preview audio CDN
// (audio-ssl.itunes.apple.com) sends `access-control-allow-origin: *`, so
// the picked clip is fetched straight to a Blob and flows into the same
// upload/trim machinery as a hand-picked MP3.

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

let jsonpCounter = 0

export function searchSongs(term: string, limit = 6): Promise<SongResult[]> {
  return new Promise((resolve, reject) => {
    const cbName = `__itunesSearchCb${++jsonpCounter}`
    const w = window as unknown as Record<string, unknown>
    const script = document.createElement('script')

    const cleanup = () => {
      delete w[cbName]
      script.remove()
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Song search timed out'))
    }, 10000)

    w[cbName] = (data: { results?: ItunesTrack[] }) => {
      clearTimeout(timer)
      cleanup()
      const results = (data.results ?? [])
        .filter((r): r is Required<Pick<ItunesTrack, 'previewUrl'>> & ItunesTrack => !!r.previewUrl)
        .map(r => ({
          trackName: r.trackName ?? 'Unknown track',
          artistName: r.artistName ?? 'Unknown artist',
          artworkUrl: r.artworkUrl60 ?? r.artworkUrl100 ?? '',
          previewUrl: r.previewUrl,
        }))
      resolve(results)
    }

    script.onerror = () => {
      clearTimeout(timer)
      cleanup()
      reject(new Error('Song search failed'))
    }
    script.src =
      `https://itunes.apple.com/search?media=music&entity=song&limit=${limit}` +
      `&term=${encodeURIComponent(term)}&callback=${cbName}`
    document.head.appendChild(script)
  })
}

export async function fetchPreviewBlob(previewUrl: string): Promise<Blob> {
  const resp = await fetch(previewUrl)
  if (!resp.ok) throw new Error(`Preview fetch failed (${resp.status})`)
  return await resp.blob()
}
