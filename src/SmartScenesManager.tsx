import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { supabase } from './lib/supabase'
import { getHeroConfig, heroStyleVars, type HeroConfig, type HeroPreset } from './smart-scene-hero-config'
import './smart-scenes.css'
import './smart-scenes-hero.css'

type SceneKind = 'hero' | 'split' | 'spotlight' | 'data' | 'countdown' | 'panorama'
type Orientation = 'auto' | 'landscape' | 'portrait' | 'ultrawide'
type Intensity = 'minimal' | 'commercial' | 'impact' | 'immersive'
type Motion = 'soft' | 'balanced' | 'strong'
type HeroDragTarget = 'product' | 'price'
type Scene = { key: SceneKind; name: string; category: string; orientation: string; intensity: string; accent: string }
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
  config?: Record<string, unknown>
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

function ScenePreview({ scene, headline, primaryText, secondaryText, orientation = 'auto', intensity = 'impact', motion = 'balanced', heroConfig, editableHero = false, onHeroPositionChange }: {
  scene: Scene
  headline?: string
  primaryText?: string
  secondaryText?: string
  orientation?: Orientation
  intensity?: Intensity
  motion?: Motion
  heroConfig?: HeroConfig
  editableHero?: boolean
  onHeroPositionChange?: (target: HeroDragTarget, x: number, y: number) => void
}) {
  const hero = heroConfig || getHeroConfig()
  const dragRef = useRef<{ target: HeroDragTarget; pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number; width: number; height: number } | null>(null)
  const displayPrimary = scene.key === 'hero'
    ? (editableHero ? (primaryText || '').trim() : (primaryText ?? 'QUEIJO MINAS FRESCAL').trim())
    : primaryText || (scene.key === 'countdown' ? '02:14:36' : scene.key === 'data' ? 'R$ 24,90' : 'DESTAQUE')
  const heroClass = scene.key === 'hero' ? ` smart-hero-preset-${hero.preset}` : ''
  const displaySecondary = scene.key === 'hero' ? (secondaryText || '').trim() : secondaryText || scene.accent
  const displayPrice = hero.price.trim()
  const displayUnit = hero.unit.trim()

  function heroPosition(target: HeroDragTarget) {
    if (target === 'product') return { x: hero.productX, y: hero.productY }
    return { x: hero.priceX, y: hero.priceY }
  }

  function beginHeroDrag(event: ReactPointerEvent<HTMLElement>, target: HeroDragTarget) {
    if (!editableHero || scene.key !== 'hero' || !onHeroPositionChange) return
    const frame = event.currentTarget.closest('.smart-scene-copy')?.getBoundingClientRect()
    if (!frame) return
    const position = heroPosition(target)
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      target,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: position.x,
      startY: position.y,
      width: Math.max(frame.width, 1),
      height: Math.max(frame.height, 1),
    }
  }

  function moveHeroDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !onHeroPositionChange) return
    event.preventDefault()
    const nextX = Math.max(-40, Math.min(40, drag.startX + ((event.clientX - drag.startClientX) / drag.width) * 100))
    const nextY = Math.max(-40, Math.min(40, drag.startY + ((event.clientY - drag.startClientY) / drag.height) * 100))
    onHeroPositionChange(drag.target, Math.round(nextX), Math.round(nextY))
  }

  function endHeroDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
  }

  const dragHandlers = (target: HeroDragTarget) => editableHero && scene.key === 'hero' ? {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => beginHeroDrag(event, target),
    onPointerMove: moveHeroDrag,
    onPointerUp: endHeroDrag,
    onPointerCancel: endHeroDrag,
  } : {}

  return (
    <div
      className={`smart-scene-preview smart-scene-${scene.key} smart-scene-intensity-${intensity} smart-scene-motion-${motion}${heroClass}${editableHero && scene.key === 'hero' ? ' is-hero-editable' : ''}`}
      data-scene-orientation={orientation}
      style={scene.key === 'hero' ? heroStyleVars(hero, displayPrimary) : undefined}
      aria-hidden="true"
    >
      <div className="smart-scene-glow" />
      {scene.key !== 'hero' && <div className="smart-scene-visual" />}
      <div className="smart-scene-copy">
        {scene.key !== 'hero' && <span>{headline || scene.category}</span>}
        {(scene.key !== 'hero' || displayPrimary) && <strong {...dragHandlers('product')}>{displayPrimary}</strong>}
        {scene.key === 'hero' && displayPrice && <div className="smart-hero-price-row" {...dragHandlers('price')}><b>{displayPrice}</b>{displayUnit && <em>{displayUnit}</em>}</div>}
        {(scene.key !== 'hero' || displaySecondary) && <small>{displaySecondary}</small>}
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
  const [previewOrientation, setPreviewOrientation] = useState<Orientation>('auto')
  const [previewIntensity, setPreviewIntensity] = useState<Intensity>('impact')
  const [previewMotion, setPreviewMotion] = useState<Motion>('balanced')
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
  const [heroConfig, setHeroConfig] = useState<HeroConfig>(() => getHeroConfig())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const canManage = profile?.role === 'admin' || profile?.role === 'manager'

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data: nextProfile, error: profileError } = await supabase.from('profiles').select('company_id,role').eq('user_id', userData.user.id).single()
    if (profileError) throw profileError
    setProfile(nextProfile as Profile)
    const { data, error } = await supabase.from('smart_scenes').select('id,name,scene_type,orientation,intensity,motion,headline,primary_text,secondary_text,config,created_at').order('created_at', { ascending: false })
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

  function updateHero<K extends keyof HeroConfig>(key: K, value: HeroConfig[K]) {
    setHeroConfig((current) => ({ ...current, [key]: value }))
  }

  function moveHero(target: HeroDragTarget, x: number, y: number) {
    setHeroConfig((current) => target === 'product'
      ? { ...current, productX: x, productY: y }
      : { ...current, priceX: x, priceY: y })
  }

  function toggleScene(kind: SceneKind) {
    if (expanded === kind) {
      setExpanded(null)
      return
    }
    setExpanded(kind)
    setPreviewOrientation(kind === 'panorama' ? 'ultrawide' : 'auto')
    setPreviewIntensity(kind === 'panorama' ? 'immersive' : 'impact')
    setPreviewMotion('balanced')
  }

  function openNewEditor(kind: SceneKind) {
    const scene = scenes.find((item) => item.key === kind)
    if (!scene) return
    setEditingId(null)
    setEditorKind(kind)
    setName(scene.name)
    setOrientation(expanded === kind ? previewOrientation : kind === 'panorama' ? 'ultrawide' : 'auto')
    setIntensity(expanded === kind ? previewIntensity : kind === 'panorama' ? 'immersive' : 'impact')
    setMotion(expanded === kind ? previewMotion : 'balanced')
    setHeadline(kind === 'hero' ? '' : scene.category.toUpperCase())
    setPrimaryText(kind === 'hero' ? 'QUEIJO MINAS FRESCAL' : kind === 'countdown' ? '02:14:36' : kind === 'data' ? 'R$ 24,90' : 'DESTAQUE')
    setSecondaryText(kind === 'hero' ? 'Aproveite hoje' : scene.accent)
    setHeroConfig(getHeroConfig(kind === 'hero' ? { hero: { price: 'R$ 24,90', unit: 'KG' } } : undefined))
    setMessage('')
  }

  function editSaved(scene: SavedScene) {
    setEditingId(scene.id)
    setEditorKind(scene.scene_type)
    setName(scene.name)
    setOrientation(scene.orientation)
    setIntensity(scene.intensity)
    setMotion(scene.motion)
    setHeadline(scene.scene_type === 'hero' ? '' : scene.headline)
    setPrimaryText(scene.primary_text)
    setSecondaryText(scene.secondary_text)
    setHeroConfig(getHeroConfig(scene.config))
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
      headline: editorKind === 'hero' ? '' : headline.trim(),
      primary_text: primaryText.trim(),
      secondary_text: secondaryText.trim(),
      config: editorKind === 'hero' ? { hero: heroConfig } : {},
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
          <ScenePreview scene={editorScene} headline={headline} primaryText={primaryText} secondaryText={secondaryText} orientation={orientation} intensity={intensity} motion={motion} heroConfig={heroConfig} editableHero={editorKind === 'hero'} onHeroPositionChange={moveHero} />
          <div className="smart-scene-editor-fields">
            <div className="smart-scene-editor-title"><strong>{editingId ? 'Editar Smart Scene' : 'Nova Smart Scene'}</strong><button type="button" onClick={() => { setEditorKind(null); setEditingId(null) }}>×</button></div>
            <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} /></label>
            <div className="smart-scene-control-grid smart-scene-control-grid-three">
              <label>Orientação<select value={orientation} onChange={(event) => setOrientation(event.target.value as Orientation)}><option value="auto">Automática</option><option value="landscape">Horizontal</option><option value="portrait">Vertical</option><option value="ultrawide">Ultrawide / Wall</option></select></label>
              <label>Intensidade<select value={intensity} onChange={(event) => setIntensity(event.target.value as Intensity)}><option value="minimal">Minimal</option><option value="commercial">Comercial</option><option value="impact">Impacto</option><option value="immersive">Imersivo</option></select></label>
              <label>Movimento<select value={motion} onChange={(event) => setMotion(event.target.value as Motion)}><option value="soft">Suave</option><option value="balanced">Equilibrado</option><option value="strong">Marcante</option></select></label>
            </div>
            {editorKind === 'hero' && (
              <div className="smart-hero-editor-block">
                <div className="smart-scene-control-grid smart-scene-control-grid-three">
                  <label>Visual<select value={heroConfig.preset} onChange={(event) => updateHero('preset', event.target.value as HeroPreset)}><option value="tabloid">Tabloide Clássico</option><option value="explosive">Oferta Explosiva</option><option value="clean">Oferta Limpa</option></select></label>
                  <label>Preço<input value={heroConfig.price} onChange={(event) => updateHero('price', event.target.value)} maxLength={32} /></label>
                  <label>Unidade<input value={heroConfig.unit} onChange={(event) => updateHero('unit', event.target.value)} maxLength={16} /></label>
                </div>
                <div className="smart-hero-text-control">
                  <strong>Produto</strong>
                  <label>Cor<input type="color" value={heroConfig.productColor} onChange={(event) => updateHero('productColor', event.target.value)} /></label>
                  <label>Tamanho<input type="range" min="60" max="150" value={heroConfig.productSize} onChange={(event) => updateHero('productSize', Number(event.target.value))} /><span>{heroConfig.productSize}%</span></label>
                  <label>Rotação<input type="range" min="-15" max="15" value={heroConfig.productRotation} onChange={(event) => updateHero('productRotation', Number(event.target.value))} /><span>{heroConfig.productRotation}°</span></label>
                </div>
                <div className="smart-hero-text-control">
                  <strong>Preço</strong>
                  <label>Cor<input type="color" value={heroConfig.priceColor} onChange={(event) => updateHero('priceColor', event.target.value)} /></label>
                  <label>Tamanho<input type="range" min="60" max="160" value={heroConfig.priceSize} onChange={(event) => updateHero('priceSize', Number(event.target.value))} /><span>{heroConfig.priceSize}%</span></label>
                  <label>Rotação<input type="range" min="-15" max="15" value={heroConfig.priceRotation} onChange={(event) => updateHero('priceRotation', Number(event.target.value))} /><span>{heroConfig.priceRotation}°</span></label>
                </div>
              </div>
            )}
            {editorKind !== 'hero' && <label>Chamada<input value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={120} /></label>}
            <label>{editorKind === 'hero' ? 'Produto' : 'Destaque'}<input value={primaryText} onChange={(event) => setPrimaryText(event.target.value)} maxLength={160} /></label>
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
              <button className="smart-scene-row-head" type="button" onClick={() => toggleScene(scene.key)} aria-expanded={open}>
                <div className="smart-scene-row-copy"><strong>{scene.name}</strong><span>{scene.accent}</span></div>
                <div className="smart-scene-row-meta"><span>{scene.category}</span><span>{scene.orientation}</span><span>{scene.intensity}</span></div>
                <span className="smart-scene-chevron" aria-hidden="true">⌄</span>
              </button>
              {open && (
                <div className="smart-scene-panel">
                  <ScenePreview scene={scene} orientation={previewOrientation} intensity={previewIntensity} motion={previewMotion} />
                  <div className="smart-scene-panel-controls">
                    <div className="smart-scene-control-grid">
                      <label>Orientação<select value={previewOrientation} onChange={(event) => setPreviewOrientation(event.target.value as Orientation)}><option value="auto">Automática</option><option value="landscape">Horizontal</option><option value="portrait">Vertical</option><option value="ultrawide">Ultrawide / Wall</option></select></label>
                      <label>Intensidade<select value={previewIntensity} onChange={(event) => setPreviewIntensity(event.target.value as Intensity)}><option value="minimal">Minimal</option><option value="commercial">Comercial</option><option value="impact">Impacto</option><option value="immersive">Imersivo</option></select></label>
                      <label>Movimento<select value={previewMotion} onChange={(event) => setPreviewMotion(event.target.value as Motion)}><option value="soft">Suave</option><option value="balanced">Equilibrado</option><option value="strong">Marcante</option></select></label>
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
