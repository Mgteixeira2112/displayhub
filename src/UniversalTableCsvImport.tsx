import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { FIELDS, mapImportRow, parseCommercialCsv, suggestMapping, validateImport } from './lib/commercialCsv'
import type { ColumnMapping, ImportField, ImportRow } from './lib/commercialCsv'
import './universal-import.css'

type Collection = { id: string; title: string; kind: 'menu' | 'price_table' }
type Props = { companyId: string; role: string; onImported: () => void }

const emptyMapping = (): ColumnMapping => ({ title: -1, category: -1, description: -1, unit: -1, price: -1, promo_price: -1 })

export default function UniversalTableCsvImport({ companyId, role, onImported }: Props) {
  const [open, setOpen] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [targetId, setTargetId] = useState('')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [ackIgnored, setAckIgnored] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open || !['admin', 'manager'].includes(role)) return
    let active = true
    void supabase.from('structured_contents').select('id,title,kind')
      .eq('company_id', companyId).in('kind', ['menu', 'price_table']).order('title')
      .then(({ data, error }) => {
        if (!active) return
        if (error) setMessage('Não foi possível carregar os cardápios e tabelas.')
        else setCollections((data || []) as Collection[])
      })
    return () => { active = false }
  }, [companyId, role, open])

  const preview = useMemo(() => rawRows.map((values, rowIndex) => {
    const mapped = mapImportRow(values, mapping)
    for (const { key } of FIELDS) {
      const edit = edits[`${rowIndex}:${key}`]
      if (edit !== undefined) mapped[key] = edit
    }
    return mapped
  }), [rawRows, mapping, edits])
  const validation = useMemo(() => validateImport(preview), [preview])
  const ignored = headers.filter((_, index) => !Object.values(mapping).includes(index))
  const ready = targetId && mapping.title >= 0 && mapping.price >= 0 && validation.problems.length === 0 && (!ignored.length || ackIgnored) && !saved

  async function selectFile(file: File | undefined) {
    setFileName(''); setHeaders([]); setRawRows([]); setEdits({}); setMapping(emptyMapping()); setAckIgnored(false); setSaved(false); setMessage('')
    if (!file) return
    if (!/\.csv$/i.test(file.name)) { setMessage('Nesta etapa, selecione um CSV. O Excel XLSX será incluído em uma PR separada.'); return }
    if (file.size > 2 * 1024 * 1024) { setMessage('O arquivo pode ter no máximo 2 MB.'); return }
    try {
      const bytes = await file.arrayBuffer()
      let text: string
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { text = new TextDecoder('windows-1252').decode(bytes) }
      const parsed = parseCommercialCsv(text)
      setFileName(file.name)
      setHeaders(parsed.headers)
      setRawRows(parsed.rows)
      setMapping(suggestMapping(parsed.headers))
      setMessage(`Arquivo lido localmente: ${parsed.rows.length} linhas. Revise os campos antes de gravar.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.')
    }
  }

  function remap(field: ImportField, index: number) {
    setMapping((current) => {
      const next = { ...current }
      for (const { key } of FIELDS) if (key !== field && next[key] === index) next[key] = -1
      next[field] = index
      return next
    })
    setEdits({}); setAckIgnored(false); setSaved(false)
  }

  function edit(rowIndex: number, field: ImportField, value: string) {
    setEdits((current) => ({ ...current, [`${rowIndex}:${field}`]: value }))
    setSaved(false)
  }

  async function save() {
    if (!['admin', 'manager'].includes(role) || !ready || busy) return
    setBusy(true); setMessage('')
    try {
      const { data: parent, error: parentError } = await supabase.from('structured_contents')
        .select('id,kind,company_id').eq('id', targetId).eq('company_id', companyId).single()
      if (parentError || !parent || !['menu', 'price_table'].includes(parent.kind)) throw new Error('Tabela de destino não encontrada ou sem permissão.')
      const [existing, links] = await Promise.all([
        supabase.from('structured_content_rows').select('id').eq('company_id', companyId).eq('content_id', targetId).limit(1),
        supabase.from('playlist_items').select('id').eq('company_id', companyId).eq('structured_content_id', targetId).limit(1),
      ])
      if (existing.error || links.error) throw new Error('Não foi possível verificar se a tabela está vazia e fora das playlists.')
      if (existing.data?.length) throw new Error('Esta tabela já tem itens. Crie uma estrutura vazia para evitar duplicidades e substituições acidentais.')
      if (links.data?.length) throw new Error('Esta tabela já está vinculada a uma playlist. Importe para uma estrutura nova, ainda não publicada.')
      const payload = validation.payload.map((row) => ({ ...row, company_id: companyId, content_id: targetId }))
      const { error } = await supabase.from('structured_content_rows').insert(payload)
      if (error) throw error
      setSaved(true)
      setMessage(`${payload.length} itens importados com sucesso. Confira a lista antes de vinculá-la à playlist.`)
      onImported()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível importar a tabela.')
    } finally { setBusy(false) }
  }

  if (!['admin', 'manager'].includes(role)) return null
  return (
    <section className="workspace-section content-controls-section content-import-section" aria-label="Importação de tabela CSV">
      <div className="section-heading">
        <div><p className="eyebrow">Planilhas</p><h2>Importar tabela</h2></div>
        <button className="secondary-button compact" type="button" aria-expanded={open} onClick={() => { setOpen((current) => !current); setMessage('') }}>{open ? 'Fechar' : 'Importar CSV'}</button>
      </div>
      {open && <div className="content-create-workspace content-import-workspace">
        <p>Crie antes uma estrutura vazia em “+ Cardápio / Tabela”. O arquivo é lido neste navegador; nada será salvo até você confirmar.</p>
        <div className="content-form content-import-controls">
          <label>Arquivo CSV (até 2 MB e 200 itens)
            <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => void selectFile(event.currentTarget.files?.[0])} />
          </label>
          <label>Destino: estrutura vazia sem vínculo com playlist
            <select value={targetId} disabled={busy} onChange={(event) => { setTargetId(event.target.value); setSaved(false) }}>
              <option value="">Selecione uma estrutura</option>
              {collections.map((item) => <option key={item.id} value={item.id}>{item.title} ({item.kind === 'menu' ? 'Cardápio' : 'Tabela'})</option>)}
            </select>
          </label>
          {!collections.length && <p className="form-message">Nenhuma estrutura encontrada. Crie um cardápio ou tabela no formulário acima.</p>}
        </div>
        {headers.length > 0 && <>
          <h3>1. Confirme o reconhecimento das colunas — {fileName}</h3>
          <div className="content-import-mapping">
            {FIELDS.map(({ key, label }) => <label key={key}>{label}{['title', 'price'].includes(key) ? ' *' : ''}
              <select value={mapping[key]} disabled={busy} onChange={(event) => remap(key, Number(event.target.value))}>
                <option value={-1}>Não importar</option>
                {headers.map((header, index) => <option key={`${index}:${header}`} value={index}>{header}</option>)}
              </select>
            </label>)}
          </div>
          {ignored.length > 0 && <label className="content-import-ack">
            <input type="checkbox" checked={ackIgnored} disabled={busy} onChange={(event) => setAckIgnored(event.target.checked)} />
            Confirmo que estas colunas não serão importadas: {ignored.join(', ')}.
          </label>}
          <p className="content-import-help">A unidade será acrescentada à descrição. Esta versão exige preço em todos os itens; não modifica tabelas existentes nem publica automaticamente.</p>
          <h3>2. Confira e corrija os {preview.length} itens</h3>
          <div className="content-import-scroll" role="region" aria-label="Prévia editável da importação" tabIndex={0}>
            <table className="content-import-table"><thead><tr><th>Linha</th>{FIELDS.map(({ key, label }) => <th key={key}>{label}</th>)}</tr></thead>
              <tbody>{preview.map((row: ImportRow, index) => <tr key={index}>
                <td>{index + 1}</td>
                {FIELDS.map(({ key, label }) => <td key={key}><input aria-label={`${label}, linha ${index + 1}`} value={row[key]} disabled={busy} onChange={(event) => edit(index, key, event.target.value)} /></td>)}
              </tr>)}</tbody>
            </table>
          </div>
          {validation.problems.length > 0 && <div className="form-message" role="alert">
            <strong>{validation.problems.length} pendência(s) impedem a importação.</strong>
            {validation.problems.slice(0, 8).map((problem) => <p key={problem}>{problem}</p>)}
          </div>}
          <button className="primary-button" type="button" disabled={!ready || busy} onClick={() => void save()}>{busy ? 'Importando...' : `Confirmar importação de ${validation.payload.length} itens`}</button>
        </>}
        {message && <p className="form-message" role="status">{message}</p>}
      </div>}
    </section>
  )
}
