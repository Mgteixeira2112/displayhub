export type WorkbookSheet = { name: string; headers: string[]; rows: string[][] }

const MAX_ROWS = 200
const MAX_COLUMNS = 30

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toLocaleDateString('pt-BR')
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim()
  return ''
}

export function normalizeXlsxSheets(input: { sheet: string; data: unknown[][] }[]): WorkbookSheet[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('Arquivo XLSX sem planilhas.')
  return input.flatMap(({ sheet, data }) => {
    if (!Array.isArray(data)) throw new Error('Estrutura XLSX inválida.')
    const nonempty = data.map((row) => {
      if (!Array.isArray(row)) throw new Error('Linha XLSX inválida.')
      return row.map(stringifyCell)
    }).filter((row) => row.some((value) => value !== ''))
    if (!nonempty.length) return []
    if (nonempty.length > MAX_ROWS + 1) throw new Error(`A aba ${sheet} excede o limite de 200 itens.`)
    const headers = nonempty[0]
    if (headers.length < 2 || headers.length > MAX_COLUMNS || headers.some((value) => !value)) throw new Error(`A aba ${sheet} precisa de 2 a 30 cabeçalhos preenchidos.`)
    if (nonempty.length < 2) throw new Error(`A aba ${sheet} precisa de ao menos um item.`)
    const rows = nonempty.slice(1).map((row) => {
      if (row.length > headers.length && row.slice(headers.length).some(Boolean)) throw new Error(`A aba ${sheet} tem linhas com colunas extras.`)
      return Array.from({ length: headers.length }, (_, i) => row[i] || '')
    })
    return [{ name: sheet, headers, rows }]
  })
}

export async function readCommercialXlsx(file: File): Promise<WorkbookSheet[]> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Selecione um arquivo XLSX.')
  if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('O arquivo XLSX deve ter até 2 MB e não pode estar vazio.')
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 0x03 || signature[3] !== 0x04) throw new Error('Arquivo XLSX inválido: assinatura ZIP ausente.')
  try {
    const { default: readExcelFile } = await import('read-excel-file/browser')
    const sheets = await readExcelFile(file)
    return normalizeXlsxSheets(sheets)
  } catch (error) {
    if (error instanceof Error && /aba |limite|cabeçalho|ao menos|Estrutura|Linha/.test(error.message)) throw error
    throw new Error('Não foi possível ler o XLSX. Confira se é uma planilha Excel válida e não protegida.')
  }
}
