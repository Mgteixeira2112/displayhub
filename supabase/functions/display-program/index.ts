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
      .select('id,company_id,name,location,orientation,resolution_width,resolution_height')
      .eq('public_token', token)
      .eq('is_active', true)
      .is('revoked_at', null)
      .maybeSingle()

    if (displayError) throw displayError
    if (!display) return json({ error: 'display_unavailable' }, 404)

    const groupPublication = await getGroupPublication(db, display.id)
    let publications: Array<Record<string, unknown>> = []

    if (groupPublication) {
      publications = [groupPublication.publication]
    } else {
      const now = new Date().toISOString()
      const { data, error: pubError } = await db
        .from('display_publications')
        .select('id,playlist_id,starts_at,ends_at,repeat_mode,daily_start,daily_end,weekdays,created_at')
        .eq('display_id', display.id)
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('created_at', { ascending: false })

      if (pubError) throw pubError
      publications = data || []
    }

    if (!publications.length) return json({ display, publications: [], group_mode: groupPublication?.mode ?? null, group_id: groupPublication?.groupId ?? null, sync_session: null, group_launch: null })

    const playlistIds = [...new Set(publications.map((row) => String(row.playlist_id)))]
    const [{ data: playlists, error: playlistError }, { data: items, error: itemError }] = await Promise.all([
      db.from('playlists').select('id,name,is_active,transition_type,transition_duration_ms').in('id', playlistIds).eq('is_active', true),
      db.from('playlist_items').select('id,playlist_id,source_type,content_item_id,structured_content_id,promotion_poster_id,template_id,position,duration_seconds,duration_mode').in('playlist_id', playlistIds).order('position'),
    ])
    if (playlistError) throw playlistError
    if (itemError) throw itemError

    const contentIds = [...new Set((items || []).map((row) => row.content_item_id).filter(Boolean))] as string[]
    const structuredIds = [...new Set((items || []).map((row) => row.structured_content_id).filter(Boolean))] as string[]
    const promotionPosterIds = [...new Set((items || []).map((row) => row.promotion_poster_id).filter(Boolean))] as string[]
    const templateIds = [...new Set((items || []).map((row) => row.template_id).filter(Boolean))] as string[]

    const [contentRes, structuredRes, templateRes, rowRes, posterRes] = await Promise.all([
      contentIds.length ? db.from('content_items').select('id,type,title,category,storage_path,provider,external_url,external_id').in('id', contentIds).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
      structuredIds.length ? db.from('structured_contents').select('id,kind,title,category,description,price,promo_price,qr_value').in('id', structuredIds).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
      templateIds.length ? db.from('display_templates').select('id,name,template_type').in('id', templateIds).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
      structuredIds.length ? db.from('structured_content_rows').select('id,content_id,title,category,description,price,promo_price,position').in('content_id', structuredIds).eq('is_active', true).order('position') : Promise.resolve({ data: [], error: null }),
      promotionPosterIds.length ? db.from('promotion_posters').select('id,template_key,product_name,price,unit,headline,footer,orientation,layout_positions').in('id', promotionPosterIds).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
    ])

    for (const result of [contentRes, structuredRes, templateRes, rowRes, posterRes]) if (result.error) throw result.error

    const posterTemplateKeys = [...new Set((posterRes.data || []).map((row) => row.template_key).filter(Boolean))] as string[]
    const { data: posterTemplates, error: posterTemplateError } = posterTemplateKeys.length
      ? await db.from('promotion_templates').select('key,theme').in('key', posterTemplateKeys).eq('is_active', true)
      : { data: [], error: null }
    if (posterTemplateError) throw posterTemplateError

    const signedContent = await Promise.all((contentRes.data || []).map(async (content) => {
      if (content.type !== 'image' || !content.storage_path) return content
      const { data, error } = await db.storage.from('content-library').createSignedUrl(content.storage_path, 3600)
      if (error) throw error
      return { ...content, signed_url: data.signedUrl }
    }))

    const contentMap = new Map(signedContent.map((row) => [row.id, row]))
    const structuredMap = new Map((structuredRes.data || []).map((row) => [row.id, row]))
    const templateMap = new Map((templateRes.data || []).map((row) => [row.id, row]))
    const posterThemeMap = new Map((posterTemplates || []).map((row) => [row.key, row.theme]))
    const posterMap = new Map((posterRes.data || []).map((row) => [row.id, { ...row, price: Number(row.price), theme: posterThemeMap.get(row.template_key) || 'hot_red' }]))
    const rowsByContent = new Map<string, unknown[]>()
    for (const row of rowRes.data || []) {
      const current = rowsByContent.get(row.content_id) || []
      current.push(row)
      rowsByContent.set(row.content_id, current)
    }

    const playlistMap = new Map((playlists || []).map((playlist) => [playlist.id, {
      id: playlist.id,
      name: playlist.name,
      transition_type: playlist.transition_type || 'fade',
      transition_duration_ms: Number(playlist.transition_duration_ms ?? 600),
      items: (items || []).filter((item) => item.playlist_id === playlist.id).map((item) => ({
        id: item.id,
        position: item.position,
        duration_seconds: item.duration_seconds,
        duration_mode: item.duration_mode || 'fixed',
        source_type: item.source_type,
        template: item.template_id ? templateMap.get(item.template_id) || null : null,
        content: item.content_item_id ? contentMap.get(item.content_item_id) || null : null,
        structured: item.structured_content_id ? { ...(structuredMap.get(item.structured_content_id) || {}), rows: rowsByContent.get(item.structured_content_id) || [] } : null,
        poster: item.promotion_poster_id ? posterMap.get(item.promotion_poster_id) || null : null,
      })).filter((item) => item.content || item.structured || item.poster),
    }]))

    const syncSession = groupPublication?.mode === 'video_wall'
      ? await getOrCreateSyncSession(db, display.company_id, groupPublication.groupId, String(groupPublication.publication.playlist_id))
      : null
    const groupLaunch = groupPublication && ['video_wall', 'coordinated'].includes(groupPublication.mode)
      ? await getGroupLaunch(db, display.company_id, groupPublication.groupId, groupPublication.mode === 'video_wall' ? String(groupPublication.publication.playlist_id) : null)
      : null

    return json({
      display,
      publications: publications.map((publication) => ({ ...publication, playlist: playlistMap.get(String(publication.playlist_id)) || null })).filter((publication) => publication.playlist),
      group_mode: groupPublication?.mode ?? null,
      group_id: groupPublication?.groupId ?? null,
      sync_session: syncSession,
      group_launch: groupLaunch,
    })
  } catch (error) {
    console.error(error)
    return json({ error: 'internal_error' }, 500)
  }
})

async function getGroupPublication(db: ReturnType<typeof createClient>, displayId: string) {
  const { data: memberships, error: memberError } = await db
    .from('display_group_members')
    .select('group_id')
    .eq('display_id', displayId)

  if (memberError) throw memberError
  if (!memberships?.length) return null

  const groupIds = memberships.map((row) => row.group_id)
  const { data: groups, error: groupError } = await db
    .from('display_groups')
    .select('id,mode,updated_at')
    .in('id', groupIds)
    .in('mode', ['mirror', 'coordinated', 'video_wall'])
    .eq('is_active', true)
    .order('updated_at', { ascending: false })

  if (groupError) throw groupError
  if (!groups?.length) return null

  for (const group of groups) {
    if (group.mode === 'coordinated') {
      const { data: publication, error: publicationError } = await db
        .from('display_publications')
        .select('id,playlist_id,starts_at,ends_at,repeat_mode,daily_start,daily_end,weekdays,created_at')
        .eq('group_id', group.id)
        .eq('display_id', displayId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (publicationError) throw publicationError
      if (!publication) continue

      return {
        groupId: group.id,
        mode: group.mode,
        publication: { ...publication, group_id: group.id },
      }
    }

    const { data: publication, error: publicationError } = await db
      .from('display_group_publications')
      .select('id,playlist_id,created_at')
      .eq('group_id', group.id)
      .eq('is_active', true)
      .maybeSingle()

    if (publicationError) throw publicationError
    if (!publication) continue

    return {
      groupId: group.id,
      mode: group.mode,
      publication: {
        id: publication.id,
        playlist_id: publication.playlist_id,
        starts_at: null,
        ends_at: null,
        repeat_mode: 'always',
        daily_start: null,
        daily_end: null,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        created_at: publication.created_at,
        group_id: group.id,
      },
    }
  }

  return null
}

async function getGroupLaunch(db: ReturnType<typeof createClient>, companyId: string, groupId: string, playlistId: string | null) {
  let query = db
    .from('display_group_launches')
    .select('id,playlist_id,status,sequence,requested_at,start_at,updated_at')
    .eq('company_id', companyId)
    .eq('group_id', groupId)

  if (playlistId) query = query.eq('playlist_id', playlistId)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data || null
}

async function getOrCreateSyncSession(db: ReturnType<typeof createClient>, companyId: string, groupId: string, playlistId: string) {
  const { data: existing, error: existingError } = await db
    .from('display_group_sessions')
    .select('id,playlist_id,playback_state,started_at,paused_position_ms,sequence')
    .eq('group_id', groupId)
    .maybeSingle()

  if (existingError) throw existingError

  if (existing && existing.playlist_id === playlistId) return existing

  if (existing) {
    const { data, error } = await db
      .from('display_group_sessions')
      .update({ playlist_id: playlistId, playback_state: 'playing', started_at: new Date().toISOString(), paused_position_ms: 0, sequence: Number(existing.sequence) + 1 })
      .eq('id', existing.id)
      .select('id,playlist_id,playback_state,started_at,paused_position_ms,sequence')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await db
    .from('display_group_sessions')
    .insert({ company_id: companyId, group_id: groupId, playlist_id: playlistId, playback_state: 'playing' })
    .select('id,playlist_id,playback_state,started_at,paused_position_ms,sequence')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: raced, error: racedError } = await db
        .from('display_group_sessions')
        .select('id,playlist_id,playback_state,started_at,paused_position_ms,sequence')
        .eq('group_id', groupId)
        .single()
      if (racedError) throw racedError
      return raced
    }
    throw error
  }

  return data
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}