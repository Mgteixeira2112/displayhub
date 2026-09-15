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
}

type ProgramItemLike = {
  poster?: { layout_positions?: { background_video_url?: unknown } | null } | null
  smart_scene?: { config?: { hero?: { backgroundVideoUrl?: unknown } | null } | null } | null
  content?: { external_url?: unknown; signed_url?: unknown } | null
}

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

function prefetchAndroidProgramVideos(payload: unknown) {
  const bridge = (globalThis as typeof globalThis & { DisplayHubAndroid?: AndroidVideoBridge }).DisplayHubAndroid
  if (typeof bridge?.prefetchVideos !== 'function') return
  const urls = collectProgramVideoUrls(payload)
  if (!urls.length) return
  try {
    bridge.prefetchVideos(JSON.stringify(urls))
  } catch {
    // Native prefetch is an optimization; the web player must keep working without it.
  }
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

  if (response.ok && url.includes('/functions/v1/display-program')) {
    void response.clone().json()
      .then((payload) => prefetchAndroidProgramVideos(payload))
      .catch(() => undefined)
  }

  return response
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
