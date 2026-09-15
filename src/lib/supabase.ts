import { createClient } from '@supabase/supabase-js'
import { notifyDataChanged } from './dataRefresh'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('DisplayHub Supabase environment variables are not configured.')
}

const nativeFetch = globalThis.fetch.bind(globalThis)

type AndroidVideoBridge = {
  prefetchVideos?: (urlsJson: string) => string
  videoCacheStatus?: (urlsJson: string) => string
}

type CacheSnapshot = {
  total?: number
  ready?: number
  downloading?: number
  failed?: number
  missing?: number
}

type ProgramItemLike = {
  poster?: { layout_positions?: { background_video_url?: unknown } | null } | null
  smart_scene?: { config?: { hero?: { backgroundVideoUrl?: unknown } | null } | null } | null
  content?: { external_url?: unknown; signed_url?: unknown } | null
}

const lastReadyPrograms = new Map<string, unknown>()
const SILENT_GATE_ID = 'displayhub-android-silent-gate'

function directVideoUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const url = value.trim()
  if (!/^https?:\/\//i.test(url)) return null
  return /\.(mp4|m4v|webm)(?:[?#]|$)/i.test(url) ? url : null
}

function collectProgramVideoUrls(payload: unknown) {
  if (!payload || typeof payload !== 'object') return []
  const publications = (payload as { publications?: unknown }).publications
  if (!Array.isArray(publications)) return []

  const urls = new Set<string>()
  const add = (value: unknown) => {
    const url = directVideoUrl(value)
    if (url) urls.add(url)
  }

  for (const publication of publications) {
    if (!publication || typeof publication !== 'object') continue
    const playlist = (publication as { playlist?: { items?: unknown } | null }).playlist
    if (!playlist || !Array.isArray(playlist.items)) continue
    for (const rawItem of playlist.items) {
      if (!rawItem || typeof rawItem !== 'object') continue
      const item = rawItem as ProgramItemLike
      add(item.poster?.layout_positions?.background_video_url)
      add(item.smart_scene?.config?.hero?.backgroundVideoUrl)
      add(item.content?.external_url)
      add(item.content?.signed_url)
    }
  }

  return Array.from(urls)
}

function programDisplayId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const display = (payload as { display?: { id?: unknown } | null }).display
  return typeof display?.id === 'string' && display.id ? display.id : null
}

function parseCacheSnapshot(raw: string | undefined): CacheSnapshot | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CacheSnapshot
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function androidProgramCacheState(payload: unknown) {
  const bridge = (globalThis as typeof globalThis & { DisplayHubAndroid?: AndroidVideoBridge }).DisplayHubAndroid
  if (typeof bridge?.prefetchVideos !== 'function' || typeof bridge.videoCacheStatus !== 'function') return null

  const urls = collectProgramVideoUrls(payload)
  if (!urls.length) return { ready: true, urls }

  try {
    bridge.prefetchVideos(JSON.stringify(urls))
    const snapshot = parseCacheSnapshot(bridge.videoCacheStatus(JSON.stringify(urls)))
    if (!snapshot) return null
    const total = Number(snapshot.total || 0)
    const ready = Number(snapshot.ready || 0)
    const failed = Number(snapshot.failed || 0)
    return { ready: total === urls.length && ready === total && failed === 0, urls }
  } catch {
    return null
  }
}

function responseWithPayload(response: Response, payload: unknown) {
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  return new Response(JSON.stringify(payload), {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function silentPreparingProgram(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  return {
    ...(payload as Record<string, unknown>),
    publications: [],
  }
}

function setAndroidSilentGate(active: boolean) {
  if (typeof document === 'undefined') return
  const existing = document.getElementById(SILENT_GATE_ID)
  if (!active) {
    existing?.remove()
    return
  }
  if (existing) return

  const gate = document.createElement('div')
  gate.id = SILENT_GATE_ID
  gate.setAttribute('aria-hidden', 'true')
  Object.assign(gate.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    background: '#000',
    pointerEvents: 'none',
  })
  ;(document.body || document.documentElement).appendChild(gate)
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
}

async function appFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await nativeFetch(input, init)
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const url = requestUrl(input)
  const isRestWrite = url.includes('/rest/v1/') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)

  if (response.ok && isRestWrite) {
    queueMicrotask(() => notifyDataChanged('all'))
  }

  return response
}

async function publicAppFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await nativeFetch(input, init)
  const url = requestUrl(input)

  if (!response.ok || !url.includes('/functions/v1/display-program')) return response

  try {
    const payload = await response.clone().json()
    const displayId = programDisplayId(payload)
    if (!displayId) return response

    const cacheState = androidProgramCacheState(payload)
    if (!cacheState) return response

    if (cacheState.ready) {
      lastReadyPrograms.set(displayId, payload)
      setAndroidSilentGate(false)
      return response
    }

    const previousReadyProgram = lastReadyPrograms.get(displayId)
    if (previousReadyProgram) {
      setAndroidSilentGate(false)
      return responseWithPayload(response, previousReadyProgram)
    }

    setAndroidSilentGate(true)
    return responseWithPayload(response, silentPreparingProgram(payload))
  } catch {
    return response
  }
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: { fetch: appFetch },
})

export const publicSupabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: { fetch: publicAppFetch },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
