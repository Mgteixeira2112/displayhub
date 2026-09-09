import type { ReactNode } from 'react'

type Props = {
  companyName: string
  userName: string
  roleLabel: string
  busy: boolean
  onSignOut: () => void
  children: ReactNode
}

export default function AppLayout({ companyName, userName, roleLabel, busy, onSignOut, children }: Props) {
  return (
    <div className="software-shell">
      <aside className="software-sidebar">
        <div className="software-brand">
          <div className="brand-mark" aria-hidden="true">DH</div>
          <div>
            <strong>DisplayHub</strong>
            <span>{companyName}</span>
          </div>
        </div>

        <nav className="software-nav" aria-label="Navegação principal">
          <button type="button" className="software-nav-item active">Visão Geral</button>

          <span className="software-nav-group">Exibição</span>
          <button type="button" className="software-nav-item pending">Displays</button>

          <span className="software-nav-group">Conteúdo</span>
          <button type="button" className="software-nav-item pending">Biblioteca</button>
          <button type="button" className="software-nav-item pending">Playlists</button>
          <button type="button" className="software-nav-item pending">Programação</button>
          <button type="button" className="software-nav-item pending">Templates</button>

          <span className="software-nav-group">Administração</span>
          <button type="button" className="software-nav-item pending">Histórico</button>
          <button type="button" className="software-nav-item pending">Configurações</button>
        </nav>

        <div className="software-sidebar-footer">
          <div className="software-user">
            <strong>{userName}</strong>
            <span>{roleLabel}</span>
          </div>
          <button className="software-signout" type="button" onClick={onSignOut} disabled={busy}>Sair</button>
        </div>
      </aside>

      <div className="software-main">
        <header className="software-topbar">
          <div>
            <p>DisplayHub</p>
            <strong>Visão Geral</strong>
          </div>
          <span>{companyName}</span>
        </header>

        <main className="software-content">{children}</main>
      </div>
    </div>
  )
}
