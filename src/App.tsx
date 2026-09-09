import { FormEvent, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Mode = 'login' | 'signup'

type AccountSummary = {
  fullName: string
  role: string
  companyName: string
  unitName: string
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  operator: 'Operador',
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
    fullName: profile.full_name || userEmail || 'Usuário',
    role: roleLabels[profile.role] || profile.role,
    companyName: company.name,
    unitName: unit?.name || 'Sem unidade',
  }
}

function App() {
  const [mode, setMode] = useState<Mode>('login')
  const [user, setUser] = useState<User | null>(null)
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setAccount(null)
      return
    }

    void loadAccount(user.id, user.email)
      .then(setAccount)
      .catch(() => setMessage('Não foi possível carregar os dados da conta.'))
  }, [user])

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
          data: {
            full_name: fullName.trim(),
            company_name: companyName.trim(),
          },
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

  async function handleSignOut() {
    setBusy(true)
    await supabase.auth.signOut()
    setBusy(false)
  }

  if (user) {
    return (
      <main className="app-shell">
        <section className="panel account-panel">
          <div className="brand-row">
            <div className="brand-mark" aria-hidden="true">DH</div>
            <div>
              <strong>DisplayHub</strong>
              <span>Conta ativa</span>
            </div>
          </div>

          <div className="account-heading">
            <p className="eyebrow">Fase 1</p>
            <h1>{account?.companyName || 'Carregando...'}</h1>
            <p>{account?.fullName || user.email}</p>
          </div>

          <div className="account-grid">
            <article>
              <span>Unidade</span>
              <strong>{account?.unitName || '—'}</strong>
            </article>
            <article>
              <span>Permissão</span>
              <strong>{account?.role || '—'}</strong>
            </article>
            <article>
              <span>E-mail</span>
              <strong>{user.email}</strong>
            </article>
          </div>

          <button className="secondary-button" type="button" onClick={handleSignOut} disabled={busy}>
            Sair
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="panel auth-panel">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">DH</div>
          <div>
            <strong>DisplayHub</strong>
            <span>Gestão de displays comerciais</span>
          </div>
        </div>

        <div className="auth-tabs" aria-label="Acesso">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Entrar
          </button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <label>
                Seu nome
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} />
              </label>
              <label>
                Empresa
                <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required minLength={2} />
              </label>
            </>
          )}

          <label>
            E-mail
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {message && <p className="form-message" role="status">{message}</p>}

          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default App
