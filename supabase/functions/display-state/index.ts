import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const {
      token,
      playlist_id,
      item_id,
      group_id,
      session_id,
      expected_position_ms,
      actual_position_ms,
      sequence,
      buffering,
      measurement_kind,
    } = await req.json()

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
    let validGroupId: string | null = null
    let validSessionId: string | null = null

    if (playlist_id != null || item_id != null) {
      if (typeof playlist_id !== 'string' || typeof item_id !== 'string') return json({ error: 'invalid_state' }, 400)

      const { data: item, error: itemError } = await db
        .from('playlist_items')
        .select('id,playlist_id,company_id')
        .eq('id', item_id)
        .eq('playlist_id', playlist_id)
        .eq('company_id', display.company_id)
        .maybeSingle()
      if (itemError) throw itemError
      if (!item) return json({ error: 'invalid_state' }, 400)

      const { data: directPublication, error: directError } = await db
        .from('display_publications')
        .select('id')
        .eq('display_id', display.id)
        .eq('company_id', display.company_id)
        .eq('playlist_id', playlist_id)
        .eq('is_active', true)
        .maybeSingle()
      if (directError) throw directError

      if (!directPublication) {
        if (typeof group_id !== 'string') return json({ error: 'invalid_state' }, 400)

        const { data: membership, error: membershipError } = await db
          .from('display_group_members')
          .select('group_id')
          .eq('display_id', display.id)
          .eq('group_id', group_id)
          .eq('company_id', display.company_id)
          .maybeSingle()
        if (membershipError) throw membershipError
        if (!membership) return json({ error: 'invalid_state' }, 400)

        const { data: groupPublication, error: groupPublicationError } = await db
          .from('display_group_publications')
          .select('group_id')
          .eq('group_id', group_id)
          .eq('company_id', display.company_id)
          .eq('playlist_id', playlist_id)
          .eq('is_active', true)
          .maybeSingle()
        if (groupPublicationError) throw groupPublicationError
        if (!groupPublication) return json({ error: 'invalid_state' }, 400)

        validGroupId = group_id

        if (session_id != null) {
          if (typeof session_id !== 'string') return json({ error: 'invalid_state' }, 400)
          const { data: session, error: sessionError } = await db
            .from('display_group_sessions')
            .select('id,sequence')
            .eq('id', session_id)
            .eq('group_id', group_id)
            .eq('company_id', display.company_id)
            .eq('playlist_id', playlist_id)
            .maybeSingle()
          if (sessionError) throw sessionError
          if (!session) return json({ error: 'invalid_state' }, 400)
          validSessionId = session.id
        }
      }

      validPlaylistId = playlist_id
      validItemId = item_id
    }

    const now = new Date().toISOString()
    const { error: updateError } = await db
      .from('displays')
      .update({
        last_seen_at: now,
        active_playlist_id: validPlaylistId,
        active_item_id: validItemId,
        active_state_at: now,
      })
      .eq('id', display.id)
      .eq('company_id', display.company_id)

    if (updateError) throw updateError

    if (validGroupId && validSessionId && validPlaylistId && validItemId) {
      const expected = Number.isFinite(Number(expected_position_ms)) ? Math.max(0, Math.round(Number(expected_position_ms))) : 0
      const actual = Number.isFinite(Number(actual_position_ms)) ? Math.max(0, Math.round(Number(actual_position_ms))) : null
      const drift = actual == null ? null : actual - expected
      const seq = Number.isFinite(Number(sequence)) ? Math.max(0, Math.round(Number(sequence))) : 0
      const kind = measurement_kind === 'media' ? 'media' : 'clock'

      const { error: telemetryError } = await db
        .from('display_sync_states')
        .upsert({
          company_id: display.company_id,
          group_id: validGroupId,
          display_id: display.id,
          session_id: validSessionId,
          playlist_id: validPlaylistId,
          item_id: validItemId,
          expected_position_ms: expected,
          actual_position_ms: actual,
          drift_ms: drift,
          buffering: buffering === true,
          measurement_kind: kind,
          sequence: seq,
          reported_at: now,
        }, { onConflict: 'display_id' })
      if (telemetryError) throw telemetryError
    }

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
