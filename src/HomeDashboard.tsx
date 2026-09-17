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
}
type PosterRow = {
  id: string
  product_name: string
  price: number
  template_key: string
  created_at: string
}
type PlaylistRow = { id: string; name: string; is_active: boolean }
type PublicationRow = {
  id: string
  display_id: string
  playlist_id: string
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

type NavigateTarget = 'posters' | 'campaigns' | 'displays'

function goTo(target: NavigateTarget) {
  window.dispatchEvent(new CustomEvent('displayhub:navigate', { detail: target }))
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function isPublicationActive(publication: PublicationRow, now = Date.now()) {
  if (!publication.is_active) return false
  if (publication.starts_at && new Date(publication.starts_at).getTime() > now) return false
  if (publication.ends_at && new Date(publication.ends_at).getTime() < now) return false
  return true
}

export default function HomeDashboard({ companyId }: Props) {
  const [displays, setDisplays] = useState<DisplayRow[]>([])
  const [posters, setPosters] = useState<PosterRow[]>([])
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([])
  const [publications, setPublications] = useState<PublicationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [displayRes, posterRes, playlistRes, publicationRes] = await Promise.all([
        supabase
          .from('displays')
          .select('id,name,location,is_active,revoked_at,last_seen_at,active_playlist_id')
          .eq('company_id', companyId)
          .order('created_at'),
        supabase
          .from('promotion_posters')
          .select('id,product_name,price,template_key,created_at')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('playlists')
          .select('id,name,is_active')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('display_publications')
          .select('id,display_id,playlist_id,starts_at,ends_at,is_active')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
      ])

      for (const result of [displayRes, posterRes, playlistRes, publicationRes]) {
        if (result.error) throw result.error
      }

      setDisplays((displayRes.data || []) as DisplayRow[])
      setPosters((posterRes.data || []) as PosterRow[])
      setPlaylists((playlistRes.data || []) as PlaylistRow[])
      setPublications((publicationRes.data || []) as PublicationRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a página inicial.')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 15000)
    return () => window.clearInterval(timer)
  }, [load])

  const playlistNames = useMemo(() => Object.fromEntries(playlists.map((item) => [item.id, item.name])), [playlists])
  const displayNames = useMemo(() => Object.fromEntries(displays.map((item) => [item.id, item.name])), [displays])

  const summary = useMemo(() => {
    const now = Date.now()
    const activeDisplays = displays.filter((display) => display.is_active && !display.revoked_at)
    const online = activeDisplays.filter((display) => display.last_seen_at && now - new Date(display.last_seen_at).getTime() < 90000).length
    const offline = activeDisplays.length - online
    const playing = activeDisplays.filter((display) => Boolean(display.active_playlist_id)).length
    const activePublications = publications.filter((publication) => isPublicationActive(publication, now)).length
    return { total: activeDisplays.length, online, offline, playing, activePublications }
  }, [displays, publications])

  const offlineDisplays = useMemo(() => displays
    .filter((display) => {
      if (!display.is_active || display.revoked_at) return false
      if (!display.last_seen_at) return true
      return Date.now() - new Date(display.last_seen_at).getTime() >= 90000
    })
    .slice(0, 5), [displays])

  const currentPublications = useMemo(() => publications
    .filter((publication) => isPublicationActive(publication))
    .slice(0, 5), [publications])

  return (
    <section className="home-dashboard">
      <div className="home-welcome">
        <div>
          <span className="home-kicker">Operação do supermercado</span>
          <h1>Controle sua comunicação em poucos cliques.</h1>
          <p>Crie ofertas, acompanhe as telas e veja o que está em exibição sem entrar em áreas técnicas.</p>
        </div>
        <button className="home-refresh" type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar dados'}</button>
      </div>

      {error && <p className="form-message">{error}</p>}

      <div className="home-quick-actions" aria-label="Ações rápidas">
        <button type="button" className="home-action primary" onClick={() => goTo('posters')}>
          <span className="home-action-icon">＋</span>
          <span><strong>Criar oferta</strong><small>Monte uma peça promocional</small></span>
          <em>→</em>
        </button>
        <button type="button" className="home-action" onClick={() => goTo('posters')}>
          <span className="home-action-icon">▦</span>
          <span><strong>Galeria</strong><small>Escolha um template pronto</small></span>
          <em>→</em>
        </button>
        <button type="button" className="home-action" onClick={() => goTo('campaigns')}>
          <span className="home-action-icon">▤</span>
          <span><strong>Campanhas</strong><small>Gerencie o que foi criado</small></span>
          <em>→</em>
        </button>
        <button type="button" className="home-action" onClick={() => goTo('displays')}>
          <span className="home-action-icon">▣</span>
          <span><strong>Telas</strong><small>Acompanhe TVs e setores</small></span>
          <em>→</em>
        </button>
      </div>

      <div className="home-section-heading">
        <div><span>Agora</span><h2>Resumo da operação</h2></div>
        <small>Dados reais atualizados automaticamente</small>
      </div>

      <div className="home-stats">
        <article><span>Telas ativas</span><strong>{summary.total}</strong><small>{summary.online} online</small></article>
        <article className="home-stat-online"><span>Online</span><strong>{summary.online}</strong><small>com sinal recente</small></article>
        <article className={summary.offline ? 'home-stat-warning' : ''}><span>Requer atenção</span><strong>{summary.offline}</strong><small>tela{summary.offline === 1 ? '' : 's'} offline</small></article>
        <article><span>Em exibição</span><strong>{summary.playing}</strong><small>telas com conteúdo</small></article>
        <article><span>Programações ativas</span><strong>{summary.activePublications}</strong><small>agora</small></article>
      </div>

      <div className="home-grid">
        <section className="home-card home-current">
          <div className="home-card-head">
            <div><span>Em exibição</span><h3>Campanhas ativas</h3></div>
            <button type="button" onClick={() => goTo('campaigns')}>Ver campanhas</button>
          </div>
          {currentPublications.length === 0 ? <p className="home-empty">Nenhuma programação ativa neste momento.</p> : (
            <div className="home-list">
              {currentPublications.map((publication) => (
                <article key={publication.id}>
                  <span className="home-status-dot online" />
                  <div><strong>{playlistNames[publication.playlist_id] || 'Campanha'}</strong><small>{displayNames[publication.display_id] || 'Tela'}</small></div>
                  <span className="home-badge">No ar</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="home-card home-attention">
          <div className="home-card-head">
            <div><span>Monitoramento</span><h3>Telas que precisam de atenção</h3></div>
            <button type="button" onClick={() => goTo('displays')}>Ver telas</button>
          </div>
          {offlineDisplays.length === 0 ? <div className="home-all-good"><strong>Tudo certo</strong><small>Nenhuma tela ativa está offline.</small></div> : (
            <div className="home-list">
              {offlineDisplays.map((display) => (
                <article key={display.id}>
                  <span className="home-status-dot warning" />
                  <div><strong>{display.name}</strong><small>{display.location || 'Local não informado'}</small></div>
                  <span className="home-badge warning">Offline</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="home-card home-recent">
        <div className="home-card-head">
          <div><span>Criações recentes</span><h3>Ofertas salvas</h3></div>
          <button type="button" onClick={() => goTo('posters')}>Criar nova</button>
        </div>
        {posters.length === 0 ? <p className="home-empty">Nenhuma oferta criada ainda.</p> : (
          <div className="home-offer-grid">
            {posters.map((poster) => (
              <article key={poster.id}>
                <span className="home-offer-label">Oferta</span>
                <strong>{poster.product_name}</strong>
                <b>{formatPrice(poster.price)}</b>
                <small>{poster.template_key.replaceAll('_', ' ')}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
