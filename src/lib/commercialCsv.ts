export type ImportField = 'title' | 'category' | 'description' | 'unit' | 'price' | 'promo_price'
export type ColumnMapping = Record<ImportField, number>
export type ImportRow = { title: string; category: string; description: string; unit: string; price: string; promo_price: string }
export type ValidatedRow = { title: string; category: string | null; description: string | null; price: number; promo_price: number | null; position: number }

export const FIELDS: { key: ImportField; label: string }[] = [
  { key: 'title', label: 'Produto / item' },
  { key: 'category', label: 'Categoria' },
  { key: 'description', label: 'Descrição' },
  { key: 'unit', label: 'Unidade (incluída na descrição)' },
  { key: 'price', label: 'Preço' },
  { key: 'promo_price', label: 'Preço promocional' },
]

const aliases: Record<ImportField, string[]> = {
  title: ['produto', 'nome', 'item', 'corte', 'servico', 'prato', 'descricaoitem', 'nomeproduto'],
  category: ['categoria', 'grupo', 'secao', 'setor'],
  description: ['descricao', 'detalhes', 'observacao', 'ingredientes'],
  unit: ['unidade', 'peso', 'medida', 'un', 'unid'],
  price: ['preco', 'valor', 'precovenda', 'precounitario', 'precorkg', 'precokg', 'precor'],
  promo_price: ['promocao', 'promocional', 'precopromocional', 'precooferta', 'oferta', 'valoroferta'],
}

export function normalizeLabel(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping = Object.fromEntries(FIELDS.map(({ key }) => [key, -1])) as ColumnMapping
  const used = new Set<number>()
  for (const { key } of FIELDS) {
    const found = headers.findIndex((header, index) => !used.has(index) && aliases[key].includes(normalizeLabel(header)))
    if (found >= 0) { mapping[key] = found; used.add(found) }
  }
  return mapping
}

function splitCsv(text: string, delimiter: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let closedQuote = false
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index]
    if (quoted) {
      if (ch === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
      else if (ch === '"') { quoted = false; closedQuote = true }
      else cell += ch
      continue
    }
    if (ch === '"' && !cell.trim() && !closedQuote) { quoted = true; continue }
    if (ch === delimiter || ch === '\r' || ch === '\n') {
      row.push(cell.trim()); cell = ''; closedQuote = false
      if (ch === '\r' || ch === '\n') {
        if (row.some((value) => value !== '')) rows.push(row)
        row = []
        if (ch === '\r' && text[index + 1] === '\n') index += 1
        if (rows.length > 201) throw new Error('O limite por arquivo é de 200 linhas de dados.')
      }
      continue
    }
    if (closedQuote && ch !== ' ' && ch !== '\t') throw new Error('Arquivo CSV com aspas inválidas.')
    if (ch === '"') throw new Error('Arquivo CSV com aspas inválidas.')
    cell += ch
  }
  if (quoted) throw new Error('Arquivo CSV com aspas não fechadas.')
  row.push(cell.trim())
  if (row.some((value) => value !== '')) rows.push(row)
  if (rows.length > 201) throw new Error('O limite por arquivo é de 200 linhas de dados.')
  return rows
}

export function parseCommercialCsv(input: string) {
  const text = input.replace(/^\uFEFF/, '').trim()
  if (!text) throw new Error('O arquivo CSV está vazio.')
  const sep = /^sep=([;,\t])\r?\n/i.exec(text)
  const body = sep ? text.slice(sep[0].length) : text
  const candidates = sep ? [sep[1]] : [';', ',', '\t']
  let firstError: Error | null = null
  const ranked = candidates.flatMap((delimiter) => {
    try { return [{ delimiter, rows: splitCsv(body, delimiter) }] }
    catch (error) { firstError ||= error instanceof Error ? error : new Error('Arquivo CSV inválido.'); return [] }
  }).sort((a, b) => (b.rows[0]?.length || 0) - (a.rows[0]?.length || 0))
  if (!ranked.length) throw firstError || new Error('Arquivo CSV inválido.')
  const rows = ranked[0].rows
  if (rows.length < 2 || rows[0].length < 2) throw new Error('A planilha precisa ter cabeçalhos e ao menos uma linha de dados.')
  const headers = rows[0]
  if (headers.length > 30) throw new Error('A tabela pode ter no máximo 30 colunas.')
  if (headers.some((header) => !header)) throw new Error('Há cabeçalhos vazios. Corrija o arquivo antes de importar.')
  if (rows.slice(1).some((row) => row.length !== headers.length)) throw new Error('Algumas linhas têm quantidades diferentes de colunas. Confira o separador e as aspas.')
  return { headers, rows: rows.slice(1), delimiter: ranked[0].delimiter }
}

export function parseBrl(value: string): number | null {
  const text = value.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (!text) return null
  let normalized = text
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(text)) normalized = text.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(text)) normalized = text.replace(/,/g, '')
  else if (/^\d+,\d{1,2}$/.test(text)) normalized = text.replace(',', '.')
  else if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 9999999999.99 ? parsed : null
}

export function mapImportRow(values: string[], mapping: ColumnMapping): ImportRow {
  const read = (field: ImportField) => mapping[field] >= 0 ? (values[mapping[field]] || '').trim() : ''
  return { title: read('title'), category: read('category'), description: read('description'), unit: read('unit'), price: read('price'), promo_price: read('promo_price') }
}

export function validateImport(rows: ImportRow[]) {
  const problems: string[] = []
  const payload: ValidatedRow[] = []
  const seen = new Set<string>()
  if (!rows.length || rows.length > 200) problems.push('Informe entre 1 e 200 itens.')
  rows.forEach((row, index) => {
    const position = index + 1
    const title = row.title.trim()
    const category = row.category.trim()
    const unit = row.unit.trim()
    const description = [row.description.trim(), unit ? `Unidade: ${unit}` : ''].filter(Boolean).join(' · ')
    const price = parseBrl(row.price)
    const promo = row.promo_price.trim() ? parseBrl(row.promo_price) : null
    const valid = title.length >= 2 && title.length <= 160 && category.length <= 80 && unit.length <= 80 && description.length <= 2000
      && price !== null && (!row.promo_price.trim() || (promo !== null && promo <= price))
    const key = `${normalizeLabel(title)}:${normalizeLabel(category)}`
    if (seen.has(key)) { problems.push(`Linha ${position}: produto e categoria duplicados.`); return }
    seen.add(key)
    if (!valid || price === null) {
      problems.push(`Linha ${position}: confira nome, tamanho dos textos, preço e promoção (até 2 casas decimais).`)
      return
    }
    payload.push({ title, category: category || null, description: description || null, price, promo_price: promo, position: index })
  })
  return { problems, payload }
}
