import { useCallback, useEffect, useMemo, useState } from 'react'
import { publicSupabase } from './lib/supabase'

type Display = { id: string; name: string; location: string | null; orientation: string; resolution_width: number; resolution_height: number }
type Template = { name: string; template_type: string }
type Content = { type: string; title: string; signed_url?: string; external_url?: string; external_id?: string }
type StructuredRow = { id: string; title: string; category: string | null; description: string | null; price: number | null; promo_price: number | null; position: number }
type Structured = { kind: string; title: string; category: string | null; description: string | null; price: number | null; promo_price: number | null; qr_value: string | null; rows: StructuredRow[] }
type Item = { id: string; position: number; duration_seconds: number; template: Template | null; content: Content | null; structured: Structured | null }
type Playlist = { id: string; name: string; items: Item[] }
type Publication = { id: string; repeat_mode: 'always' | 'daily'; daily_start: string | null; daily_end: string | null; weekdays: number[]; playlist: Playlist }
type Program = { display: Display; publications: Publication[] }

function publicationMatches(publication: Publication, now = new Date()) {
  if (publication.repeat_mode === 'always') return true
  if (!publication.weekdays.includes(now.getDay()) || !publication.daily_start || !publication.daily_end) return false
  const current = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = publication.daily_start.split(':').map(Number)
  const [eh, em] = publication.daily_end.split(':').map(Number)
  return current >= sh * 60 + sm && current < eh * 60 + em
}

function money(value: number | null) {
  return value == null ? null : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

export default function PublicPlayer({ token }: { token: string }) {
  const [program, setProgram] = useState<Program | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [itemIndex, setItemIndex] = useState(0)
  const [loadError, setLoadError] = useState(false)

  const loadProgram = useCallback(async () => {
    const { data, error } = await publicSupabase.functions.invoke('display-program', { body: { token } })
    if (error || !data?.display) {
      if ((error as { context?: { status?: number } })?.context?.status === 404 || data?.error === 'display_unavailable') setInvalid(true)
      else setLoadError(true)
      return
    }
    setInvalid(false)
    setLoadError(false)
    setProgram(data as Program)
    setItemIndex(0)
  }, [token])

  useEffect(() => {
    let active = true
    void loadProgram()

    const heartbeat = () => {
      if (active) void publicSupabase.rpc('heartbeat_display', { p_token: token })
    }
    heartbeat()

    const channel = publicSupabase
      .channel(`display:${token}`)
      .on('broadcast', { event: 'display_invalidated' }, () => { if (active) setInvalid(true) })
      .on('broadcast', { event: 'display_program_changed' }, () => { if (active) void loadProgram() })
      .subscribe()

    const heartbeatTimer = window.setInterval(heartbeat, 30000)
    const scheduleRefresh = window.setInterval(() => { if (active) void loadProgram() }, 60000)

    return () => {
      active = false
      window.clearInterval(heartbeatTimer)
      window.clearInterval(scheduleRefresh)
      void publicSupabase.removeChannel(channel)
    }
  }, [token, loadProgram])

  const publication = useMemo(() => program?.publications.find((row) => publicationMatches(row)) || null, [program])
  const items = publication?.playlist.items || []
  const item = items.length ? items[itemIndex % items.length] : null

  useEffect(() => {
    if (!item || items.length < 2) return
    const timer = window.setTimeout(() => setItemIndex((value) => (value + 1) % items.length), item.duration_seconds * 1000)
    return () => window.clearTimeout(timer)
  }, [item, items.length])

  useEffect(() => {
    if (!program || invalid) return
    void publicSupabase.rpc('report_display_state', {
      p_token: token,
      p_playlist_id: publication?.playlist.id ?? null,
      p_item_id: item?.id ?? null,
    })
  }, [token, program, invalid, publication?.playlist.id, item?.id])

  if (invalid) return <main className="public-display invalid-display"><div className="brand-mark">DH</div><h1>Display indisponível</h1><p>Este link foi revogado, desativado ou não existe.</p></main>
  if (loadError) return <main className="public-display invalid-display"><div className="brand-mark">DH</div><h1>Falha de conexão</h1><p>O player tentará carregar novamente automaticamente.</p></main>
  if (!program) return <main className="public-display"><div className="display-idle-card"><div className="brand-mark">DH</div><h1>Conectando display...</h1></div></main>
  if (!publication || !item) return <Idle display={program.display} />

  return <main className={`public-display player-screen player-${item.template?.template_type || 'default'}`}><ItemView item={item} display={program.display} /><div className="player-progress" key={item.id} style={{ animationDuration: `${item.duration_seconds}s` }} /></main>
}

function Idle({ display }: { display: Display }) {
  return <main className="public-display"><div className="display-idle-card"><div className="brand-mark">DH</div><p className="eyebrow">DisplayHub</p><h1>{display.name}</h1><p>{display.location || 'Local não informado'}</p><strong>Nenhuma programação ativa neste horário</strong></div></main>
}

function ItemView({ item, display }: { item: Item; display: Display }) {
  if (item.content?.type === 'image' && item.content.signed_url) {
    return item.template?.template_type === 'split_screen'
      ? <div className="split-layout"><div className="split-media"><img src={item.content.signed_url} alt={item.content.title} /></div><div className="split-copy"><p className="eyebrow">{display.name}</p><h1>{item.content.title}</h1><p>{display.location || 'DisplayHub'}</p></div></div>
      : <div className="fullscreen-media"><img src={item.content.signed_url} alt={item.content.title} /></div>
  }

  if (item.content?.type === 'youtube' && item.content.external_id) {
    return <div className="fullscreen-media"><iframe title={item.content.title} src={`https://www.youtube-nocookie.com/embed/${item.content.external_id}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1`} allow="autoplay; encrypted-media" /></div>
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
