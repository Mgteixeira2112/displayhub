import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import './smart-scenes.css'

type SceneKind = 'hero' | 'split' | 'spotlight' | 'data' | 'countdown' | 'panorama'
type Orientation = 'auto' | 'landscape' | 'portrait' | 'ultrawide'
type Intensity = 'minimal' | 'commercial' | 'impact' | 'immersive'
type Motion = 'soft' | 'balanced' | 'strong'
type Scene = {
  key: SceneKind
  name: string
  category: string
  orientation: string
  intensity: string
  accent: string
}
type SavedScene = {
  id: string
  name: string
  scene_type: SceneKind
  orientation: Orientation
  intensity: Intensity
  motion: Motion
  headline: string
  primary_text: string
  secondary_text: string
  created_at: string
}

type Profile = { company_id: string; role: string }

const scenes: Scene[] = [
  { key: 'hero', name: 'Hero Impact', category: 'Impacto', orientation: 'Horizontal / Vertical', intensity: 'Alta', accent: 'Oferta principal' },
  { key: 'split', name: 'Split Motion', category: 'Comercial', orientation: 'Horizontal / Vertical', intensity: 'Média', accent: 'Visual + informação' },
  { key: 'spotlight', name: 'Spotlight', category: 'Premium', orientation: 'Horizontal / Vertical', intensity: 'Média', accent: 'Produto em destaque' },
  { key: 'data', name: 'Data Live', category: 'Dinâmico', orientation: 'Horizontal / Vertical', intensity: 'Alta', accent: 'Dados em tempo real' },
  { key: 'countdown', name: 'Countdown', category: 'Urgência', orientation: 'Horizontal / Vertical', intensity: 'Alta', accent: 'Contagem regressiva' },
  { key: 'panorama', name: 'Panorama', category: 'Video Wall', orientation: 'Ultrawide / Wall', intensity: 'Imersiva', accent: 'Múltiplas telas' },
]

function ScenePreview({ scene, headline, primaryText, secondaryText }: { scene: Scene; headline?: string; primaryText?: string; secondaryText?: string }) {
  return (
    <div className={`smart-scene-preview smart-scene-${scene.key}`} aria-hidden="true">
      <div className="smart-scene-glow" />
      <div className="smart-scene-visual" />
      <div className="smart-scene-copy">
        <span>{headline || scene.category}</span>
        <strong>{primaryText || (scene.key === 'countdown' ? '02:14:36' : scene.key === 'data' ? 'R$ 24,90' : 'DESTAQUE')}</strong>
        <small>{secondaryText || scene.accent}</small>
      </div>
      {scene.key === 'panorama' && <div className="smart-scene-wall-grid"><i/><i/><i/></div>}
      {scene.key === 'split' && <div className="smart-scene-split-line" />}
    </div>
  )
}

export default function SmartScenesManager() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'dynamic' | 'wall'>('all')
  const [expanded, setExpanded] = useState<SceneKind | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [savedScenes, setSavedScenes] = useState<SavedScene[]>([])
  const [editorKind, setEditorKind] = useState<SceneKind | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [orientation, setOrientation] = useState<Orientation>('auto')
  const [intensity, setIntensity] = useState<Intensity>('impact')
  const [motion, setMotion] = useState<Motion>('balanced')
  const [headline, setHeadline] = useState('')
  const [primaryText, setPrimaryText] = useState('')
  const [secondaryText, setSecondaryText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const canManage = profile?.role === 'admin' || profile?.role === 'manager'

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data: nextProfile, error: profileError } = await supabase.from('profiles').select('company_id,role').eq('user_id', userData.user.id).single()
    if (profileError) throw profileError
    setProfile(nextProfile as Profile)
    const { data, error } = await supabase.from('smart_scenes').select('id,name,scene_type,orientation,intensity,motion,headline,primary_text,secondary_text,created_at').order('created_at', { ascending: false })
    if (error) throw error
    setSavedScenes((data || []) as SavedScene[])
  }, [])

  useEffect(() => { void load().catch(() => setMessage('Não foi possível carregar as Smart Scenes.')) }, [load])

  const visibleScenes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    return scenes.filter((scene) => {
      const matchesQuery = !normalized || `${scene.name} ${scene.category} ${scene.accent}`.toLocaleLowerCase('pt-BR').includes(normalized)
      const matchesFilter = filter === 'all' || (filter === 'dynamic' && ['data', 'countdown'].includes(scene.key)) || (filter === 'wall' && scene.key === 'panorama')
      return matchesQuery && matchesFilter
    })
  }, [query, filter])

  const editorScene = scenes.find((scene) => scene.key === editorKind) || null

  function openNewEditor(kind: SceneKind) {
    const scene = scenes.find((item) => item.key === kind)
    if (!scene) return
    setEditingId(null)
    setEditorKind(kind)
    setName(scene.name)
    setOrientation(kind === 'panorama' ? 'ultrawide' : 'auto')
    setIntensity(kind === 'panorama' ? 'immersive' : 'impact')
    setMotion('balanced')
    setHeadline(scene.category.toUpperCase())
    setPrimaryText(kind === 'countdown' ? '02:14:36' : kind === 'data' ? 'R$ 24,90' : 'DESTAQUE')
    setSecondaryText(scene.accent)
    setMessage('')
  }

  function editSaved(scene: SavedScene) {
    setEditingId(scene.id)
    setEditorKind(scene.scene_type)
    setName(scene.name)
    setOrientation(scene.orientation)
    setIntensity(scene.intensity)
    setMotion(scene.motion)
    setHeadline(scene.headline)
    setPrimaryText(scene.primary_text)
    setSecondaryText(scene.secondary_text)
    setMessage('')
  }

  async function saveScene(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile || !editorKind || !canManage) return
    setBusy(true)
    setMessage('')
    const payload = {
      name: name.trim(),
      scene_type: editorKind,
      orientation,
      intensity,
      motion,
      headline: headline.trim(),
      primary_text: primaryText.trim(),
      secondary_text: secondaryText.trim(),
      config: {},
      is_active: true,
    }
    const result = editingId
      ? await supabase.from('smart_scenes').update(payload).eq('id', editingId)
      : await supabase.from('smart_scenes').insert({ ...payload, company_id: profile.company_id })
    if (result.error) {
      setMessage(result.error.message)
      setBusy(false)
      return
    }
    await load()
    setMessage(editingId ? 'Smart Scene atualizada.' : 'Smart Scene criada.')
    setEditingId(null)
    setEditorKind(null)
    setBusy(false)
  }

  async function removeScene(id: string) {
    if (!canManage) return
    setBusy(true)
    const { error } = await supabase.from('smart_scenes').delete().eq('id', id)
    if (error) setMessage(error.message)
    else await load()
    setBusy(false)
  }

  return (
    <section className="smart-scenes-workspace">
      <div className="smart-scenes-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar Smart Scene" aria-label="Buscar Smart Scene" />
        <div className="smart-scenes-filters" role="group" aria-label="Filtrar Smart Scenes">
          <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Todas</button>
          <button type="button" className={filter === 'dynamic' ? 'is-active' : ''} onClick={() => setFilter('dynamic')}>Dinâmicas</button>
          <button type="button" className={filter === 'wall' ? 'is-active' : ''} onClick={() => setFilter('wall')}>Video Wall</button>
        </div>
      </div>

      {editorScene && (
        <form className="smart-scene-editor" onSubmit={saveScene}>
          <ScenePreview scene={editorScene} headline={headline} primaryText={primaryText} secondaryText={secondaryText} />
          <div className="smart-scene-editor-fields">
            <div className="smart-scene-editor-title"><strong>{editingId ? 'Editar Smart Scene' : 'Nova Smart Scene'}</strong><button type="button" onClick={() => { setEditorKind(null); setEditingId(null) }}>×</button></div>
            <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} /></label>
            <div className="smart-scene-control-grid smart-scene-control-grid-three">
              <label>Orientação<select value={orientation} onChange={(event) => setOrientation(event.target.value as Orientation)}><option value="auto">Automática</option><option value="landscape">Horizontal</option><option value="portrait">Vertical</option><option value="ultrawide">Ultrawide / Wall</option></select></label>
              <label>Intensidade<select value={intensity} onChange={(event) => setIntensity(event.target.value as Intensity)}><option value="minimal">Minimal</option><option value="commercial">Comercial</option><option value="impact">Impacto</option><option value="immersive">Imersivo</option></select></label>
              <label>Movimento<select value={motion} onChange={(event) => setMotion(event.target.value as Motion)}><option value="soft">Suave</option><option value="balanced">Equilibrado</option><option value="strong">Marcante</option></select></label>
            </div>
            <label>Chamada<input value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={120} /></label>
            <label>Destaque<input value={primaryText} onChange={(event) => setPrimaryText(event.target.value)} maxLength={160} /></label>
            <label>Complemento<input value={secondaryText} onChange={(event) => setSecondaryText(event.target.value)} maxLength={240} /></label>
            <div className="smart-scene-editor-actions"><button className="primary-button" type="submit" disabled={busy || !canManage}>{editingId ? 'Salvar alterações' : 'Criar Smart Scene'}</button><button className="secondary-button" type="button" onClick={() => { setEditorKind(null); setEditingId(null) }}>Cancelar</button></div>
          </div>
        </form>
      )}

      {message && <p className="form-message" role="status">{message}</p>}

      {savedScenes.length > 0 && (
        <section className="smart-scenes-saved">
          <div className="smart-scenes-saved-head"><strong>Minhas Smart Scenes</strong><span>{savedScenes.length}</span></div>
          <div className="smart-scenes-saved-list">
            {savedScenes.map((saved) => (
              <article key={saved.id}>
                <div><strong>{saved.name}</strong><span>{scenes.find((scene) => scene.key === saved.scene_type)?.name || saved.scene_type} · {saved.orientation} · {saved.intensity}</span></div>
                {canManage && <div className="smart-scenes-saved-actions"><button type="button" onClick={() => editSaved(saved)}>Editar</button><button type="button" onClick={() => void removeScene(saved.id)} disabled={busy}>Excluir</button></div>}
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="smart-scenes-list">
        {visibleScenes.map((scene) => {
          const open = expanded === scene.key
          return (
            <article className={`smart-scene-row ${open ? 'is-expanded' : ''}`} key={scene.key}>
              <button className="smart-scene-row-head" type="button" onClick={() => setExpanded(open ? null : scene.key)} aria-expanded={open}>
                <div className="smart-scene-row-copy"><strong>{scene.name}</strong><span>{scene.accent}</span></div>
                <div className="smart-scene-row-meta"><span>{scene.category}</span><span>{scene.orientation}</span><span>{scene.intensity}</span></div>
                <span className="smart-scene-chevron" aria-hidden="true">⌄</span>
              </button>
              {open && (
                <div className="smart-scene-panel">
                  <ScenePreview scene={scene} />
                  <div className="smart-scene-panel-controls">
                    <div className="smart-scene-control-grid">
                      <label>Orientação<select defaultValue={scene.key === 'panorama' ? 'ultrawide' : 'auto'} disabled><option value="auto">Automática</option><option value="ultrawide">Ultrawide / Wall</option></select></label>
                      <label>Intensidade<select defaultValue={scene.key === 'panorama' ? 'immersive' : 'impact'} disabled><option value="impact">Impacto</option><option value="immersive">Imersivo</option></select></label>
                      <label>Movimento<select defaultValue="balanced" disabled><option value="balanced">Equilibrado</option></select></label>
                    </div>
                    <button className="primary-button smart-scene-use" type="button" onClick={() => openNewEditor(scene.key)} disabled={!canManage}>Usar esta cena</button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
        {visibleScenes.length === 0 && <p className="empty-state">Nenhuma Smart Scene encontrada.</p>}
      </div>
    </section>
  )
}
