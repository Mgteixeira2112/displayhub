import { createClient } from '@supabase/supabase-js'
import { notifyDataChanged } from './dataRefresh'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('DisplayHub Supabase environment variables are not configured.')
}

const nativeFetch = globalThis.fetch.bind(globalThis)

async function appFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await nativeFetch(input, init)
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const isRestWrite = url.includes('/rest/v1/') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)

  if (response.ok && isRestWrite) {
    queueMicrotask(() => notifyDataChanged('all'))
  }

  return response
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: { fetch: appFetch },
})

export const publicSupabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
