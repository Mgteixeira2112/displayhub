import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import PromotionPosterView from './PromotionPosterView'

type Template = {
  key: string
  name: string
  description: string | null
  theme: string
  aspect_ratio: 'portrait' | 'landscape' | 'square'
}

type Filter = 'all' | 'offers' | 'drinks' | 'animated' | 'video'
type Orientation = 'portrait' | 'landscape'

function templateTags(template: Template) {
  const haystack = `${template.key} ${template.name} ${template.description || ''} ${template.theme}`.toLowerCase()
  const tags = new Set<string>(['offers'])
  if (haystack.includes('beer') || haystack.includes('cerveja') || haystack.includes('bebida')) tags.add('drinks')
  if (haystack.includes('animated')) tags.add('animated')
  if (haystack.includes('video')) tags.add('video')
  return tags
}

function typeLabel(template: Template) {
  const tags = templateTags(template)
  if (tags.has('video')) return 'Vídeo'
  if (tags.has('animated')) return 'Animado'
  return 'Estático'
}

function sectorLabel(template: Template) {
  return templateTags(template).has('drinks') ? 'Bebidas' : 'Ofertas gerais'
}

function orientationLabel(orientation: Orientation) {
  return orientation === 'portrait' ? 'Vertical' : 'Horizontal'
}

function samplePoster(template: Template, orientation: Orientation) {
  const drinks = templateTags(template).has('drinks')
  return {
    id: `gallery:${template.key}:${orientation}`,
    template_key: template.key,
    theme: template.theme,
    product_name: drinks ? 'CERVEJA 600 ML' : 'OFERTA ESPECIAL',
    price: drinks ? 7.99 : 19.9,
    unit: 'UN',
    headline: drinks ? 'GELADA E EM OFERTA' : 'PREÇO BAIXO DE VERDADE',
    footer: 'APROVEITE HOJE',
    orientation,
    layout_positions: {},
  }
}

export default function PromotionTemplateGallery() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [orientation, setOrientation] = useState<Orientation>('landscape')
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<Template | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    const { data, error } = await supabase
      .from('promotion_templates')
      .select('key,name,description,theme,aspect_ratio')
      .order('created_at')
    if (error) setMessage('Não foi possível carregar a galeria de templates.')
    else setTemplates((data || []) as Template[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return templates.filter((template) => {
      const tags = templateTags(template)
      if (filter !== 'all' && !tags.has(filter)) return false
      if (!normalizedQuery) return true
      const text = `${template.name} ${template.description || ''} ${sectorLabel(template)} ${typeLabel(template)}`.toLowerCase()
      return text.includes(normalizedQuery)
    })
  }, [filter, query, templates])

  function selectTemplate(template: Template) {
    window.dispatchEvent(new CustomEvent('displayhub:use-promotion-template', {
      detail: { key: template.key, orientation },
    }))
  }

  const orientationControl = (className = '') => (
    <div className={`promotion-gallery-orientation ${className}`.trim()} aria-label="Orientação do template">
      <span>Orientação</span>
      <div>
        <button type="button" className={orientation === 'landscape' ? 'active' : ''} onClick={() => setOrientation('landscape')}>Horizontal</button>
        <button type="button" className={orientation === 'portrait' ? 'active' : ''} onClick={() => setOrientation('portrait')}>Vertical</button>
      </div>
    </div>
  )

  return (
    <section className="promotion-gallery" aria-label="Galeria de templates">
      <header className="promotion-gallery-hero">
        <div>
          <p className="eyebrow">Campanhas prontas para supermercado</p>
          <h1>Escolha um visual e comece a criar</h1>
          <p>Modelos prontos para ofertas, promoções e campanhas. Escolha a orientação, visualize o template e comece a preencher.</p>
        </div>
        <button type="button" className="secondary-button compact" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar galeria'}</button>
      </header>

      <div className="promotion-gallery-toolbar">
        <label className="promotion-gallery-search">
          <span>Buscar template</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: cerveja, oferta, vídeo..." />
        </label>
        {orientationControl()}
        <div className="promotion-gallery-filters" aria-label="Filtrar templates">
          {([
            ['all', 'Todos'],
            ['offers', 'Ofertas'],
            ['drinks', 'Bebidas'],
            ['animated', 'Animados'],
            ['video', 'Com vídeo'],
          ] as Array<[Filter, string]>).map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
      </div>

      {message && <p className="form-message">{message}</p>}
      {!loading && visible.length === 0 && <p className="empty-state">Nenhum template encontrado com este filtro.</p>}

      <div className="promotion-gallery-grid">
        {visible.map((template) => {
          const poster = samplePoster(template, orientation)
          return (
            <article className="promotion-gallery-card" key={template.key}>
              <div className="promotion-gallery-card-preview">
                <div className={`promotion-gallery-preview-shell ${poster.orientation}`}>
                  <PromotionPosterView poster={poster} />
                </div>
                <div className="promotion-gallery-badges"><span>{sectorLabel(template)}</span><span>{typeLabel(template)}</span></div>
              </div>
              <div className="promotion-gallery-card-body">
                <div>
                  <strong>{template.name}</strong>
                  <p>{template.description || 'Template promocional pronto para personalização.'}</p>
                </div>
                <div className="promotion-gallery-meta">
                  <span>{orientationLabel(poster.orientation)}</span>
                  <span>{typeLabel(template)}</span>
                </div>
                <div className="promotion-gallery-actions">
                  <button type="button" className="secondary-button" onClick={() => setPreview(template)}>Pré-visualizar</button>
                  <button type="button" className="primary-button" onClick={() => selectTemplate(template)}>Usar template</button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {preview && (
        <div className="promotion-gallery-modal-backdrop" role="presentation" onMouseDown={() => setPreview(null)}>
          <section className="promotion-gallery-modal" role="dialog" aria-modal="true" aria-label={`Pré-visualização de ${preview.name}`} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span>{sectorLabel(preview)} · {typeLabel(preview)}</span><strong>{preview.name}</strong></div>
              <button type="button" aria-label="Fechar pré-visualização" onClick={() => setPreview(null)}>×</button>
            </header>
            {orientationControl('promotion-gallery-modal-orientation')}
            <div className="promotion-gallery-modal-preview"><PromotionPosterView poster={samplePoster(preview, orientation)} /></div>
            <footer>
              <p>{preview.description || 'Template promocional pronto para personalização.'}</p>
              <div><button type="button" className="secondary-button" onClick={() => setPreview(null)}>Voltar</button><button type="button" className="primary-button" onClick={() => { setPreview(null); selectTemplate(preview) }}>Usar este template</button></div>
            </footer>
          </section>
        </div>
      )}
    </section>
  )
}
