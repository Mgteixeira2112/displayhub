import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { publicSupabase } from './lib/supabase'

type Display = { id: string; name: string; location: string | null; orientation: string; resolution_width: number; resolution_height: number }
type Template = { name: string; template_type: string }
type Content = { type: string; title: string; signed_url?: string; external_url?: string; external_id?: string }
type StructuredRow = { id: string; title: string; category: string | null; description: string | null; price: number | null; promo_price: number | null; position: number }
type Structured = { kind: string; title: string; category: string | null; description: string | null; price: number | null; promo_price: number | null; qr_value: string | null; rows: StructuredRow[] }
type Item = { id: string; position: number; duration_seconds: number; template: Template | null; content: Content | null; structured: Structured | null }
type Playlist = { id: string; name: string; items: Item[] }
type Publication = { id: string; repeat_mode: 'always' | 'daily'; daily_start: string | null; daily_end: string | null; weekdays: number[]; playlist: Playlist }
type SyncSession = { id: string; playlist_id: string; playback_state: 'playing' | 'paused' | 'stopped'; started_at: string; paused_position_ms: number; sequence: number }
type Program = { display: Display; publications: Publication[]; group_mode?: string | null; group_id?: string | null; sync_session?: SyncSession | null }
type WallContext = { group_id: string; group_name: string; rows: number; columns: number; virtual_width: number | null; virtual_height: number | null; row_index: number; column_index: number }
type SyncCursor = { index: number; offsetSeconds: number; remainingMs: number; sequence: number }

function publicationMatches(publication: Publication, now = new Date()) {
  if (publication.repeat_mode === 'always') return true
  if (!publication.weekdays.includes(now.getDay()) || !publication.daily_start || !publication.daily_end) return false
  const current = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = publication.daily_start.split(':').map(Number)
  const [eh, em] = publication.daily_end.split(':').map(Number)
  return current >= sh * 60 + sm && current < eh * 60 + em
}

function resolveSyncCursor(items: Item[], session: SyncSession): SyncCursor | null {
  if (!items.length || session.playback_state === 'stopped') return null
  const durations = items.map((item) => Math.max(1, item.duration_seconds) * 1000)
  const cycleMs = durations.reduce((sum, duration) => sum + duration, 0)
  if (!cycleMs) return null

  const rawElapsed = session.playback_state === 'paused'
    ? Number(session.paused_position_ms || 0)
    : Math.max(0, Date.now() - new Date(session.started_at).getTime())
  let positionMs = rawElapsed % cycleMs

  for (let index = 0; index < durations.length; index += 1) {
    const durationMs = durations[index]
    if (positionMs < durationMs) {
      return {
        index,
        offsetSeconds: positionMs / 1000,
        remainingMs: Math.max(50, durationMs - positionMs),
        sequence: session.sequence,
      }
    }
    positionMs -= durationMs
  }

  return { index: 0, offsetSeconds: 0, remainingMs: durations[0], sequence: session.sequence }
}

function money(value: number | null) {
  return value == null ? null : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

export default function PublicPlayer({ token }: { token: string }) {
  const [program, setProgram] = useState<Program | null>(null)
  const [wall, setWall] = useState<WallContext | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [itemIndex, setItemIndex] = useState(0)
  const [syncCursor, setSyncCursor] = useState<SyncCursor | null>(null)
  const [loadError, setLoadError] = useState(false)

  const loadProgram = useCallback(async () => {
    const [programRes, wallRes] = await Promise.all([
      publicSupabase.functions.invoke('display-program', { body: { token } }),
      publicSupabase.functions.invoke('display-wall-context', { body: { token } }),
    ])
    const { data, error } = programRes
    if (error || !data?.display) {
      if ((error as { context?: { status?: number } })?.context?.status === 404 || data?.error === 'display_unavailable') setInvalid(true)
      else setLoadError(true)
      return
    }
    setInvalid(false)
    setLoadError(false)
    setProgram(data as Program)
    setWall((wallRes.data?.wall || null) as WallContext | null)
    setItemIndex(0)
  }, [token])

  useEffect(() => {
    let active = true
    void loadProgram()

    const channel = publicSupabase
      .channel(`display:${token}`)
      .on('broadcast', { event: 'display_invalidated' }, () => { if (active) setInvalid(true) })
      .on('broadcast', { event: 'display_program_changed' }, () => { if (active) void loadProgram() })
      .subscribe()

    const scheduleRefresh = window.setInterval(() => { if (active) void loadProgram() }, 60000)

    return () => {
      active = false
      window.clearInterval(scheduleRefresh)
      void publicSupabase.removeChannel(channel)
    }
  }, [token, loadProgram])

  const publication = useMemo(() => program?.publications.find((row) => publicationMatches(row)) || null, [program])
  const items = publication?.playlist.items || []
  const syncSession = program?.group_mode === 'video_wall' ? program.sync_session || null : null

  useEffect(() => {
    if (!syncSession || !items.length) {
      setSyncCursor(null)
      return
    }

    const align = () => {
      const next = resolveSyncCursor(items, syncSession)
      setSyncCursor(next)
      return next
    }

    const current = align()
    if (!current || syncSession.playback_state !== 'playing') return

    let timer = window.setTimeout(function realign() {
      const next = align()
      if (next && syncSession.playback_state === 'playing') timer = window.setTimeout(realign, next.remainingMs)
    }, current.remainingMs)

    return () => window.clearTimeout(timer)
  }, [items, syncSession])

  const effectiveIndex = syncCursor ? syncCursor.index : itemIndex
  const item = items.length ? items[effectiveIndex % items.length] : null

  useEffect(() => {
    if (syncSession || !item || items.length < 2) return
    const timer = window.setTimeout(() => setItemIndex((value) => (value + 1) % items.length), item.duration_seconds * 1000)
    return () => window.clearTimeout(timer)
  }, [item, items.length, syncSession])

  useEffect(() => {
    if (!program || invalid) return
    const report = () => {
      void publicSupabase.functions.invoke('display-state', {
        body: { token, playlist_id: publication?.playlist.id ?? null, item_id: item?.id ?? null },
      })
    }
    report()
    const timer = window.setInterval(report, 30000)
    return () => window.clearInterval(timer)
  }, [token, program, invalid, publication?.playlist.id, item?.id])

  if (invalid) return <main className="public-display invalid-display"><div className="brand-mark">DH</div><h1>Display indisponível</h1><p>Este link foi revogado, desativado ou não existe.</p></main>
  if (loadError) return <main className="public-display invalid-display"><div className="brand-mark">DH</div><h1>Falha de conexão</h1><p>O player tentará carregar novamente automaticamente.</p></main>
  if (!program) return <main className="public-display"><div className="display-idle-card"><div className="brand-mark">DH</div><h1>Conectando display...</h1></div></main>
  if (!publication || !item) return <Idle display={program.display} />

  const offsetSeconds = syncCursor?.offsetSeconds || 0
  const content = <ItemView item={item} display={program.display} startSeconds={offsetSeconds} syncKey={syncCursor ? `${syncCursor.sequence}:${item.id}` : item.id} />
  const progressDuration = syncCursor ? Math.max(0.05, syncCursor.remainingMs / 1000) : item.duration_seconds

  return (
    <main className={`public-display player-screen player-${item.template?.template_type || 'default'} ${wall ? 'video-wall-screen' : ''}`}>
      {wall ? <WallViewport wall={wall}>{content}</WallViewport> : content}
      <div className="player-progress" key={`${item.id}:${syncCursor?.sequence || 0}:${Math.floor(offsetSeconds * 10)}`} style={{ animationDuration: `${progressDuration}s` }} />
    </main>
  )
}

function WallViewport({ wall, children }: { wall: WallContext; children: ReactNode }) {
  const width = wall.columns * 100
  const height = wall.rows * 100
  const x = -(wall.column_index * (100 / wall.columns))
  const y = -(wall.row_index * (100 / wall.rows))

  return (
    <div className="wall-viewport" data-wall={wall.group_name}>
      <div className="wall-surface" style={{ width: `${width}%`, height: `${height}%`, transform: `translate(${x}%, ${y}%)` }}>
        {children}
      </div>
    </div>
  )
}

function Idle({ display }: { display: Display }) {
  return <main className="public-display"><div className="display-idle-card"><div className="brand-mark">DH</div><p className="eyebrow">DisplayHub</p><h1>{display.name}</h1><p>{display.location || 'Local não informado'}</p><strong>Nenhuma programação ativa neste horário</strong></div></main>
}

function ItemView({ item, display, startSeconds, syncKey }: { item: Item; display: Display; startSeconds: number; syncKey: string }) {
  if (item.content?.type === 'image' && item.content.signed_url) {
    return item.template?.template_type === 'split_screen'
      ? <div className="split-layout"><div className="split-media"><img src={item.content.signed_url} alt={item.content.title} /></div><div className="split-copy"><p className="eyebrow">{display.name}</p><h1>{item.content.title}</h1><p>{display.location || 'DisplayHub'}</p></div></div>
      : <div className="fullscreen-media"><img src={item.content.signed_url} alt={item.content.title} /></div>
  }

  if (item.content?.type === 'youtube' && item.content.external_id) {
    const start = Math.max(0, Math.floor(startSeconds))
    return <div className="fullscreen-media"><iframe key={syncKey} title={item.content.title} src={`https://www.youtube-nocookie.com/embed/${item.content.external_id}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&start=${start}`} allow="autoplay; encrypted-media" /></div>
  }

  const content = item.structured
  if (!content) return <div className="text-template"><h1>Conteúdo indisponível</h1></div>

  if (content.kind === 'menu' || content.kind === 'price_table') {
    return <div className="menu-template"><header><p className="eyebrow">{display.name}</p><h1>{content.title}</h1>{content.description && <p>{content.description}</p>}</header><div className="menu-rows">{content.rows.map((row) => <div className="menu-row" key={row.id}><div><strong>{row.title}</strong>{row.description && <small>{row.description}</small>}</div><div className="menu-price">{row.promo_price != null && <del>{money(row.price)}</del>}<strong>{money(row.promo_price ?? row.price)}</strong></div></div>)}</div></div>
  }

  if (content.kind === 'product') {
    return <div className="product-template"><p className="eyebrow">{content.category || 'Destaque'}</p><h1>{content.title}</h1>{content.description && <p>{content.description}</p>}<div className="hero-price">{content.promo_price != null && <del>{money(content.price)}</del>}<strong>{money(content.promo_price ?? content.price)}</strong></div></div>
  }

  return <div className="text-template"><p className="eyebrow">{content.kind === 'qr' ? 'QR / Link' : 'Aviso'}</p><h1>{content.title}</h1><p>{content.description || content.qr_value || ''}</p></div>
}
