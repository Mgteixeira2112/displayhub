import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const { token } = await req.json()
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return json({ error: 'invalid_token' }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const { data: display, error: displayError } = await db
      .from('displays')
      .select('id')
      .eq('public_token', token)
      .eq('is_active', true)
      .is('revoked_at', null)
      .maybeSingle()

    if (displayError) throw displayError
    if (!display) return json({ wall: null })

    const { data: memberships, error: membershipError } = await db
      .from('display_group_members')
      .select('group_id,row_index,column_index,crop_x,crop_y,crop_width,crop_height')
      .eq('display_id', display.id)

    if (membershipError) throw membershipError
    if (!memberships?.length) return json({ wall: null })

    const groupIds = memberships.map((row) => row.group_id)
    const { data: groups, error: groupError } = await db
      .from('display_groups')
      .select('id,name,mode,rows,columns,virtual_width,virtual_height,media_fit,updated_at')
      .in('id', groupIds)
      .in('mode', ['mirror', 'coordinated', 'video_wall'])
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (groupError) throw groupError
    const group = groups?.[0]
    if (!group || group.mode !== 'video_wall') return json({ wall: null })

    const membership = memberships.find((row) => row.group_id === group.id)
    if (!membership) return json({ wall: null })

    return json({
      wall: {
        group_id: group.id,
        group_name: group.name,
        rows: group.rows,
        columns: group.columns,
        virtual_width: group.virtual_width,
        virtual_height: group.virtual_height,
        media_fit: group.media_fit || 'cover',
        row_index: membership.row_index,
        column_index: membership.column_index,
        crop_x: membership.crop_x,
        crop_y: membership.crop_y,
        crop_width: membership.crop_width,
        crop_height: membership.crop_height,
      },
    })
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
