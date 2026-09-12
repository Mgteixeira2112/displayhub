import { useEffect, useState, type ReactNode } from 'react'
import DisplayGroupsManager from './DisplayGroupsManager'

type View = 'overview' | 'displays' | 'groups' | 'library' | 'posters' | 'campaigns' | 'playlists' | 'schedule' | 'templates' | 'history' | 'settings'
type IconName = 'home' | 'create' | 'campaigns' | 'gallery' | 'screens' | 'content' | 'advanced' | 'wall' | 'playlists' | 'schedule' | 'history' | 'settings'

type Props = {
  companyName: string
  userName: string
  roleLabel: string
  busy: boolean
  onSignOut: () => void
  children: ReactNode
}

const labels: Record<View, string> = {
  overview: 'Início',
  displays: 'Telas',
  groups: 'Video Wall e Grupos',
  library: 'Conteúdo',
  posters: 'Criar',
  campaigns: 'Campanhas',
  playlists: 'Playlists avançadas',
  schedule: 'Programação avançada',
  templates: 'Galeria',
  history: 'Histórico técnico',
  settings: 'Configurações',
}

const descriptions: Record<View, string> = {
  overview: 'Acompanhe a operação e acesse rapidamente o que precisa de atenção',
  displays: 'Gerencie as TVs, setores, links públicos e disponibilidade',
  groups: 'Configure Video Wall, grupos, grades e posições de telas',
  library: 'Organize imagens, vídeos e outros conteúdos da operação',
  posters: 'Crie ofertas e peças promocionais a partir dos modelos disponíveis',
  campaigns: 'Organize sequências de conteúdo e campanhas em exibição',
  playlists: 'Controle técnico das sequências de conteúdo do player',
  schedule: 'Defina regras avançadas de onde e quando o conteúdo será exibido',
  templates: 'Escolha e gerencie modelos para suas campanhas',
  history: 'Consulte eventos e alterações registradas na operação',
  settings: 'Dados da conta, acesso e preferências do sistema',
}

const advancedViews: View[] = ['groups', 'playlists', 'schedule', 'history']
const allViews = new Set<View>(['overview', 'displays', 'groups', 'library', 'posters', 'campaigns', 'playlists', 'schedule', 'templates', 'history', 'settings'])

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.6V21h13V9.6"/><path d="M9.5 21v-6h5v6"/></>,
    create: <><path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="5"/></>,
    campaigns: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 9h10M7 13h7"/></>,
    gallery: <><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m5.5 17 4.2-4.2 2.8 2.8 2.2-2.2 3.8 3.6"/></>,
    screens: <><rect x="3" y="4" width="18" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/></>,
    content: <><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 12h8M8 16h6"/></>,
    advanced: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></>,
    wall: <><rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/></>,
    playlists: <><path d="M5 6h11M5 12h11M5 18h8"/><path d="m18 15 4 3-4 3z"/></>,
    schedule: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h3M14 14h2M8 18h3"/></>,
    history: <><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 8v5l3 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  }

  return <svg className="software-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

export default function AppLayout({ companyName, userName, roleLabel, busy, onSignOut, children }: Props) {
  const [view, setView] = useState<View>('overview')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const isAdvanced = advancedViews.includes(view)

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const target = (event as CustomEvent<string>).detail as View
      if (!allViews.has(target)) return
      setView(target)
      if (advancedViews.includes(target)) setAdvancedOpen(true)
    }
    window.addEventListener('displayhub:navigate', handleNavigate)
    return () => window.removeEventListener('displayhub:navigate', handleNavigate)
  }, [])

  const nav = (target: View, label: string, icon: IconName, nested = false) => (
    <button
      type="button"
      className={`software-nav-item ${nested ? 'nested' : ''} ${view === target ? 'active' : ''}`}
      aria-current={view === target ? 'page' : undefined}
      onClick={() => {
        setView(target)
        if (nested) setAdvancedOpen(true)
      }}
    >
      <NavIcon name={icon} />
      <span>{label}</span>
    </button>
  )

  return (
    <div className="software-shell modern-software-shell">
      <aside className="software-sidebar">
        <div className="software-brand">
          <div className="brand-mark" aria-hidden="true">DH</div>
          <div><strong>DisplayHub</strong><span>Mídia para supermercados</span></div>
        </div>

        <nav className="software-nav" aria-label="Navegação principal">
          <span className="software-nav-group">Principal</span>
          {nav('overview', 'Início', 'home')}
          {nav('posters', 'Criar', 'create')}
          {nav('campaigns', 'Campanhas', 'campaigns')}
          {nav('templates', 'Galeria', 'gallery')}
          {nav('displays', 'Telas', 'screens')}
          {nav('library', 'Conteúdo', 'content')}

          <div className={`software-nav-advanced ${advancedOpen || isAdvanced ? 'open' : ''}`}>
            <button
              type="button"
              className={`software-nav-item software-nav-advanced-toggle ${isAdvanced ? 'active-parent' : ''}`}
              aria-expanded={advancedOpen || isAdvanced}
              onClick={() => setAdvancedOpen((current) => !current)}
            >
              <NavIcon name="advanced" />
              <span>Avançado</span>
              <span className="software-nav-chevron" aria-hidden="true">⌄</span>
            </button>
            <div className="software-nav-submenu">
              {nav('groups', 'Video Wall e Grupos', 'wall', true)}
              {nav('playlists', 'Playlists', 'playlists', true)}
              {nav('schedule', 'Programação', 'schedule', true)}
              {nav('history', 'Histórico técnico', 'history', true)}
            </div>
          </div>

          <span className="software-nav-divider" aria-hidden="true" />
          {nav('settings', 'Configurações', 'settings')}
        </nav>

        <div className="software-sidebar-footer">
          <div className="software-company-summary"><span>Workspace</span><strong>{companyName}</strong></div>
          <div className="software-user"><strong>{userName}</strong><span>{roleLabel}</span></div>
          <button className="software-signout" type="button" onClick={onSignOut} disabled={busy}>Sair</button>
        </div>
      </aside>

      <div className={`software-main view-${view}`}>
        <header className="software-topbar">
          <div className="software-topbar-copy">
            <span className="software-page-kicker">DisplayHub</span>
            <strong>{labels[view]}</strong>
            <p>{descriptions[view]}</p>
          </div>
          <div className="software-topbar-actions">
            <span className="software-company-pill">{companyName}</span>
            <button className="software-topbar-create" type="button" onClick={() => setView('posters')}>+ Criar</button>
          </div>
        </header>
        <main key={view} className="software-content">{view === 'groups' ? <DisplayGroupsManager /> : children}</main>
      </div>
    </div>
  )
}
