import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const { token, playlist_id, item_id } = await req.json()
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return json({ error: 'invalid_token' }, 400)

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(url, serviceKey, { auth: { persistSession: false } })

    const { data: display, error: displayError } = await db
      .from('displays')
      .select('id,company_id')
      .eq('public_token', token)
      .eq('is_active', true)
      .is('revoked_at', null)
      .maybeSingle()

    if (displayError) throw displayError
    if (!display) return json({ error: 'display_unavailable' }, 404)

    let validPlaylistId: string | null = null
    let validItemId: string | null = null

    if (playlist_id != null || item_id != null) {
      if (typeof playlist_id !== 'string' || typeof item_id !== 'string') return json({ error: 'invalid_state' }, 400)

      const { data: relation, error: relationError } = await db
        .from('display_publications')
        .select('playlist_id,playlists!inner(id,is_active,playlist_items!inner(id))')
        .eq('display_id', display.id)
        .eq('company_id', display.company_id)
        .eq('playlist_id', playlist_id)
        .eq('is_active', true)
        .eq('playlists.is_active', true)
        .eq('playlists.playlist_items.id', item_id)
        .maybeSingle()

      if (relationError) throw relationError
      if (!relation) return json({ error: 'invalid_state' }, 400)
      validPlaylistId = playlist_id
      validItemId = item_id
    }

    const { error: updateError } = await db
      .from('displays')
      .update({
        last_seen_at: new Date().toISOString(),
        active_playlist_id: validPlaylistId,
        active_item_id: validItemId,
        active_state_at: new Date().toISOString(),
      })
      .eq('id', display.id)
      .eq('company_id', display.company_id)

    if (updateError) throw updateError
    return json({ ok: true })
  } catch (error) {
    console.error(error)
    return json({ error: 'internal_error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
