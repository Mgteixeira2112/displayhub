import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import AppLayout from './AppLayout'
import ContentLibrary from './ContentLibrary'
import { publicSupabase, supabase } from './lib/supabase'

type Mode = 'login' | 'signup'

type AccountSummary = {
  companyId: string
  fullName: string
  role: string
  companyName: string
  unitName: string
}

type Unit = { id: string; name: string }

type Display = {
  id: string
  unit_id: string | null
  name: string
  location: string | null
  orientation: 'landscape' | 'portrait'
  resolution_width: number
  resolution_height: number
  public_token: string
  is_active: boolean
  revoked_at: string | null
  last_seen_at: string | null
}

type PublicDisplay = {
  id: string
  name: string
  location: string | null
  orientation: string
  resolution_width: number
  resolution_height: number
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  operator: 'Operador',
}

function getPublicToken() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
  const directMatch = window.location.pathname.match(new RegExp(`^${basePath}/display/([^/]+)$`))
  if (directMatch) return directMatch[1]

  const redirectedPath = new URLSearchParams(window.location.search).get('p')
  const redirectedMatch = redirectedPath?.match(/^display\/([^/]+)$/)
  if (!redirectedMatch) return null

  window.history.replaceState({}, '', `${import.meta.env.BASE_URL}display/${redirectedMatch[1]}`)
  return redirectedMatch[1]
}

async function loadAccount(userId: string, userEmail: string | undefined): Promise<AccountSummary> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id, unit_id, role, full_name')
    .eq('user_id', userId)
    .single()

  if (profileError) throw profileError

  const [{ data: company, error: companyError }, { data: unit, error: unitError }] = await Promise.all([
    supabase.from('companies').select('name').eq('id', profile.company_id).single(),
    profile.unit_id
      ? supabase.from('units').select('name').eq('id', profile.unit_id).single()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (companyError) throw companyError
  if (unitError) throw unitError

  return {
    companyId: profile.company_id,
    fullName: profile.full_name || userEmail || 'Usuário',
    role: profile.role,
    companyName: company.name,
    unitName: unit?.name || 'Sem unidade',
  }
}

function PublicDisplayScreen({ token }: { token: string }) {
  const [display, setDisplay] = useState<PublicDisplay | null>(null)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      const { data, error } = await publicSupabase.rpc('get_public_display', { p_token: token })
      if (!active) return
      if (error || !data?.length) {
        setInvalid(true)
        return
      }
      setDisplay(data[0])
      await publicSupabase.rpc('heartbeat_display', { p_token: token })
    }

    const channel = publicSupabase
      .channel(`display:${token}`)
      .on('broadcast', { event: 'display_invalidated' }, () => {
        if (active) setInvalid(true)
      })
      .subscribe()

    void load()
    const heartbeat = window.setInterval(() => {
      if (!invalid) void publicSupabase.rpc('heartbeat_display', { p_token: token })
    }, 30000)

    return () => {
      active = false
      window.clearInterval(heartbeat)
      void publicSupabase.removeChannel(channel)
    }
  }, [token, invalid])

  if (invalid) {
    return (
      <main className="public-display invalid-display">
        <div className="brand-mark">DH</div>
        <h1>Display indisponível</h1>
        <p>Este link foi revogado, desativado ou não existe.</p>
      </main>
    )
  }

  return (
    <main className="public-display">
      <div className="display-idle-card">
        <div className="brand-mark">DH</div>
        <p className="eyebrow">DisplayHub</p>
        <h1>{display?.name || 'Conectando display...'}</h1>
        {display && (
          <>
            <p>{display.location || 'Local não informado'}</p>
            <span>{display.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} · {display.resolution_width}×{display.resolution_height}</span>
            <strong>Display conectado · aguardando conteúdo</strong>
          </>
        )}
      </div>
    </main>
  )
}

function App() {
  const [publicToken] = useState(getPublicToken)
  const [mode, setMode] = useState<Mode>('login')
  const [user, setUser] = useState<User | null>(null)
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [displays, setDisplays] = useState<Display[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [displayLocation, setDisplayLocation] = useState('')
  const [displayUnit, setDisplayUnit] = useState('')
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape')
  const [resolutionWidth, setResolutionWidth] = useState(1920)
  const [resolutionHeight, setResolutionHeight] = useState(1080)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const loadDisplays = useCallback(async () => {
    const { data, error } = await supabase
      .from('displays')
      .select('id, unit_id, name, location, orientation, resolution_width, resolution_height, public_token, is_active, revoked_at, last_seen_at')
      .eq('is_active', true)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
    if (error) throw error
    setDisplays((data || []) as Display[])
  }, [])

  useEffect(() => {
    if (publicToken) return

    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => data.subscription.unsubscribe()
  }, [publicToken])

  useEffect(() => {
    if (!user) {
      setAccount(null)
      setDisplays([])
      return
    }

    void loadAccount(user.id, user.email)
      .then(async (nextAccount) => {
        setAccount(nextAccount)
        const { data, error } = await supabase.from('units').select('id, name').order('name')
        if (error) throw error
        setUnits(data || [])
        await loadDisplays()
      })
      .catch(() => setMessage('Não foi possível carregar os dados da conta.'))
  }, [user, loadDisplays])

  if (publicToken) return <PublicDisplayScreen token={publicToken} />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
          data: { full_name: fullName.trim(), company_name: companyName.trim() },
        },
      })

      if (error) throw error
      if (!data.session) {
        setMessage('Cadastro criado. Confirme seu e-mail para entrar.')
        setMode('login')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateDisplay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!account) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.from('displays').insert({
        company_id: account.companyId,
        unit_id: displayUnit || null,
        name: displayName.trim(),
        location: displayLocation.trim() || null,
        orientation,
        resolution_width: resolutionWidth,
        resolution_height: resolutionHeight,
      })
      if (error) throw error
      setDisplayName('')
      setDisplayLocation('')
      await loadDisplays()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar o display.')
    } finally {
      setBusy(false)
    }
  }

  async function revokeDisplay(id: string) {
    setBusy(true)
    const { error } = await supabase.from('displays').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    if (error) setMessage(error.message)
    await loadDisplays()
    setBusy(false)
  }

  async function handleSignOut() {
    setBusy(true)
    await supabase.auth.signOut()
    setBusy(false)
  }

  if (user) {
    const canManage = account?.role === 'admin' || account?.role === 'manager'
    const companyLabel = account?.companyName || 'Carregando...'
    const userLabel = account?.fullName || user.email || 'Usuário'
    const roleLabel = account ? roleLabels[account.role] : '—'

    return (
      <AppLayout companyName={companyLabel} userName={userLabel} roleLabel={roleLabel} busy={busy} onSignOut={handleSignOut}>
        <section className="panel dashboard-panel software-dashboard-panel">
          <div className="account-grid">
            <article><span>Usuário</span><strong>{userLabel}</strong></article>
            <article><span>Unidade</span><strong>{account?.unitName || '—'}</strong></article>
            <article><span>Permissão</span><strong>{roleLabel}</strong></article>
          </div>

          {canManage && (
            <section className="workspace-section">
              <details className="create-panel create-panel-display">
                <summary>+ Novo display</summary>
                <form className="display-form" onSubmit={handleCreateDisplay}>
                  <label>Nome<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} placeholder="TV Entrada" /></label>
                  <label>Local<input value={displayLocation} onChange={(event) => setDisplayLocation(event.target.value)} placeholder="Entrada principal" /></label>
                  <label>Unidade<select value={displayUnit} onChange={(event) => setDisplayUnit(event.target.value)}><option value="">Sem unidade específica</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
                  <label>Orientação<select value={orientation} onChange={(event) => setOrientation(event.target.value as 'landscape' | 'portrait')}><option value="landscape">Horizontal</option><option value="portrait">Vertical</option></select></label>
                  <label>Largura<input type="number" min="320" max="16384" value={resolutionWidth} onChange={(event) => setResolutionWidth(Number(event.target.value))} required /></label>
                  <label>Altura<input type="number" min="320" max="16384" value={resolutionHeight} onChange={(event) => setResolutionHeight(Number(event.target.value))} required /></label>
                  <button className="primary-button" type="submit" disabled={busy}>Criar display</button>
                </form>
              </details>
            </section>
          )}

          <section className="workspace-section">
            <div className="section-heading">
              <div><p className="eyebrow">Displays</p><h2>{displays.length} cadastrado{displays.length === 1 ? '' : 's'}</h2></div>
              <button className="secondary-button compact" type="button" onClick={() => void loadDisplays()}>Atualizar</button>
            </div>

            {message && <p className="form-message">{message}</p>}
            <div className="display-list">
              {displays.length === 0 && <p className="empty-state">Nenhum display cadastrado.</p>}
              {displays.map((display) => {
                const online = !!display.last_seen_at && Date.now() - new Date(display.last_seen_at).getTime() < 90000
                const revoked = !!display.revoked_at || !display.is_active
                const link = `${window.location.origin}${import.meta.env.BASE_URL}display/${display.public_token}`
                return (
                  <article className="display-card" key={display.id}>
                    <div><span className={`status-dot ${online && !revoked ? 'online' : ''}`} /> <strong>{display.name}</strong></div>
                    <p>{display.location || 'Sem local'} · {display.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} · {display.resolution_width}×{display.resolution_height}</p>
                    <p className="display-status">{revoked ? 'Link revogado' : online ? 'Online' : 'Offline'}{display.last_seen_at ? ` · último sinal ${new Date(display.last_seen_at).toLocaleString('pt-BR')}` : ''}</p>
                    {!revoked && <a href={link} target="_blank" rel="noreferrer">Abrir link público</a>}
                    {!revoked && canManage && <button className="danger-button" type="button" onClick={() => void revokeDisplay(display.id)} disabled={busy}>Revogar link</button>}
                  </article>
                )
              })}
            </div>
          </section>

          {account && <ContentLibrary companyId={account.companyId} role={account.role} />}
        </section>
      </AppLayout>
    )
  }

  return (
    <main className="app-shell">
      <section className="panel auth-panel">
        <div className="brand-row"><div className="brand-mark" aria-hidden="true">DH</div><div><strong>DisplayHub</strong><span>Gestão de displays comerciais</span></div></div>
        <div className="auth-tabs" aria-label="Acesso"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Entrar</button><button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Criar conta</button></div>
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && <><label>Seu nome<input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} /></label><label>Empresa<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required minLength={2} /></label></>}
          <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
        </form>
      </section>
    </main>
  )
}

export default App