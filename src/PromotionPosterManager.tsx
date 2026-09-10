import { FormEvent, PointerEvent as ReactPointerEvent, type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'

type Props = { companyId: string; role: string }
type Orientation = 'portrait' | 'landscape'
type ElementKey = 'headline' | 'product' | 'price' | 'unit' | 'footer'
type TextAlign = 'left' | 'center' | 'right'
type ElementLayout = { x?: number; y?: number; width?: number; align?: TextAlign }
type OrientationLayout = Partial<Record<ElementKey, ElementLayout>>
type LayoutPositions = Partial<Record<Orientation, OrientationLayout>>
type Template = { key: string; name: string; description: string | null; theme: 'hot_red' | 'burst_yellow' | 'price_blast'; aspect_ratio: 'portrait' | 'landscape' | 'square' }
type Poster = { id: string; template_key: string; product_name: string; price: number; unit: string | null; headline: string; footer: string | null; orientation: Orientation; layout_positions: LayoutPositions; created_at: string }

const elementKeys: ElementKey[] = ['headline', 'product', 'price', 'unit', 'footer']
const elementLabels: Record<ElementKey, string> = { headline: 'Chamada', product: 'Produto', price: 'Preço', unit: 'Unidade', footer: 'Rodapé' }

function moneyInput(value: string) {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function moneyLabel(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeLayoutPositions(value: unknown): LayoutPositions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const result: LayoutPositions = {}
  for (const orientation of ['portrait', 'landscape'] as Orientation[]) {
    const rawLayout = source[orientation]
    if (!rawLayout || typeof rawLayout !== 'object' || Array.isArray(rawLayout)) continue
    const layout: OrientationLayout = {}
    for (const key of elementKeys) {
      const rawElement = (rawLayout as Record<string, unknown>)[key]
      if (!rawElement || typeof rawElement !== 'object' || Array.isArray(rawElement)) continue
      const item = rawElement as Record<string, unknown>
      const normalized: ElementLayout = {}
      if (typeof item.x === 'number' && Number.isFinite(item.x)) normalized.x = clamp(item.x, 0, 100)
      if (typeof item.y === 'number' && Number.isFinite(item.y)) normalized.y = clamp(item.y, 0, 100)
      if (typeof item.width === 'number' && Number.isFinite(item.width)) normalized.width = clamp(item.width, 15, 100)
      if (item.align === 'left' || item.align === 'center' || item.align === 'right') normalized.align = item.align
      if (Object.keys(normalized).length > 0) layout[key] = normalized
    }
    result[orientation] = layout
  }
  return result
}

export default function PromotionPosterManager({ companyId, role }: Props) {
  const canManage = role === 'admin' || role === 'manager'
  const [templates, setTemplates] = useState<Template[]>([])
  const [posters, setPosters] = useState<Poster[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [templateKey, setTemplateKey] = useState('oferta_quente')
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [productName, setProductName] = useState('ARROZ TIPO 1')
  const [price, setPrice] = useState('24,90')
  const [unit, setUnit] = useState('5 KG')
  const [headline, setHeadline] = useState('OFERTA QUENTE!')
  const [footer, setFooter] = useState('Aproveite!')
  const [layoutPositions, setLayoutPositions] = useState<LayoutPositions>({})
  const [selectedElement, setSelectedElement] = useState<ElementKey>('product')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const dragRef = useRef<{ key: ElementKey; orientation: Orientation; pointerId: number; posterRect: DOMRect } | null>(null)

  const selectedTemplate = useMemo(() => templates.find((item) => item.key === templateKey) || null, [templates, templateKey])
  const previewPrice = moneyInput(price) ?? 0
  const selectedElementLayout = layoutPositions[orientation]?.[selectedElement] || {}
  const selectedWidth = selectedElementLayout.width ?? 88
  const selectedAlign = selectedElementLayout.align ?? 'center'

  const load = useCallback(async () => {
    const [templateResult, posterResult] = await Promise.all([
      supabase.from('promotion_templates').select('key,name,description,theme,aspect_ratio').order('created_at'),
      supabase.from('promotion_posters').select('id,template_key,product_name,price,unit,headline,footer,orientation,layout_positions,created_at').order('created_at', { ascending: false }),
    ])
    if (templateResult.error) throw templateResult.error
    if (posterResult.error) throw posterResult.error
    setTemplates((templateResult.data || []) as Template[])
    setPosters((posterResult.data || []).map((item) => ({
      ...item,
      price: Number(item.price),
      orientation: item.orientation || 'portrait',
      layout_positions: normalizeLayoutPositions(item.layout_positions),
    })) as Poster[])
  }, [])

  useEffect(() => { void load().catch(() => setMessage('Não foi possível carregar os cartazes promocionais.')) }, [load])

  function resetForm() {
    setEditingId(null)
    setTemplateKey('oferta_quente')
    setOrientation('portrait')
    setProductName('ARROZ TIPO 1')
    setPrice('24,90')
    setUnit('5 KG')
    setHeadline('OFERTA QUENTE!')
    setFooter('Aproveite!')
    setLayoutPositions({})
    setSelectedElement('product')
  }

  function updateElementLayout(targetOrientation: Orientation, key: ElementKey, changes: Partial<ElementLayout>) {
    setLayoutPositions((current) => ({
      ...current,
      [targetOrientation]: {
        ...(current[targetOrientation] || {}),
        [key]: { ...(current[targetOrientation]?.[key] || {}), ...changes },
      },
    }))
  }

  function setElementPoint(targetOrientation: Orientation, key: ElementKey, x: number, y: number) {
    updateElementLayout(targetOrientation, key, { x: clamp(x, 2, 98), y: clamp(y, 2, 98) })
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>, key: ElementKey, targetOrientation: Orientation) {
    if (!canManage) return
    const poster = event.currentTarget.closest('.promo-poster') as HTMLElement | null
    if (!poster) return
    event.preventDefault()
    event.stopPropagation()
    setSelectedElement(key)
    const posterRect = poster.getBoundingClientRect()
    const currentPoint = layoutPositions[targetOrientation]?.[key]
    if (typeof currentPoint?.x !== 'number' || typeof currentPoint?.y !== 'number') {
      const elementRect = event.currentTarget.getBoundingClientRect()
      setElementPoint(
        targetOrientation,
        key,
        ((elementRect.left + elementRect.width / 2 - posterRect.left) / posterRect.width) * 100,
        ((elementRect.top + elementRect.height / 2 - posterRect.top) / posterRect.height) * 100,
      )
    }
    dragRef.current = { key, orientation: targetOrientation, pointerId: event.pointerId, posterRect }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>, key: ElementKey, targetOrientation: Orientation) {
    const drag = dragRef.current
    if (!drag || drag.key !== key || drag.orientation !== targetOrientation || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    const { posterRect } = drag
    setElementPoint(
      targetOrientation,
      key,
      ((event.clientX - posterRect.left) / posterRect.width) * 100,
      ((event.clientY - posterRect.top) / posterRect.height) * 100,
    )
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
  }

  function restoreTemplateLayout(targetOrientation: Orientation) {
    setLayoutPositions((current) => ({ ...current, [targetOrientation]: {} }))
    setMessage(`Layout ${targetOrientation === 'portrait' ? 'vertical' : 'horizontal'} restaurado. Salve o cartaz para gravar a alteração.`)
  }

  async function savePoster(event: FormEvent) {
    event.preventDefault()
    if (!canManage) return
    const parsedPrice = moneyInput(price)
    if (parsedPrice === null || parsedPrice < 0) { setMessage('Informe um preço válido.'); return }
    setBusy(true); setMessage('')
    try {
      const payload = {
        template_key: templateKey,
        product_name: productName.trim(),
        price: parsedPrice,
        unit: unit.trim() || null,
        headline: headline.trim(),
        footer: footer.trim() || null,
        orientation,
        layout_positions: layoutPositions,
      }
      const result = editingId
        ? await supabase.from('promotion_posters').update(payload).eq('id', editingId)
        : await supabase.from('promotion_posters').insert({ company_id: companyId, ...payload })
      if (result.error) throw result.error
      await load()
      setMessage(editingId ? 'Cartaz atualizado com sucesso.' : 'Cartaz salvo com sucesso.')
      resetForm()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o cartaz.')
    } finally { setBusy(false) }
  }

  function editPoster(poster: Poster) {
    setEditingId(poster.id)
    setTemplateKey(poster.template_key)
    setOrientation(poster.orientation)
    setProductName(poster.product_name)
    setPrice(String(poster.price).replace('.', ','))
    setUnit(poster.unit || '')
    setHeadline(poster.headline)
    setFooter(poster.footer || '')
    setLayoutPositions(poster.layout_positions || {})
    setSelectedElement('product')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function duplicatePoster(poster: Poster) {
    if (!canManage) return
    setBusy(true); setMessage('')
    try {
      const { error } = await supabase.from('promotion_posters').insert({
        company_id: companyId,
        template_key: poster.template_key,
        product_name: `${poster.product_name} CÓPIA`,
        price: poster.price,
        unit: poster.unit,
        headline: poster.headline,
        footer: poster.footer,
        orientation: poster.orientation,
        layout_positions: poster.layout_positions || {},
      })
      if (error) throw error
      await load(); setMessage('Cartaz duplicado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível duplicar o cartaz.') } finally { setBusy(false) }
  }

  async function removePoster(id: string) {
    if (!canManage) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from('promotion_posters').delete().eq('id', id)
    if (error) setMessage(error.message)
    else { await load(); setMessage('Cartaz excluído.') }
    setBusy(false)
  }

  function posterPreview(
    theme: string,
    posterOrientation: Orientation,
    values: { product_name: string; price: number; unit: string | null; headline: string; footer: string | null },
    positions: LayoutPositions = {},
    editable = false,
  ) {
    const currentLayout = positions[posterOrientation] || {}
    const propsFor = (key: ElementKey, baseClass: string) => {
      const item = currentLayout[key] || {}
      const hasPosition = typeof item.x === 'number' && typeof item.y === 'number'
      const className = `${baseClass} promo-element${hasPosition ? ' promo-custom-position' : ''}${editable ? ' promo-draggable' : ''}${editable && selectedElement === key ? ' promo-selected' : ''}`
      const style: CSSProperties = {}
      if (hasPosition) { style.left = `${item.x}%`; style.top = `${item.y}%` }
      if (typeof item.width === 'number') { style.width = `${item.width}%`; style.maxWidth = `${item.width}%` }
      if (item.align) style.textAlign = item.align
      return {
        className,
        style: Object.keys(style).length ? style : undefined,
        onPointerDown: editable ? (event: ReactPointerEvent<HTMLElement>) => startDrag(event, key, posterOrientation) : undefined,
        onPointerMove: editable ? (event: ReactPointerEvent<HTMLElement>) => moveDrag(event, key, posterOrientation) : undefined,
        onPointerUp: editable ? endDrag : undefined,
        onPointerCancel: editable ? endDrag : undefined,
      }
    }

    return (
      <div className={`promo-poster promo-${posterOrientation} promo-theme-${theme}${editable ? ' promo-editable' : ''}`}>
        <div className="promo-poster-shape" aria-hidden="true" />
        <div className="promo-poster-content">
          <span {...propsFor('headline', 'promo-headline')}>{values.headline}</span>
          <strong {...propsFor('product', 'promo-product')}>{values.product_name}</strong>
          <div {...propsFor('price', 'promo-price')}>{moneyLabel(values.price)}</div>
          {values.unit && <span {...propsFor('unit', 'promo-unit')}>{values.unit}</span>}
          {values.footer && <em {...propsFor('footer', 'promo-footer')}>{values.footer}</em>}
        </div>
      </div>
    )
  }

  return (
    <section className="workspace-section promotion-workspace">
      <div className="section-heading"><div><p className="eyebrow">Promoções</p><h2>Gerador de Cartazes</h2><p>Escolha um fundo, orientação, produto e preço e monte o cartaz visualmente.</p></div><button className="secondary-button compact" type="button" onClick={() => void load()} disabled={busy}>Atualizar</button></div>
      {message && <p className="form-message" role="status">{message}</p>}

      <div className="promotion-editor-grid">
        <form className="promotion-form" onSubmit={savePoster}>
          <h3>{editingId ? 'Editar cartaz' : 'Novo cartaz'}</h3>
          <label>Fundo / template<select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} disabled={!canManage}>{templates.map((template) => <option value={template.key} key={template.key}>{template.name}</option>)}</select></label>
          {selectedTemplate?.description && <small className="promotion-template-help">{selectedTemplate.description}</small>}
          <label>Orientação<select value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)} disabled={!canManage}><option value="portrait">Vertical · 1080×1920</option><option value="landscape">Horizontal · 1920×1080</option></select></label>
          <label>Chamada<input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={60} required /></label>
          <label>Produto<input value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={120} required /></label>
          <div className="inline-fields"><label>Preço<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required /></label><label>Unidade<input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={30} placeholder="KG, UN, 2L..." /></label></div>
          <label>Rodapé<input value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={80} placeholder="Aproveite!" /></label>

          {canManage && <div className="promotion-box-controls">
            <strong>Ajustar caixa de texto</strong>
            <label>Elemento<select value={selectedElement} onChange={(e) => setSelectedElement(e.target.value as ElementKey)}>{elementKeys.map((key) => <option key={key} value={key}>{elementLabels[key]}</option>)}</select></label>
            <label>Largura da caixa · {Math.round(selectedWidth)}%
              <input type="range" min="15" max="100" step="1" value={selectedWidth} onChange={(e) => updateElementLayout(orientation, selectedElement, { width: Number(e.target.value) })} />
            </label>
            <label>Alinhamento<select value={selectedAlign} onChange={(e) => updateElementLayout(orientation, selectedElement, { align: e.target.value as TextAlign })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
            <small>Os ajustes valem somente para {orientation === 'portrait' ? 'Vertical' : 'Horizontal'}.</small>
          </div>}

          {canManage && <div className="promotion-actions"><button className="primary-button" type="submit" disabled={busy}>{editingId ? 'Salvar alterações' : 'Salvar cartaz'}</button><button className="secondary-button" type="button" onClick={() => restoreTemplateLayout(orientation)} disabled={busy}>Restaurar layout</button>{editingId && <button className="secondary-button" type="button" onClick={resetForm} disabled={busy}>Cancelar</button>}</div>}
        </form>

        <div className="promotion-preview-panel">
          <span>Pré-visualização · {orientation === 'portrait' ? 'Vertical' : 'Horizontal'}</span>
          {canManage && <small className="promotion-drag-hint">Arraste os textos no cartaz. O elemento clicado fica selecionado para ajustar largura e alinhamento.</small>}
          {posterPreview(selectedTemplate?.theme || 'hot_red', orientation, { product_name: productName || 'NOME DO PRODUTO', price: previewPrice, unit: unit || null, headline: headline || 'OFERTA', footer: footer || null }, layoutPositions, canManage)}
        </div>
      </div>

      <div className="section-heading promotion-saved-heading"><div><p className="eyebrow">Salvos</p><h3>{posters.length} cartaz{posters.length === 1 ? '' : 'es'}</h3></div></div>
      <div className="promotion-poster-grid">
        {posters.length === 0 && <p className="empty-state">Nenhum cartaz salvo.</p>}
        {posters.map((poster) => {
          const template = templates.find((item) => item.key === poster.template_key)
          return <article className={`promotion-poster-card card-${poster.orientation}`} key={poster.id}>
            {posterPreview(template?.theme || 'hot_red', poster.orientation, poster, poster.layout_positions)}
            <div className="promotion-card-actions"><strong>{poster.product_name}</strong><small>{template?.name || poster.template_key} · {poster.orientation === 'portrait' ? 'Vertical' : 'Horizontal'}</small>{canManage && <div><button className="secondary-button compact" type="button" onClick={() => editPoster(poster)} disabled={busy}>Editar</button><button className="secondary-button compact" type="button" onClick={() => void duplicatePoster(poster)} disabled={busy}>Duplicar</button><button className="danger-button" type="button" onClick={() => void removePoster(poster.id)} disabled={busy}>Excluir</button></div>}</div>
          </article>
        })}
      </div>
    </section>
  )
}
