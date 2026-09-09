import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

type Props = { companyId: string; role: string }
type Template = { key: string; name: string; description: string | null; theme: 'hot_red' | 'burst_yellow' | 'price_blast'; aspect_ratio: 'portrait' | 'landscape' | 'square' }
type Poster = { id: string; template_key: string; product_name: string; price: number; unit: string | null; headline: string; footer: string | null; created_at: string }

function moneyInput(value: string) {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function moneyLabel(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function PromotionPosterManager({ companyId, role }: Props) {
  const canManage = role === 'admin' || role === 'manager'
  const [templates, setTemplates] = useState<Template[]>([])
  const [posters, setPosters] = useState<Poster[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [templateKey, setTemplateKey] = useState('oferta_quente')
  const [productName, setProductName] = useState('ARROZ TIPO 1')
  const [price, setPrice] = useState('24,90')
  const [unit, setUnit] = useState('5 KG')
  const [headline, setHeadline] = useState('OFERTA QUENTE!')
  const [footer, setFooter] = useState('Aproveite!')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const selectedTemplate = useMemo(() => templates.find((item) => item.key === templateKey) || null, [templates, templateKey])
  const previewPrice = moneyInput(price) ?? 0

  const load = useCallback(async () => {
    const [templateResult, posterResult] = await Promise.all([
      supabase.from('promotion_templates').select('key,name,description,theme,aspect_ratio').order('created_at'),
      supabase.from('promotion_posters').select('id,template_key,product_name,price,unit,headline,footer,created_at').order('created_at', { ascending: false }),
    ])
    if (templateResult.error) throw templateResult.error
    if (posterResult.error) throw posterResult.error
    setTemplates((templateResult.data || []) as Template[])
    setPosters((posterResult.data || []).map((item) => ({ ...item, price: Number(item.price) })) as Poster[])
  }, [])

  useEffect(() => { void load().catch(() => setMessage('Não foi possível carregar os cartazes promocionais.')) }, [load])

  function resetForm() {
    setEditingId(null)
    setTemplateKey('oferta_quente')
    setProductName('ARROZ TIPO 1')
    setPrice('24,90')
    setUnit('5 KG')
    setHeadline('OFERTA QUENTE!')
    setFooter('Aproveite!')
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
    setProductName(poster.product_name)
    setPrice(String(poster.price).replace('.', ','))
    setUnit(poster.unit || '')
    setHeadline(poster.headline)
    setFooter(poster.footer || '')
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

  const posterPreview = (theme: string, values: { product_name: string; price: number; unit: string | null; headline: string; footer: string | null }) => (
    <div className={`promo-poster promo-theme-${theme}`}>
      <div className="promo-poster-shape" aria-hidden="true" />
      <div className="promo-poster-content">
        <span className="promo-headline">{values.headline}</span>
        <strong className="promo-product">{values.product_name}</strong>
        <div className="promo-price">{moneyLabel(values.price)}</div>
        {values.unit && <span className="promo-unit">{values.unit}</span>}
        {values.footer && <em className="promo-footer">{values.footer}</em>}
      </div>
    </div>
  )

  return (
    <section className="workspace-section promotion-workspace">
      <div className="section-heading"><div><p className="eyebrow">Promoções</p><h2>Gerador de Cartazes</h2><p>Escolha um fundo, informe produto e preço e veja o cartaz em tempo real.</p></div><button className="secondary-button compact" type="button" onClick={() => void load()} disabled={busy}>Atualizar</button></div>
      {message && <p className="form-message" role="status">{message}</p>}

      <div className="promotion-editor-grid">
        <form className="promotion-form" onSubmit={savePoster}>
          <h3>{editingId ? 'Editar cartaz' : 'Novo cartaz'}</h3>
          <label>Fundo / template<select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} disabled={!canManage}>{templates.map((template) => <option value={template.key} key={template.key}>{template.name}</option>)}</select></label>
          {selectedTemplate?.description && <small className="promotion-template-help">{selectedTemplate.description}</small>}
          <label>Chamada<input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={60} required /></label>
          <label>Produto<input value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={120} required /></label>
          <div className="inline-fields">
            <label>Preço<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required /></label>
            <label>Unidade<input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={30} placeholder="KG, UN, 2L..." /></label>
          </div>
          <label>Rodapé<input value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={80} placeholder="Aproveite!" /></label>
          {canManage && <div className="promotion-actions"><button className="primary-button" type="submit" disabled={busy}>{editingId ? 'Salvar alterações' : 'Salvar cartaz'}</button>{editingId && <button className="secondary-button" type="button" onClick={resetForm} disabled={busy}>Cancelar</button>}</div>}
        </form>

        <div className="promotion-preview-panel">
          <span>Pré-visualização</span>
          {posterPreview(selectedTemplate?.theme || 'hot_red', { product_name: productName || 'NOME DO PRODUTO', price: previewPrice, unit: unit || null, headline: headline || 'OFERTA', footer: footer || null })}
        </div>
      </div>

      <div className="section-heading promotion-saved-heading"><div><p className="eyebrow">Salvos</p><h3>{posters.length} cartaz{posters.length === 1 ? '' : 'es'}</h3></div></div>
      <div className="promotion-poster-grid">
        {posters.length === 0 && <p className="empty-state">Nenhum cartaz salvo.</p>}
        {posters.map((poster) => {
          const template = templates.find((item) => item.key === poster.template_key)
          return <article className="promotion-poster-card" key={poster.id}>
            {posterPreview(template?.theme || 'hot_red', poster)}
            <div className="promotion-card-actions">
              <strong>{poster.product_name}</strong>
              <small>{template?.name || poster.template_key}</small>
              {canManage && <div><button className="secondary-button compact" type="button" onClick={() => editPoster(poster)} disabled={busy}>Editar</button><button className="secondary-button compact" type="button" onClick={() => void duplicatePoster(poster)} disabled={busy}>Duplicar</button><button className="danger-button" type="button" onClick={() => void removePoster(poster.id)} disabled={busy}>Excluir</button></div>}
            </div>
          </article>
        })}
      </div>
    </section>
  )
}
