import { useEffect, useState } from 'react'
import StructuredContent from './StructuredContent'
import UniversalTableCsvImport from './UniversalTableCsvImport'
import { supabase } from './lib/supabase'

type Profile = { company_id: string; role: string }

export default function UniversalTablesManager() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null)
  const [galleryTarget, setGalleryTarget] = useState<HTMLDivElement | null>(null)
  const [importVersion, setImportVersion] = useState(0)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Sessão indisponível.')
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('company_id,role')
        .eq('user_id', auth.user.id)
        .single()
      if (profileError) throw profileError
      if (active) setProfile(data as Profile)
    })().catch(() => {
      if (active) setError('Não foi possível carregar o Editor Universal.')
    })
    return () => { active = false }
  }, [])

  if (error) return <p className="form-message" role="alert">{error}</p>
  if (!profile) return <p className="empty-state">Carregando conteúdo comercial...</p>

  return (
    <section className="view-library" aria-label="Editor Universal">
      <div className="software-module module-library">
        <div className="content-library-controls-stack">
          <div className="content-library-slot" ref={setControlsTarget} />
          <UniversalTableCsvImport companyId={profile.company_id} role={profile.role} onImported={() => setImportVersion((version) => version + 1)} />
        </div>
        <div className="content-library-galleries-stack">
          <div className="content-library-slot" ref={setGalleryTarget} />
        </div>
        <StructuredContent
          key={importVersion}
          companyId={profile.company_id}
          role={profile.role}
          controlsTarget={controlsTarget}
          galleryTarget={galleryTarget}
        />
      </div>
    </section>
  )
}
