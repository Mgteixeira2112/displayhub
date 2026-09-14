import { useMemo, useState } from 'react'
import './smart-scenes.css'

type SceneKind = 'hero' | 'split' | 'spotlight' | 'data' | 'countdown' | 'panorama'
type Scene = {
  key: SceneKind
  name: string
  category: string
  orientation: string
  intensity: string
  accent: string
}

const scenes: Scene[] = [
  { key: 'hero', name: 'Hero Impact', category: 'Impacto', orientation: 'Horizontal / Vertical', intensity: 'Alta', accent: 'Oferta principal' },
  { key: 'split', name: 'Split Motion', category: 'Comercial', orientation: 'Horizontal / Vertical', intensity: 'Média', accent: 'Visual + informação' },
  { key: 'spotlight', name: 'Spotlight', category: 'Premium', orientation: 'Horizontal / Vertical', intensity: 'Média', accent: 'Produto em destaque' },
  { key: 'data', name: 'Data Live', category: 'Dinâmico', orientation: 'Horizontal / Vertical', intensity: 'Alta', accent: 'Dados em tempo real' },
  { key: 'countdown', name: 'Countdown', category: 'Urgência', orientation: 'Horizontal / Vertical', intensity: 'Alta', accent: 'Contagem regressiva' },
  { key: 'panorama', name: 'Panorama', category: 'Video Wall', orientation: 'Ultrawide / Wall', intensity: 'Imersiva', accent: 'Múltiplas telas' },
]

function ScenePreview({ scene }: { scene: Scene }) {
  return (
    <div className={`smart-scene-preview smart-scene-${scene.key}`} aria-hidden="true">
      <div className="smart-scene-glow" />
      <div className="smart-scene-visual" />
      <div className="smart-scene-copy">
        <span>{scene.category}</span>
        <strong>{scene.key === 'countdown' ? '02:14:36' : scene.key === 'data' ? 'R$ 24,90' : 'DESTAQUE'}</strong>
        <small>{scene.accent}</small>
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

  const visibleScenes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    return scenes.filter((scene) => {
      const matchesQuery = !normalized || `${scene.name} ${scene.category} ${scene.accent}`.toLocaleLowerCase('pt-BR').includes(normalized)
      const matchesFilter = filter === 'all' || (filter === 'dynamic' && ['data', 'countdown'].includes(scene.key)) || (filter === 'wall' && scene.key === 'panorama')
      return matchesQuery && matchesFilter
    })
  }, [query, filter])

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
                      <label>Orientação<select defaultValue="auto"><option value="auto">Automática</option><option value="landscape">Horizontal</option><option value="portrait">Vertical</option></select></label>
                      <label>Intensidade<select defaultValue="impact"><option value="minimal">Minimal</option><option value="commercial">Comercial</option><option value="impact">Impacto</option><option value="immersive">Imersivo</option></select></label>
                      <label>Movimento<select defaultValue="balanced"><option value="soft">Suave</option><option value="balanced">Equilibrado</option><option value="strong">Marcante</option></select></label>
                    </div>
                    <button className="primary-button smart-scene-use" type="button">Usar esta cena</button>
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
