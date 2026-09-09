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

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(url, serviceKey, { auth: { persistSession: false } })

    const { data: display, error: displayError } = await db
      .from('displays')
      .select('id,name,location,orientation,resolution_width,resolution_height')
      .eq('public_token', token)
      .eq('is_active', true)
      .is('revoked_at', null)
      .maybeSingle()

    if (displayError) throw displayError
    if (!display) return json({ error: 'display_unavailable' }, 404)

    const now = new Date().toISOString()
    const { data: publications, error: pubError } = await db
      .from('display_publications')
      .select('id,playlist_id,starts_at,ends_at,repeat_mode,daily_start,daily_end,weekdays,created_at')
      .eq('display_id', display.id)
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('created_at', { ascending: false })

    if (pubError) throw pubError
    if (!publications?.length) return json({ display, publications: [] })

    const playlistIds = [...new Set(publications.map((row) => row.playlist_id))]
    const [{ data: playlists, error: playlistError }, { data: items, error: itemError }] = await Promise.all([
      db.from('playlists').select('id,name,is_active').in('id', playlistIds).eq('is_active', true),
      db.from('playlist_items').select('id,playlist_id,source_type,content_item_id,structured_content_id,template_id,position,duration_seconds').in('playlist_id', playlistIds).order('position'),
    ])
    if (playlistError) throw playlistError
    if (itemError) throw itemError

    const contentIds = [...new Set((items || []).map((row) => row.content_item_id).filter(Boolean))] as string[]
    const structuredIds = [...new Set((items || []).map((row) => row.structured_content_id).filter(Boolean))] as string[]
    const templateIds = [...new Set((items || []).map((row) => row.template_id).filter(Boolean))] as string[]

    const [contentRes, structuredRes, templateRes, rowRes] = await Promise.all([
      contentIds.length ? db.from('content_items').select('id,type,title,category,storage_path,provider,external_url,external_id').in('id', contentIds).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
      structuredIds.length ? db.from('structured_contents').select('id,kind,title,category,description,price,promo_price,qr_value').in('id', structuredIds).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
      templateIds.length ? db.from('display_templates').select('id,name,template_type').in('id', templateIds).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
      structuredIds.length ? db.from('structured_content_rows').select('id,content_id,title,category,description,price,promo_price,position').in('content_id', structuredIds).eq('is_active', true).order('position') : Promise.resolve({ data: [], error: null }),
    ])

    for (const result of [contentRes, structuredRes, templateRes, rowRes]) if (result.error) throw result.error

    const signedContent = await Promise.all((contentRes.data || []).map(async (content) => {
      if (content.type !== 'image' || !content.storage_path) return content
      const { data, error } = await db.storage.from('content-library').createSignedUrl(content.storage_path, 3600)
      if (error) throw error
      return { ...content, signed_url: data.signedUrl }
    }))

    const contentMap = new Map(signedContent.map((row) => [row.id, row]))
    const structuredMap = new Map((structuredRes.data || []).map((row) => [row.id, row]))
    const templateMap = new Map((templateRes.data || []).map((row) => [row.id, row]))
    const rowsByContent = new Map<string, unknown[]>()
    for (const row of rowRes.data || []) {
      const current = rowsByContent.get(row.content_id) || []
      current.push(row)
      rowsByContent.set(row.content_id, current)
    }

    const playlistMap = new Map((playlists || []).map((playlist) => [playlist.id, {
      id: playlist.id,
      name: playlist.name,
      items: (items || []).filter((item) => item.playlist_id === playlist.id).map((item) => ({
        id: item.id,
        position: item.position,
        duration_seconds: item.duration_seconds,
        source_type: item.source_type,
        template: item.template_id ? templateMap.get(item.template_id) || null : null,
        content: item.content_item_id ? contentMap.get(item.content_item_id) || null : null,
        structured: item.structured_content_id ? { ...(structuredMap.get(item.structured_content_id) || {}), rows: rowsByContent.get(item.structured_content_id) || [] } : null,
      })).filter((item) => item.content || item.structured),
    }]))

    return json({
      display,
      publications: publications.map((publication) => ({ ...publication, playlist: playlistMap.get(publication.playlist_id) || null })).filter((publication) => publication.playlist),
    })
  } catch (error) {
    console.error(error)
    return json({ error: 'internal_error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
