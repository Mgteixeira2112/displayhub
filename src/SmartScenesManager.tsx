import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { supabase } from './lib/supabase'
import { getHeroConfig, heroStylePreset, heroStyleVars, type HeroBackgroundMode, type HeroConfig, type HeroElementType, type HeroStyle } from './smart-scene-hero-config'
import './smart-scenes.css'
import './smart-scenes-hero.css'
import './smart-scenes-hero-layers.css'

type SceneKind = 'hero' | 'split' | 'spotlight' | 'data' | 'countdown' | 'panorama'
type Orientation = 'auto' | 'landscape' | 'portrait' | 'ultrawide'
type Intensity = 'minimal' | 'commercial' | 'impact' | 'immersive'
type Motion = 'soft' | 'balanced' | 'strong'
type HeroDragTarget = 'product' | 'price'
type HeroElement1Patch = Partial<Pick<HeroConfig, 'element1X' | 'element1Y' | 'element1Width' | 'element1Height' | 'element1Rotation'>>
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

const heroElementOptions: { value: HeroElementType; label: string }[] = [
  { value: 'burst', label: 'Explosão' },
  { value: 'band', label: 'Faixa' },
  { value: 'circle', label: 'Círculo' },
  { value: 'block', label: 'Bloco' },
  { value: 'glow', label: 'Brilho' },
]

function ScenePreview({ scene, headline, primaryText, secondaryText, orientation = 'auto', intensity = 'impact', motion = 'balanced', heroConfig, editableHero = false, onHeroPositionChange, onHeroElement1Change }: {
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
  onHeroElement1Change?: (patch: HeroElement1Patch) => void
}) {
  const hero = heroConfig || getHeroConfig()
  const dragRef = useRef<{ target: HeroDragTarget; pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number; width: number; height: number } | null>(null)
  const element1EditRef = useRef<{
    mode: 'move' | 'resize' | 'rotate'
    pointerId: number
    frameWidth: number
    frameHeight: number
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    startWidth: number
    startHeight: number
    startRotation: number
    centerX: number
    centerY: number
    startAngle: number
  } | null>(null)
  const displayPrimary = scene.key === 'hero'
    ? (editableHero ? (primaryText || '').trim() : (primaryText ?? 'QUEIJO MINAS FRESCAL').trim())
    : primaryText || (scene.key === 'countdown' ? '02:14:36' : scene.key === 'data' ? 'R$ 24,90' : 'DESTAQUE')
  const heroClass = scene.key === 'hero' ? ` smart-hero-style-${hero.style}` : ''
  const displaySecondary = scene.key === 'hero' ? (secondaryText || '').trim() : secondaryText || scene.accent
  const displayPrice = hero.price.trim()
  const displayUnit = hero.unit.trim()
  const videoUrl = hero.backgroundVideoUrl.trim()

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

  function beginElement1Edit(event: ReactPointerEvent<HTMLElement>, mode: 'move' | 'resize' | 'rotate') {
    if (!editableHero || scene.key !== 'hero' || !onHeroElement1Change) return
    const layer = event.currentTarget.closest('.smart-hero-style-layer')?.getBoundingClientRect()
    const element = event.currentTarget.closest('.hero-style-element')?.getBoundingClientRect()
    if (!layer || !element) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const centerX = element.left + element.width / 2
    const centerY = element.top + element.height / 2
    element1EditRef.current = {
      mode,
      pointerId: event.pointerId,
      frameWidth: Math.max(layer.width, 1),
      frameHeight: Math.max(layer.height, 1),
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: hero.element1X,
      startY: hero.element1Y,
      startWidth: hero.element1Width,
      startHeight: hero.element1Height,
      startRotation: hero.element1Rotation,
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI,
    }
  }

  function moveElement1Edit(event: ReactPointerEvent<HTMLElement>) {
    const edit = element1EditRef.current
    if (!edit || edit.pointerId !== event.pointerId || !onHeroElement1Change) return
    event.preventDefault()
    event.stopPropagation()
    if (edit.mode === 'move') {
      const x = Math.max(-60, Math.min(100, edit.startX + ((event.clientX - edit.startClientX) / edit.frameWidth) * 100))
      const y = Math.max(-60, Math.min(100, edit.startY + ((event.clientY - edit.startClientY) / edit.frameHeight) * 100))
      onHeroElement1Change({ element1X: Math.round(x), element1Y: Math.round(y) })
      return
    }
    if (edit.mode === 'resize') {
      const width = Math.max(8, Math.min(140, edit.startWidth + ((event.clientX - edit.startClientX) / edit.frameWidth) * 100))
      const height = Math.max(8, Math.min(140, edit.startHeight + ((event.clientY - edit.startClientY) / edit.frameHeight) * 100))
      onHeroElement1Change({ element1Width: Math.round(width), element1Height: Math.round(height) })
      return
    }
    const angle = Math.atan2(event.clientY - edit.centerY, event.clientX - edit.centerX) * 180 / Math.PI
    let rotation = edit.startRotation + angle - edit.startAngle
    while (rotation > 180) rotation -= 360
    while (rotation < -180) rotation += 360
    onHeroElement1Change({ element1Rotation: Math.round(rotation) })
  }

  function endElement1Edit(event: ReactPointerEvent<HTMLElement>) {
    const edit = element1EditRef.current
    if (!edit || edit.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    element1EditRef.current = null
  }

  const element1PointerHandlers = editableHero && scene.key === 'hero' ? {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => beginElement1Edit(event, 'move'),
    onPointerMove: moveElement1Edit,
    onPointerUp: endElement1Edit,
    onPointerCancel: endElement1Edit,
  } : {}

  const element1ResizeHandlers = editableHero && scene.key === 'hero' ? {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => beginElement1Edit(event, 'resize'),
    onPointerMove: moveElement1Edit,
    onPointerUp: endElement1Edit,
    onPointerCancel: endElement1Edit,
  } : {}

  const element1RotateHandlers = editableHero && scene.key === 'hero' ? {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => beginElement1Edit(event, 'rotate'),
    onPointerMove: moveElement1Edit,
    onPointerUp: endElement1Edit,
    onPointerCancel: endElement1Edit,
  } : {}

  return (
    <div
      className={`smart-scene-preview smart-scene-${scene.key} smart-scene-intensity-${intensity} smart-scene-motion-${motion}${heroClass}${editableHero && scene.key === 'hero' ? ' is-hero-editable' : ''}`}
      data-scene-orientation={orientation}
      style={scene.key === 'hero' ? heroStyleVars(hero, displayPrimary) : undefined}
      aria-hidden="true"
    >
      {scene.key === 'hero' && (
        <>
          <div className={`smart-hero-background is-${hero.backgroundMode}`}>
            {hero.backgroundMode === 'video' && videoUrl && <video className="smart-hero-background-video" src={videoUrl} autoPlay muted loop playsInline />}
          </div>
          <div className={`smart-hero-style-layer smart-hero-style-${hero.style}`}>
            {hero.element1Enabled && (editableHero
              ? <div className="hero-style-element element-1 is-editable" {...element1PointerHandlers}>
                  <i className={`hero-element-visual type-${hero.element1Type}`} />
                  <span className="hero-element-resize-handle" {...element1ResizeHandlers} />
                  <span className="hero-element-rotate-handle" {...element1RotateHandlers} />
                </div>
              : <i className={`hero-style-element element-1 type-${hero.element1Type}`} />)}
            {hero.element2Enabled && <i className={`hero-style-element element-2 type-${hero.element2Type}`} />}
            {hero.element3Enabled && <i className={`hero-style-element element-3 type-${hero.element3Type}`} />}
          </div>
        </>
      )}
      {scene.key !== 'hero' && <div className="smart-scene-glow" />}
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

  function applyHeroStyle(style: HeroStyle) {
    const [element1Type, element2Type, element3Type] = heroStylePreset(style)
    setHeroConfig((current) => ({ ...current, style, element1Type, element2Type, element3Type }))
  }

  function moveHero(target: HeroDragTarget, x: number, y: number) {
    setHeroConfig((current) => target === 'product'
      ? { ...current, productX: x, productY: y }
      : { ...current, priceX: x, priceY: y })
  }

  function transformHeroElement1(patch: HeroElement1Patch) {
    setHeroConfig((current) => ({ ...current, ...patch }))
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
    setHeroConfig(getHeroConfig(kind === 'hero' ? { hero: { price: 'R$ 24,90', unit: 'KG', style: 'explosive', backgroundMode: 'solid', backgroundColor: '#ffd400' } } : undefined))
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
          <ScenePreview scene={editorScene} headline={headline} primaryText={primaryText} secondaryText={secondaryText} orientation={orientation} intensity={intensity} motion={motion} heroConfig={heroConfig} editableHero={editorKind === 'hero'} onHeroPositionChange={moveHero} onHeroElement1Change={transformHeroElement1} />
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
                <div className="smart-hero-background-controls">
                  <strong>Fundo</strong>
                  <div className="smart-hero-mode-grid">
                    {(['none', 'solid', 'video'] as HeroBackgroundMode[]).map((mode) => <button key={mode} type="button" className={heroConfig.backgroundMode === mode ? 'is-active' : ''} onClick={() => updateHero('backgroundMode', mode)}>{mode === 'none' ? 'Nenhum' : mode === 'solid' ? 'Cor sólida' : 'Vídeo'}</button>)}
                  </div>
                  {heroConfig.backgroundMode === 'solid' && <label>Cor do fundo<input type="color" value={heroConfig.backgroundColor} onChange={(event) => updateHero('backgroundColor', event.target.value)} /></label>}
                  {heroConfig.backgroundMode === 'video' && <div className="smart-hero-video-row"><label>URL do vídeo<input type="url" value={heroConfig.backgroundVideoUrl} onChange={(event) => updateHero('backgroundVideoUrl', event.target.value)} placeholder="https://.../video.mp4" /></label></div>}
                </div>
                <div className="smart-hero-style-controls">
                  <strong>Estilo</strong>
                  <div className="smart-hero-style-grid">
                    <button type="button" className={heroConfig.style === 'explosive' ? 'is-active' : ''} onClick={() => applyHeroStyle('explosive')}>Preço explosivo animado</button>
                    <button type="button" className={heroConfig.style === 'bands' ? 'is-active' : ''} onClick={() => applyHeroStyle('bands')}>Faixas de oferta</button>
                    <button type="button" className={heroConfig.style === 'clean' ? 'is-active' : ''} onClick={() => applyHeroStyle('clean')}>Clean Motion</button>
                  </div>
                  <div className="smart-hero-element-list">
                    <div className="smart-hero-element-row">
                      <label className="smart-hero-element-toggle"><input type="checkbox" checked={heroConfig.element1Enabled} onChange={(event) => updateHero('element1Enabled', event.target.checked)} />Elemento 1</label>
                      <label>Tipo<select value={heroConfig.element1Type} onChange={(event) => updateHero('element1Type', event.target.value as HeroElementType)}>{heroElementOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                      <label>Cor<input type="color" value={heroConfig.element1Color} onChange={(event) => updateHero('element1Color', event.target.value)} /></label>
                    </div>
                    <div className="smart-hero-element-row">
                      <label className="smart-hero-element-toggle"><input type="checkbox" checked={heroConfig.element2Enabled} onChange={(event) => updateHero('element2Enabled', event.target.checked)} />Elemento 2</label>
                      <label>Tipo<select value={heroConfig.element2Type} onChange={(event) => updateHero('element2Type', event.target.value as HeroElementType)}>{heroElementOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                      <label>Cor<input type="color" value={heroConfig.element2Color} onChange={(event) => updateHero('element2Color', event.target.value)} /></label>
                    </div>
                    <div className="smart-hero-element-row">
                      <label className="smart-hero-element-toggle"><input type="checkbox" checked={heroConfig.element3Enabled} onChange={(event) => updateHero('element3Enabled', event.target.checked)} />Elemento 3</label>
                      <label>Tipo<select value={heroConfig.element3Type} onChange={(event) => updateHero('element3Type', event.target.value as HeroElementType)}>{heroElementOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                      <label>Cor<input type="color" value={heroConfig.element3Color} onChange={(event) => updateHero('element3Color', event.target.value)} /></label>
                    </div>
                  </div>
                </div>
                <div className="smart-scene-control-grid smart-scene-control-grid-three">
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
