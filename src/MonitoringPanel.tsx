import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

type Props = { companyId: string }
type DisplayRow = {
  id: string
  name: string
  location: string | null
  is_active: boolean
  revoked_at: string | null
  last_seen_at: string | null
  active_playlist_id: string | null
  active_item_id: string | null
  active_state_at: string | null
}
type PlaylistRow = { id: string; name: string }
type ItemRow = { id: string; source_type: string; content_item_id: string | null; structured_content_id: string | null }
type EventRow = { id: string; display_id: string; event_type: string; playlist_id: string | null; created_at: string }

const eventLabels: Record<string, string> = {
  publication_created: 'Programação criada',
  publication_updated: 'Programação alterada',
  publication_deleted: 'Programação removida',
  playlist_changed: 'Playlist alterada',
}

export default function MonitoringPanel({ companyId }: Props) {
  const [displays, setDisplays] = useState<DisplayRow[]>([])
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [contentNames, setContentNames] = useState<Record<string, string>>({})
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [displayRes, playlistRes, itemRes, eventRes] = await Promise.all([
        supabase.from('displays').select('id,name,location,is_active,revoked_at,last_seen_at,active_playlist_id,active_item_id,active_state_at').eq('company_id', companyId).order('created_at'),
        supabase.from('playlists').select('id,name').eq('company_id', companyId),
        supabase.from('playlist_items').select('id,source_type,content_item_id,structured_content_id').eq('company_id', companyId),
        supabase.from('display_events').select('id,display_id,event_type,playlist_id,created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(30),
      ])
      for (const result of [displayRes, playlistRes, itemRes, eventRes]) if (result.error) throw result.error

      const nextItems = (itemRes.data || []) as ItemRow[]
      const contentIds = nextItems.map((row) => row.content_item_id).filter(Boolean) as string[]
      const structuredIds = nextItems.map((row) => row.structured_content_id).filter(Boolean) as string[]
      const [contentRes, structuredRes] = await Promise.all([
        contentIds.length ? supabase.from('content_items').select('id,title').in('id', contentIds) : Promise.resolve({ data: [], error: null }),
        structuredIds.length ? supabase.from('structured_contents').select('id,title').in('id', structuredIds) : Promise.resolve({ data: [], error: null }),
      ])
      if (contentRes.error) throw contentRes.error
      if (structuredRes.error) throw structuredRes.error

      const names: Record<string, string> = {}
      for (const row of contentRes.data || []) names[row.id] = row.title
      for (const row of structuredRes.data || []) names[row.id] = row.title

      setDisplays((displayRes.data || []) as DisplayRow[])
      setPlaylists((playlistRes.data || []) as PlaylistRow[])
      setItems(nextItems)
      setEvents((eventRes.data || []) as EventRow[])
      setContentNames(names)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a visão geral.')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 15000)
    return () => window.clearInterval(timer)
  }, [load])

  const playlistNames = useMemo(() => Object.fromEntries(playlists.map((row) => [row.id, row.name])), [playlists])
  const itemNames = useMemo(() => Object.fromEntries(items.map((row) => {
    const sourceId = row.content_item_id || row.structured_content_id
    return [row.id, sourceId ? contentNames[sourceId] || 'Conteúdo' : 'Conteúdo']
  })), [items, contentNames])
  const displayNames = useMemo(() => Object.fromEntries(displays.map((row) => [row.id, row.name])), [displays])

  const summary = useMemo(() => {
    const now = Date.now()
    let online = 0
    let offline = 0
    let revoked = 0
    let playing = 0

    for (const display of displays) {
      const isRevoked = !!display.revoked_at || !display.is_active
      if (isRevoked) {
        revoked += 1
        continue
      }
      const isOnline = !!display.last_seen_at && now - new Date(display.last_seen_at).getTime() < 90000
      if (isOnline) online += 1
      else offline += 1
      if (display.active_playlist_id) playing += 1
    }

    return { total: displays.length, online, offline, revoked, playing }
  }, [displays])

  return (
    <section className="operational-overview">
      <div className="overview-heading">
        <div>
          <p className="eyebrow">Operação em tempo real</p>
          <h1>Visão Geral</h1>
          <p>Acompanhe a saúde das telas e o que está sendo exibido agora.</p>
        </div>
        <button className="secondary-button compact" type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</button>
      </div>

      {error && <p className="form-message">{error}</p>}

      <div className="overview-stats" aria-label="Resumo dos displays">
        <article><span>Displays</span><strong>{summary.total}</strong></article>
        <article className="stat-online"><span>Online</span><strong>{summary.online}</strong></article>
        <article className="stat-offline"><span>Offline</span><strong>{summary.offline}</strong></article>
        <article className="stat-revoked"><span>Revogados</span><strong>{summary.revoked}</strong></article>
        <article><span>Em exibição</span><strong>{summary.playing}</strong></article>
      </div>

      <div className="overview-section-heading">
        <div>
          <p className="eyebrow">Displays</p>
          <h2>Monitoramento</h2>
        </div>
      </div>

      <div className="monitor-grid">
        {displays.length === 0 && <p className="empty-state">Nenhum display cadastrado.</p>}
        {displays.map((display) => {
          const revoked = !!display.revoked_at || !display.is_active
          const online = !revoked && !!display.last_seen_at && Date.now() - new Date(display.last_seen_at).getTime() < 90000
          return (
            <article className="monitor-card" key={display.id}>
              <div className="monitor-card-head"><strong>{display.name}</strong><span className={`monitor-badge ${online ? 'online' : revoked ? 'revoked' : 'offline'}`}>{revoked ? 'Revogado' : online ? 'Online' : 'Offline'}</span></div>
              <p>{display.location || 'Local não informado'}</p>
              <dl>
                <div><dt>Último sinal</dt><dd>{display.last_seen_at ? new Date(display.last_seen_at).toLocaleString('pt-BR') : 'Nunca'}</dd></div>
                <div><dt>Playlist atual</dt><dd>{display.active_playlist_id ? playlistNames[display.active_playlist_id] || 'Playlist' : 'Nenhuma'}</dd></div>
                <div><dt>Conteúdo atual</dt><dd>{display.active_item_id ? itemNames[display.active_item_id] || 'Conteúdo' : 'Nenhum'}</dd></div>
                <div><dt>Estado atualizado</dt><dd>{display.active_state_at ? new Date(display.active_state_at).toLocaleString('pt-BR') : '—'}</dd></div>
              </dl>
            </article>
          )
        })}
      </div>

      <div className="history-block overview-history">
        <div className="overview-section-heading">
          <div>
            <p className="eyebrow">Atividade</p>
            <h2>Histórico recente</h2>
          </div>
        </div>
        {events.length === 0 && <p className="empty-state">Nenhum evento registrado ainda. Novas alterações passam a aparecer aqui.</p>}
        <div className="history-list">
          {events.slice(0, 6).map((event) => <article key={event.id}><div><strong>{eventLabels[event.event_type] || event.event_type}</strong><span>{displayNames[event.display_id] || 'Display'}{event.playlist_id ? ` · ${playlistNames[event.playlist_id] || 'Playlist'}` : ''}</span></div><time>{new Date(event.created_at).toLocaleString('pt-BR')}</time></article>)}
        </div>
      </div>
    </section>
  )
}
