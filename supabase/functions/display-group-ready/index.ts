import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const { token, launch_id, ready, provider, detail } = await req.json()
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return json({ error: 'invalid_token' }, 400)
    if (typeof launch_id !== 'string' || typeof ready !== 'boolean') return json({ error: 'invalid_payload' }, 400)

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

    const { data: launch, error: launchError } = await db
      .from('display_group_launches')
      .select('id,group_id,company_id,status')
      .eq('id', launch_id)
      .eq('company_id', display.company_id)
      .maybeSingle()
    if (launchError) throw launchError
    if (!launch || !['preparing', 'armed'].includes(launch.status)) return json({ error: 'launch_unavailable' }, 404)

    const { data: membership, error: membershipError } = await db
      .from('display_group_members')
      .select('id')
      .eq('group_id', launch.group_id)
      .eq('display_id', display.id)
      .eq('company_id', display.company_id)
      .maybeSingle()
    if (membershipError) throw membershipError
    if (!membership) return json({ error: 'not_group_member' }, 403)

    const now = new Date().toISOString()
    const { error: upsertError } = await db
      .from('display_group_ready_states')
      .upsert({
        company_id: display.company_id,
        launch_id: launch.id,
        group_id: launch.group_id,
        display_id: display.id,
        ready,
        provider: typeof provider === 'string' ? provider.slice(0, 40) : null,
        detail: typeof detail === 'string' ? detail.slice(0, 240) : null,
        ready_at: ready ? now : null,
        reported_at: now,
      }, { onConflict: 'launch_id,display_id' })
    if (upsertError) throw upsertError

    return json({ ok: true, ready })
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
