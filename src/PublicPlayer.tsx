import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { publicSupabase } from './lib/supabase'
import YouTubeSyncPlayer, { type MediaFit, type YouTubeController } from './YouTubeSyncPlayer'
import HlsSyncPlayer, { type HlsMediaSample } from './HlsSyncPlayer'
import PromotionPosterView, { type PromotionPosterData } from './PromotionPosterView'

type Display = { id: string; name: string; location: string | null; orientation: string; resolution_width: number; resolution_height: number }
type Template = { name: string; template_type: string }
type Content = { type: string; title: string; signed_url?: string; external_url?: string; external_id?: string }
type StructuredRow = { id: string; title: string; category: string | null; description: string | null; price: number | null; promo_price: number | null; position: number }
type Structured = { kind: string; title: string; category: string | null; description: string | null; price: number | null; promo_price: number | null; qr_value: string | null; rows: StructuredRow[] }
type Item = { id: string; position: number; duration_seconds: number; template: Template | null; content: Content | null; structured: Structured | null; poster: PromotionPosterData | null }
type TransitionType = 'none' | 'fade' | 'slide_left' | 'slide_up' | 'zoom'
type Playlist = { id: string; name: string; transition_type: TransitionType; transition_duration_ms: number; items: Item[] }
type Publication = { id: string; repeat_mode: 'always' | 'daily'; daily_start: string | null; daily_end: string | null; weekdays: number[]; playlist: Playlist }
type SyncSession = { id: string; playlist_id: string; playback_state: 'playing' | 'paused' | 'stopped'; started_at: string; paused_position_ms: number; sequence: number }
type GroupLaunch = { id: string; playlist_id: string; status: 'preparing' | 'armed' | 'started' | 'cancelled'; sequence: number; requested_at: string; start_at: string | null; updated_at: string }
type Program = { display: Display; publications: Publication[]; group_mode?: string | null; group_id?: string | null; sync_session?: SyncSession | null; group_launch?: GroupLaunch | null }
type WallContext = { group_id: string; group_name: string; rows: number; columns: number; virtual_width: number | null; virtual_height: number | null; media_fit: MediaFit; row_index: number; column_index: number }
type SyncCursor = { index: number; offsetSeconds: number; remainingMs: number; sequence: number }
type PlaybackAnchor = { key: string; offsetMs: number; startedAt: number }
type ProviderTelemetry = { expectedPositionMs: number; actualPositionMs: number; buffering: boolean; measurementKind: 'media'; sampledAt: number }

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
  const rawElapsed = session.playback_state === 'paused' ? Number(session.paused_position_ms || 0) : Math.max(0, Date.now() - new Date(session.started_at).getTime())
  let positionMs = rawElapsed % cycleMs
  for (let index = 0; index < durations.length; index += 1) {
    const durationMs = durations[index]
    if (positionMs < durationMs) return { index, offsetSeconds: positionMs / 1000, remainingMs: Math.max(50, durationMs - positionMs), sequence: session.sequence }
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
  const [localCycleSerial, setLocalCycleSerial] = useState(0)
  const [syncCursor, setSyncCursor] = useState<SyncCursor | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [previousPosterItem, setPreviousPosterItem] = useState<Item | null>(null)
  const [transitionSerial, setTransitionSerial] = useState(0)
  const playbackAnchor = useRef<PlaybackAnchor | null>(null)
  const youtubeController = useRef<YouTubeController | null>(null)
  const youtubeBuffering = useRef(false)
  const providerTelemetry = useRef<ProviderTelemetry | null>(null)
  const readyKey = useRef('')
  const activePlaylistIdRef = useRef<string | null>(null)
  const lastItemRef = useRef<Item | null>(null)
  const transitionTimerRef = useRef<number | null>(null)

  const handleYouTubeController = useCallback((controller: YouTubeController | null) => {
    youtubeController.current = controller
    if (!controller) providerTelemetry.current = null
  }, [])
  const handleYouTubeBuffering = useCallback((buffering: boolean) => { youtubeBuffering.current = buffering }, [])
  const handleHlsSample = useCallback((sample: HlsMediaSample | null) => { providerTelemetry.current = sample }, [])

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
    const nextProgram = data as Program
    const nextPublication = nextProgram.publications.find((row) => publicationMatches(row)) || null
    const nextPlaylistId = nextPublication?.playlist.id ?? null
    if (activePlaylistIdRef.current !== nextPlaylistId) {
      activePlaylistIdRef.current = nextPlaylistId
      setItemIndex(0)
      setLocalCycleSerial(0)
      lastItemRef.current = null
      setPreviousPosterItem(null)
      if (transitionTimerRef.current != null) {
        window.clearTimeout(transitionTimerRef.current)
        transitionTimerRef.current = null
      }
    }
    setInvalid(false)
    setLoadError(false)
    setProgram(nextProgram)
    setWall((wallRes.data?.wall || null) as WallContext | null)
  }, [token])

  useEffect(() => {
    let active = true
    void loadProgram()
    const channel = publicSupabase.channel(`display:${token}`)
      .on('broadcast', { event: 'display_invalidated' }, () => { if (active) setInvalid(true) })
      .on('broadcast', { event: 'display_program_changed' }, () => { if (active) void loadProgram() })
      .subscribe()
    const timer = window.setInterval(() => { if (active) void loadProgram() }, 2000)
    return () => {
      active = false
      window.clearInterval(timer)
      if (transitionTimerRef.current != null) window.clearTimeout(transitionTimerRef.current)
      void publicSupabase.removeChannel(channel)
    }
  }, [token, loadProgram])

  const publication = useMemo(() => program?.publications.find((row) => publicationMatches(row)) || null, [program])
  const items = publication?.playlist.items || []
  const syncSession = program?.group_mode === 'video_wall' ? program.sync_session || null : null
  const launch = program?.group_mode === 'video_wall' ? program.group_launch || null : null
  const launchHolding = launch?.status === 'preparing'
  const shouldPlay = !launch || launch.status === 'started' || launch.status === 'armed'
  const launchStartAt = launch?.status === 'armed' ? launch.start_at : null

  useEffect(() => {
    if (!syncSession || !items.length) { setSyncCursor(null); return }
    const align = () => { const next = resolveSyncCursor(items, syncSession); setSyncCursor(next); return next }
    const current = align()
    if (!current || syncSession.playback_state !== 'playing') return
    let timer = window.setTimeout(function realign() {
      const next = align()
      if (next && syncSession.playback_state === 'playing') timer = window.setTimeout(realign, next.remainingMs)
    }, current.remainingMs)
    return () => window.clearTimeout(timer)
  }, [items, syncSession])

  const effectiveIndex = launchHolding ? 0 : (syncCursor ? syncCursor.index : itemIndex)
  const item = items.length ? items[effectiveIndex % items.length] : null
  const offsetSeconds = launchHolding ? 0 : (syncCursor?.offsetSeconds || 0)
  const transitionType = publication?.playlist.transition_type || 'fade'
  const configuredTransitionMs = Math.max(0, Math.min(2000, Number(publication?.playlist.transition_duration_ms ?? 600)))
  const transitionDurationMs = item ? Math.min(configuredTransitionMs, Math.max(100, item.duration_seconds * 1000 - 100)) : configuredTransitionMs

  useEffect(() => {
    if (syncSession || !item || !items.length) return
    const timer = window.setTimeout(() => {
      if (items.length === 1) {
        setLocalCycleSerial((value) => value + 1)
        return
      }
      setItemIndex((value) => (value + 1) % items.length)
    }, item.duration_seconds * 1000)
    return () => window.clearTimeout(timer)
  }, [item?.id, item?.duration_seconds, items.length, syncSession, localCycleSerial])

  useEffect(() => {
    if (!item) {
      lastItemRef.current = null
      setPreviousPosterItem(null)
      return
    }
    const previous = lastItemRef.current
    const canTransition = !wall && transitionType !== 'none' && transitionDurationMs > 0 && previous?.id !== item.id && Boolean(previous?.poster && item.poster)
    if (canTransition && previous) {
      if (transitionTimerRef.current != null) window.clearTimeout(transitionTimerRef.current)
      setPreviousPosterItem(previous)
      setTransitionSerial((value) => value + 1)
      transitionTimerRef.current = window.setTimeout(() => {
        setPreviousPosterItem(null)
        transitionTimerRef.current = null
      }, transitionDurationMs)
    } else if (previous?.id !== item.id) {
      setPreviousPosterItem(null)
    }
    lastItemRef.current = item
  }, [item?.id, transitionType, transitionDurationMs, wall])

  useEffect(() => {
    if (!item) { playbackAnchor.current = null; return }
    const key = `${syncSession?.sequence || 0}:${item.id}`
    playbackAnchor.current = { key, offsetMs: Math.max(0, Math.round(offsetSeconds * 1000)), startedAt: performance.now() }
  }, [item?.id, offsetSeconds, syncSession?.sequence])

  const reportReady = useCallback((provider: string) => {
    if (!launch || !['preparing', 'armed'].includes(launch.status) || !item) return
    const key = `${launch.id}:${item.id}:${provider}`
    if (readyKey.current === key) return
    readyKey.current = key
    void publicSupabase.functions.invoke('display-group-ready', { body: { token, launch_id: launch.id, ready: true, provider, detail: `item:${item.id}` } })
  }, [launch, item, token])

  useEffect(() => {
    if (!syncSession || !item || item.content?.type !== 'youtube' || !items.length || launchHolding) {
      if (item?.content?.type !== 'hls') providerTelemetry.current = null
      return
    }
    const sampleAndCorrect = () => {
      const controller = youtubeController.current
      const expected = resolveSyncCursor(items, syncSession)
      if (!controller || !expected || expected.index !== effectiveIndex) return
      const expectedPositionMs = Math.max(0, Math.round(expected.offsetSeconds * 1000))
      const actualPositionMs = Math.max(0, Math.round(controller.getCurrentTime() * 1000))
      const state = controller.getPlayerState()
      const buffering = youtubeBuffering.current || state === 3
      const driftMs = actualPositionMs - expectedPositionMs
      providerTelemetry.current = { expectedPositionMs, actualPositionMs, buffering, measurementKind: 'media', sampledAt: Date.now() }
      if (shouldPlay && syncSession.playback_state === 'playing' && state === 1 && !buffering && Math.abs(driftMs) > 750) controller.seekTo(expected.offsetSeconds, true)
    }
    sampleAndCorrect()
    const timer = window.setInterval(sampleAndCorrect, 2000)
    return () => window.clearInterval(timer)
  }, [effectiveIndex, item?.id, item?.content?.type, items, syncSession, launchHolding, shouldPlay])

  const getExpectedMediaSeconds = useCallback(() => {
    if (launchHolding) return 0
    if (!syncSession || !items.length) return null
    const expected = resolveSyncCursor(items, syncSession)
    if (!expected || expected.index !== effectiveIndex) return null
    return expected.offsetSeconds
  }, [effectiveIndex, items, syncSession, launchHolding])

  useEffect(() => {
    if (!program || invalid) return
    const report = () => {
      let expectedPositionMs: number | null = null
      let actualPositionMs: number | null = null
      let buffering = false
      let measurementKind: 'clock' | 'media' = 'clock'
      const mediaSample = providerTelemetry.current
      if (mediaSample && Date.now() - mediaSample.sampledAt <= 5000) {
        expectedPositionMs = mediaSample.expectedPositionMs; actualPositionMs = mediaSample.actualPositionMs; buffering = mediaSample.buffering; measurementKind = mediaSample.measurementKind
      } else if (syncSession && item && items.length) {
        const expected = resolveSyncCursor(items, syncSession)
        if (expected && expected.index === effectiveIndex) {
          expectedPositionMs = Math.max(0, Math.round(expected.offsetSeconds * 1000))
          const anchor = playbackAnchor.current
          if (anchor?.key === `${syncSession.sequence}:${item.id}`) {
            const elapsed = syncSession.playback_state === 'playing' ? Math.max(0, performance.now() - anchor.startedAt) : 0
            actualPositionMs = Math.min(item.duration_seconds * 1000, Math.max(0, Math.round(anchor.offsetMs + elapsed)))
          }
        }
      }
      void publicSupabase.functions.invoke('display-state', { body: { token, playlist_id: publication?.playlist.id ?? null, item_id: item?.id ?? null, group_id: program.group_id ?? null, session_id: syncSession?.id ?? null, expected_position_ms: expectedPositionMs, actual_position_ms: actualPositionMs, sequence: syncSession?.sequence ?? 0, buffering, measurement_kind: measurementKind } })
    }
    report()
    const timer = window.setInterval(report, 10000)
    return () => window.clearInterval(timer)
  }, [token, program, invalid, publication?.playlist.id, item?.id, item?.duration_seconds, items, syncSession, effectiveIndex])

  if (invalid) return <main className="public-display invalid-display"><div className="brand-mark">DH</div><h1>Display indisponível</h1><p>Este link foi revogado, desativado ou não existe.</p></main>
  if (loadError) return <main className="public-display invalid-display"><div className="brand-mark">DH</div><h1>Falha de conexão</h1><p>O player tentará carregar novamente automaticamente.</p></main>
  if (!program) return <main className="public-display"><div className="display-idle-card"><div className="brand-mark">DH</div><h1>Conectando display...</h1></div></main>
  if (!publication || !item) return <Idle display={program.display} />

  const mediaFit = wall?.media_fit || 'cover'
  const localSyncKey = `${localCycleSerial}:${item.id}`
  const currentContent = <ItemView item={item} display={program.display} mediaFit={mediaFit} startSeconds={offsetSeconds} syncKey={syncCursor ? `${syncCursor.sequence}:${item.id}` : localSyncKey} shouldPlay={shouldPlay} startAt={launchStartAt} onReady={reportReady} onYouTubeController={handleYouTubeController} onYouTubeBuffering={handleYouTubeBuffering} getExpectedMediaSeconds={getExpectedMediaSeconds} onHlsSample={handleHlsSample} />
  const showPosterTransition = !wall && transitionType !== 'none' && Boolean(previousPosterItem?.poster && item.poster)
  const content = showPosterTransition && previousPosterItem?.poster
    ? <div className={`poster-transition-stage poster-transition-${transitionType}`} key={`poster-transition-${transitionSerial}-${item.id}`}>
        <div className="poster-transition-layer poster-transition-old" style={{ animationDuration: `${transitionDurationMs}ms` }}><div className="promotion-player"><PromotionPosterView poster={previousPosterItem.poster} /></div></div>
        <div className="poster-transition-layer poster-transition-new" style={{ animationDuration: `${transitionDurationMs}ms` }}>{currentContent}</div>
      </div>
    : currentContent
  const progressDuration = syncCursor ? Math.max(0.05, syncCursor.remainingMs / 1000) : item.duration_seconds

  return <main className={`public-display player-screen player-${item.template?.template_type || 'default'} ${wall ? 'video-wall-screen' : ''}`}>
    {wall ? <WallViewport wall={wall}>{content}</WallViewport> : content}
    {!launchHolding && <div className="player-progress" key={`${item.id}:${syncCursor?.sequence || 0}:${localCycleSerial}:${Math.floor(offsetSeconds * 10)}`} style={{ animationDuration: `${progressDuration}s` }} />}
  </main>
}

function WallViewport({ wall, children }: { wall: WallContext; children: ReactNode }) {
  const width = wall.columns * 100
  const height = wall.rows * 100
  const x = -(wall.column_index * (100 / wall.columns))
  const y = -(wall.row_index * (100 / wall.rows))
  return <div className="wall-viewport" data-wall={wall.group_name}><div className="wall-surface" data-fit={wall.media_fit} style={{ width: `${width}%`, height: `${height}%`, transform: `translate(${x}%, ${y}%)` }}>{children}</div></div>
}

function Idle({ display }: { display: Display }) {
  return <main className="public-display"><div className="display-idle-card"><div className="brand-mark">DH</div><p className="eyebrow">DisplayHub</p><h1>{display.name}</h1><p>{display.location || 'Local não informado'}</p><strong>Nenhuma programação ativa neste horário</strong></div></main>
}

function ItemView({ item, display, mediaFit, startSeconds, syncKey, shouldPlay, startAt, onReady, onYouTubeController, onYouTubeBuffering, getExpectedMediaSeconds, onHlsSample }: {
  item: Item; display: Display; mediaFit: MediaFit; startSeconds: number; syncKey: string; shouldPlay: boolean; startAt: string | null; onReady: (provider: string) => void; onYouTubeController: (controller: YouTubeController | null) => void; onBufferingChange: (buffering: boolean) => void; getExpectedMediaSeconds: () => number | null; onHlsSample: (sample: HlsMediaSample | null) => void
}) {
  useEffect(() => {
    if (item.structured) onReady('structured')
    if (item.poster) onReady('promotion_poster')
  }, [item.id, item.structured, item.poster, onReady])

  if (item.poster) return <div className="promotion-player"><PromotionPosterView poster={item.poster} className="promotion-player-poster" /></div>

  if (item.content?.type === 'image' && item.content.signed_url) {
    const objectFit = mediaFit === 'native' ? 'fill' : mediaFit
    const image = <img src={item.content.signed_url} alt={item.content.title} style={{ objectFit }} onLoad={() => onReady('image')} />
    return item.template?.template_type === 'split_screen' ? <div className="split-layout"><div className="split-media">{image}</div><div className="split-copy"><p className="eyebrow">{display.name}</p><h1>{item.content.title}</h1><p>{display.location || 'DisplayHub'}</p></div></div> : <div className="fullscreen-media">{image}</div>
  }
  if (item.content?.type === 'youtube' && item.content.external_id) return <div className="fullscreen-media"><YouTubeSyncPlayer videoId={item.content.external_id} title={item.content.title} startSeconds={startSeconds} syncKey={syncKey} shouldPlay={shouldPlay} startAt={startAt} fitMode={mediaFit} onReady={() => onReady('youtube')} onController={onYouTubeController} onBufferingChange={onYouTubeBuffering} /></div>
  if (item.content?.type === 'hls' && item.content.external_url) return <div className="fullscreen-media"><HlsSyncPlayer manifestUrl={item.content.external_url} title={item.content.title} startSeconds={startSeconds} syncKey={syncKey} shouldPlay={shouldPlay} startAt={startAt} fitMode={mediaFit} getExpectedSeconds={getExpectedMediaSeconds} onReady={() => onReady('hls')} onSample={onHlsSample} /></div>

  const content = item.structured
  if (!content) return <div className="text-template"><h1>Conteúdo indisponível</h1></div>
  if (content.kind === 'menu' || content.kind === 'price_table') return <div className="menu-template"><header><p className="eyebrow">{display.name}</p><h1>{content.title}</h1>{content.description && <p>{content.description}</p>}</header><div className="menu-rows">{content.rows.map((row) => <div className="menu-row" key={row.id}><div><strong>{row.title}</strong>{row.description && <small>{row.description}</small>}</div><div className="menu-price">{row.promo_price != null && <del>{money(row.price)}</del>}<strong>{money(row.promo_price ?? row.price)}</strong></div></div>)}</div></div>
  if (content.kind === 'product') return <div className="product-template"><p className="eyebrow">{content.category || 'Destaque'}</p><h1>{content.title}</h1>{content.description && <p>{content.description}</p>}<div className="hero-price">{content.promo_price != null && <del>{money(content.price)}</del>}<strong>{money(content.promo_price ?? content.price)}</strong></div></div>
  return <div className="text-template"><p className="eyebrow">{content.kind === 'qr' ? 'QR / Link' : 'Aviso'}</p><h1>{content.title}</h1><p>{content.description || content.qr_value || ''}</p></div>
}