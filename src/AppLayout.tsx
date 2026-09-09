import { useState, type ReactNode } from 'react'
import DisplayGroupsManager from './DisplayGroupsManager'

type View = 'overview' | 'displays' | 'groups' | 'library' | 'posters' | 'playlists' | 'schedule' | 'templates' | 'history' | 'settings'

type Props = {
  companyName: string
  userName: string
  roleLabel: string
  busy: boolean
  onSignOut: () => void
  children: ReactNode
}

const labels: Record<View, string> = {
  overview: 'Visão Geral',
  displays: 'Displays',
  groups: 'Grupos de Displays',
  library: 'Biblioteca',
  posters: 'Cartazes Promocionais',
  playlists: 'Playlists',
  schedule: 'Programação',
  templates: 'Templates',
  history: 'Histórico',
  settings: 'Configurações',
}

const descriptions: Record<View, string> = {
  overview: 'Status da operação e atividade das telas',
  displays: 'Gerencie telas, links públicos e disponibilidade',
  groups: 'Monte grupos, grades e posições para exibições compartilhadas',
  library: 'Organize mídias e conteúdo comercial',
  posters: 'Crie cartazes de promoção com produto, preço e fundos prontos',
  playlists: 'Monte sequências de conteúdo para exibição',
  schedule: 'Defina onde e quando cada playlist será exibida',
  templates: 'Gerencie modelos de apresentação',
  history: 'Consulte alterações registradas na operação',
  settings: 'Dados da conta e permissões de acesso',
}

export default function AppLayout({ companyName, userName, roleLabel, busy, onSignOut, children }: Props) {
  const [view, setView] = useState<View>('overview')

  const nav = (target: View, label: string) => (
    <button
      type="button"
      className={`software-nav-item ${view === target ? 'active' : ''}`}
      aria-current={view === target ? 'page' : undefined}
      onClick={() => setView(target)}
    >
      {label}
    </button>
  )

  return (
    <div className="software-shell">
      <aside className="software-sidebar">
        <div className="software-brand">
          <div className="brand-mark" aria-hidden="true">DH</div>
          <div><strong>DisplayHub</strong><span>{companyName}</span></div>
        </div>

        <nav className="software-nav" aria-label="Navegação principal">
          {nav('overview', 'Visão Geral')}
          <span className="software-nav-group">Exibição</span>
          {nav('displays', 'Displays')}
          {nav('groups', 'Grupos de Displays')}
          <span className="software-nav-group">Conteúdo</span>
          {nav('library', 'Biblioteca')}
          {nav('posters', 'Cartazes Promocionais')}
          {nav('playlists', 'Playlists')}
          {nav('schedule', 'Programação')}
          {nav('templates', 'Templates')}
          <span className="software-nav-group">Administração</span>
          {nav('history', 'Histórico')}
          {nav('settings', 'Configurações')}
        </nav>

        <div className="software-sidebar-footer">
          <div className="software-user"><strong>{userName}</strong><span>{roleLabel}</span></div>
          <button className="software-signout" type="button" onClick={onSignOut} disabled={busy}>Sair</button>
        </div>
      </aside>

      <div className={`software-main view-${view}`}>
        <header className="software-topbar">
          <div className="software-topbar-copy">
            <strong>{labels[view]}</strong>
            <p>{descriptions[view]}</p>
          </div>
          <span>{companyName}</span>
        </header>
        <main className="software-content">{view === 'groups' ? <DisplayGroupsManager /> : children}</main>
      </div>
    </div>
  )
}
