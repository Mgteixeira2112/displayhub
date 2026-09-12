import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './lib/supabase'

type StructuredContent = {
  id: string
  kind: 'product' | 'menu' | 'price_table' | 'notice' | 'text' | 'qr'
  title: string
  category: string | null
  description: string | null
  price: number | null
  promo_price: number | null
  qr_value: string | null
  created_at: string
}

type StructuredRow = {
  id: string
  content_id: string
  title: string
  category: string | null
  description: string | null
  price: number
  promo_price: number | null
  position: number
}

type Props = {
  companyId: string
  role: string
  controlsTarget: HTMLElement | null
  galleryTarget: HTMLElement | null
}

type CommercialCreateMode = 'product' | 'simple' | 'collection' | 'row' | null

const kindLabels: Record<StructuredContent['kind'], string> = {
  product: 'Produto',
  menu: 'Cardápio',
  price_table: 'Tabela de preços',
  notice: 'Aviso',
  text: 'Texto',
  qr: 'QR',
}

function money(value: number | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function StructuredContent({ companyId, role, controlsTarget, galleryTarget }: Props) {
  const [contents, setContents] = useState<StructuredContent[]>([])
  const [rows, setRows] = useState<StructuredRow[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [createMode, setCreateMode] = useState<CommercialCreateMode>(null)

  const [productTitle, setProductTitle] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productPromo, setProductPromo] = useState('')

  const [simpleKind, setSimpleKind] = useState<'notice' | 'text' | 'qr'>('notice')
  const [simpleTitle, setSimpleTitle] = useState('')
  const [simpleValue, setSimpleValue] = useState('')

  const [collectionKind, setCollectionKind] = useState<'menu' | 'price_table'>('menu')
  const [collectionTitle, setCollectionTitle] = useState('')
  const [collectionDescription, setCollectionDescription] = useState('')

  const [rowParent, setRowParent] = useState('')
  const [rowTitle, setRowTitle] = useState('')
  const [rowCategory, setRowCategory] = useState('')
  const [rowDescription, setRowDescription] = useState('')
  const [rowPrice, setRowPrice] = useState('')
  const [rowPromo, setRowPromo] = useState('')

  const canManage = role === 'admin' || role === 'manager'
  const collections = useMemo(() => contents.filter((item) => item.kind === 'menu' || item.kind === 'price_table'), [contents])

  const load = useCallback(async () => {
    const [contentResult, rowResult] = await Promise.all([
      supabase
        .from('structured_contents')
        .select('id, kind, title, category, description, price, promo_price, qr_value, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('structured_content_rows')
        .select('id, content_id, title, category, description, price, promo_price, position')
        .order('position')
        .order('created_at'),
    ])
    if (contentResult.error) throw contentResult.error
    if (rowResult.error) throw rowResult.error
    setContents((contentResult.data || []) as StructuredContent[])
    setRows((rowResult.data || []) as StructuredRow[])
  }, [])

  useEffect(() => {
    void load().catch(() => setMessage('Não foi possível carregar o conteúdo comercial.'))
  }, [load])

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) return
    const price = Number(productPrice)
    const promo = productPromo ? Number(productPromo) : null
    if (!Number.isFinite(price) || price < 0 || (promo !== null && (promo < 0 || promo > price))) {
      setMessage('Confira o preço e o preço promocional.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.from('structured_contents').insert({
        company_id: companyId,
        kind: 'product',
        title: productTitle.trim(),
        category: productCategory.trim() || null,
        description: productDescription.trim() || null,
        price,
        promo_price: promo,
      })
      if (error) throw error
      setProductTitle('')
      setProductCategory('')
      setProductDescription('')
      setProductPrice('')
      setProductPromo('')
      await load()
      setCreateMode(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar o produto.')
    } finally {
      setBusy(false)
    }
  }

  async function addSimple(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) return
    setBusy(true)
    setMessage('')
    try {
      const payload = simpleKind === 'qr'
        ? { qr_value: simpleValue.trim(), description: null }
        : { qr_value: null, description: simpleValue.trim() }
      const { error } = await supabase.from('structured_contents').insert({
        company_id: companyId,
        kind: simpleKind,
        title: simpleTitle.trim(),
        ...payload,
      })
      if (error) throw error
      setSimpleTitle('')
      setSimpleValue('')
      await load()
      setCreateMode(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar o conteúdo.')
    } finally {
      setBusy(false)
    }
  }

  async function addCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.from('structured_contents').insert({
        company_id: companyId,
        kind: collectionKind,
        title: collectionTitle.trim(),
        description: collectionDescription.trim() || null,
      })
      if (error) throw error
      setCollectionTitle('')
      setCollectionDescription('')
      await load()
      setCreateMode(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar a coleção.')
    } finally {
      setBusy(false)
    }
  }

  async function addRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage || !rowParent) return
    const price = Number(rowPrice)
    const promo = rowPromo ? Number(rowPromo) : null
    if (!Number.isFinite(price) || price < 0 || (promo !== null && (promo < 0 || promo > price))) {
      setMessage('Confira o preço do item.')
      return
    }
    const position = rows.filter((row) => row.content_id === rowParent).length
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.from('structured_content_rows').insert({
        content_id: rowParent,
        company_id: companyId,
        title: rowTitle.trim(),
        category: rowCategory.trim() || null,
        description: rowDescription.trim() || null,
        price,
        promo_price: promo,
        position,
      })
      if (error) throw error
      setRowTitle('')
      setRowCategory('')
      setRowDescription('')
      setRowPrice('')
      setRowPromo('')
      await load()
      setCreateMode(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível adicionar o item.')
    } finally {
      setBusy(false)
    }
  }

  async function removeContent(id: string) {
    if (!canManage) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.from('structured_contents').delete().eq('id', id)
    if (error) setMessage(error.message)
    await load()
    setBusy(false)
  }

  async function removeRow(id: string) {
    if (!canManage) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.from('structured_content_rows').delete().eq('id', id)
    if (error) setMessage(error.message)
    await load()
    setBusy(false)
  }

  function toggleCreateMode(mode: Exclude<CommercialCreateMode, null>) {
    setMessage('')
    setCreateMode((current) => current === mode ? null : mode)
  }

  const controls = (
    <section className="workspace-section content-controls-section content-controls-commercial">
      <div className="section-heading">
        <div><p className="eyebrow">Comercial</p><h2>Conteúdo comercial</h2></div>
        <button className="secondary-button compact" type="button" onClick={() => void load()} disabled={busy}>Atualizar</button>
      </div>

      {canManage && (
        <>
          <div className="content-create-toolbar content-create-toolbar-commercial" role="group" aria-label="Adicionar conteúdo comercial">
            <button className={`content-create-choice${createMode === 'product' ? ' active' : ''}`} type="button" aria-pressed={createMode === 'product'} onClick={() => toggleCreateMode('product')}>+ Produto</button>
            <button className={`content-create-choice${createMode === 'simple' ? ' active' : ''}`} type="button" aria-pressed={createMode === 'simple'} onClick={() => toggleCreateMode('simple')}>+ Aviso / Texto / QR</button>
            <button className={`content-create-choice${createMode === 'collection' ? ' active' : ''}`} type="button" aria-pressed={createMode === 'collection'} onClick={() => toggleCreateMode('collection')}>+ Cardápio / Tabela</button>
            <button className={`content-create-choice${createMode === 'row' ? ' active' : ''}`} type="button" aria-pressed={createMode === 'row'} onClick={() => toggleCreateMode('row')}>+ Adicionar item</button>
          </div>

          {createMode && (
            <div className="content-create-workspace content-create-workspace-commercial">
              {createMode === 'product' && (
                <form className="content-form" onSubmit={addProduct}>
                  <div className="content-form-head"><h3>Novo produto</h3><button className="content-create-close" type="button" onClick={() => setCreateMode(null)}>Fechar</button></div>
                  <label>Nome<input value={productTitle} onChange={(event) => setProductTitle(event.target.value)} required minLength={2} placeholder="Café expresso" /></label>
                  <label>Categoria<input value={productCategory} onChange={(event) => setProductCategory(event.target.value)} placeholder="Bebidas" /></label>
                  <label>Descrição<input value={productDescription} onChange={(event) => setProductDescription(event.target.value)} placeholder="Opcional" /></label>
                  <div className="inline-fields">
                    <label>Preço<input type="number" min="0" step="0.01" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} required /></label>
                    <label>Promocional<input type="number" min="0" step="0.01" value={productPromo} onChange={(event) => setProductPromo(event.target.value)} /></label>
                  </div>
                  <button className="primary-button" type="submit" disabled={busy}>Cadastrar produto</button>
                </form>
              )}

              {createMode === 'simple' && (
                <form className="content-form" onSubmit={addSimple}>
                  <div className="content-form-head"><h3>Aviso, texto ou QR</h3><button className="content-create-close" type="button" onClick={() => setCreateMode(null)}>Fechar</button></div>
                  <label>Tipo<select value={simpleKind} onChange={(event) => setSimpleKind(event.target.value as 'notice' | 'text' | 'qr')}><option value="notice">Aviso</option><option value="text">Texto</option><option value="qr">QR</option></select></label>
                  <label>Título<input value={simpleTitle} onChange={(event) => setSimpleTitle(event.target.value)} required minLength={2} /></label>
                  <label>{simpleKind === 'qr' ? 'Destino do QR' : 'Conteúdo'}<input value={simpleValue} onChange={(event) => setSimpleValue(event.target.value)} required placeholder={simpleKind === 'qr' ? 'https://...' : 'Mensagem exibida'} /></label>
                  <button className="primary-button" type="submit" disabled={busy}>Cadastrar</button>
                </form>
              )}

              {createMode === 'collection' && (
                <form className="content-form" onSubmit={addCollection}>
                  <div className="content-form-head"><h3>Novo cardápio ou tabela</h3><button className="content-create-close" type="button" onClick={() => setCreateMode(null)}>Fechar</button></div>
                  <label>Tipo<select value={collectionKind} onChange={(event) => setCollectionKind(event.target.value as 'menu' | 'price_table')}><option value="menu">Cardápio</option><option value="price_table">Tabela de preços</option></select></label>
                  <label>Título<input value={collectionTitle} onChange={(event) => setCollectionTitle(event.target.value)} required minLength={2} placeholder="Cardápio principal" /></label>
                  <label>Descrição<input value={collectionDescription} onChange={(event) => setCollectionDescription(event.target.value)} placeholder="Opcional" /></label>
                  <button className="primary-button" type="submit" disabled={busy}>Criar estrutura</button>
                </form>
              )}

              {createMode === 'row' && (
                <form className="content-form" onSubmit={addRow}>
                  <div className="content-form-head"><h3>Adicionar item</h3><button className="content-create-close" type="button" onClick={() => setCreateMode(null)}>Fechar</button></div>
                  <label>Cardápio/tabela<select value={rowParent} onChange={(event) => setRowParent(event.target.value)} required><option value="">Selecione</option>{collections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                  <label>Item<input value={rowTitle} onChange={(event) => setRowTitle(event.target.value)} required minLength={2} /></label>
                  <label>Categoria<input value={rowCategory} onChange={(event) => setRowCategory(event.target.value)} /></label>
                  <label>Descrição<input value={rowDescription} onChange={(event) => setRowDescription(event.target.value)} /></label>
                  <div className="inline-fields">
                    <label>Preço<input type="number" min="0" step="0.01" value={rowPrice} onChange={(event) => setRowPrice(event.target.value)} required /></label>
                    <label>Promocional<input type="number" min="0" step="0.01" value={rowPromo} onChange={(event) => setRowPromo(event.target.value)} /></label>
                  </div>
                  <button className="primary-button" type="submit" disabled={busy || collections.length === 0}>Adicionar item</button>
                </form>
              )}
            </div>
          )}
        </>
      )}

      {message && <p className="form-message content-message">{message}</p>}
    </section>
  )

  const gallery = (
    <section className="workspace-section content-gallery-section content-gallery-commercial">
      <div className="content-gallery-heading">
        <h3>Conteúdo comercial cadastrado</h3>
        <span>{contents.length}</span>
      </div>
      <div className="structured-list">
        {contents.length === 0 && <p className="empty-state">Nenhum conteúdo comercial cadastrado.</p>}
        {contents.map((item) => {
          const childRows = rows.filter((row) => row.content_id === item.id)
          return (
            <article className="structured-card" key={item.id}>
              <div className="structured-card-header"><span>{kindLabels[item.kind]}{item.category ? ` · ${item.category}` : ''}</span><strong>{item.title}</strong></div>
              {item.description && <p>{item.description}</p>}
              {item.kind === 'product' && <div className="price-line"><strong>{item.promo_price !== null ? money(item.promo_price) : money(item.price)}</strong>{item.promo_price !== null && <del>{money(item.price)}</del>}</div>}
              {item.kind === 'qr' && <code className="qr-value">{item.qr_value}</code>}
              {(item.kind === 'menu' || item.kind === 'price_table') && (
                <div className="structured-rows">
                  {childRows.length === 0 && <small>Nenhum item adicionado.</small>}
                  {childRows.map((row) => (
                    <div className="structured-row" key={row.id}>
                      <div><strong>{row.title}</strong>{row.category && <span>{row.category}</span>}{row.description && <small>{row.description}</small>}</div>
                      <div className="row-price"><strong>{row.promo_price !== null ? money(row.promo_price) : money(row.price)}</strong>{row.promo_price !== null && <del>{money(row.price)}</del>}{canManage && <button type="button" onClick={() => void removeRow(row.id)} disabled={busy}>×</button>}</div>
                    </div>
                  ))}
                </div>
              )}
              {canManage && <button className="danger-button" type="button" onClick={() => void removeContent(item.id)} disabled={busy}>Excluir</button>}
            </article>
          )
        })}
      </div>
    </section>
  )

  return (
    <>
      {controlsTarget && createPortal(controls, controlsTarget)}
      {galleryTarget && createPortal(gallery, galleryTarget)}
    </>
  )
}
