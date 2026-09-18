import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapImportRow, parseBrl, parseCommercialCsv, suggestMapping, validateImport } from '../src/lib/commercialCsv.ts'
import { normalizeXlsxSheets } from '../src/lib/commercialXlsx.ts'

test('imports Brazilian semicolon CSV, BOM, sep hint and escaped quotes', () => {
  const parsed = parseCommercialCsv('\uFEFFsep=;\r\nProduto;Categoria;Preço;Promoção\r\n"Café ""especial""";Bebidas;R$ 12,50;R$ 10,00\r\n')
  assert.equal(parsed.delimiter, ';')
  assert.equal(parsed.rows.length, 1)
  assert.equal(parsed.rows[0][0], 'Café "especial"')
  const mapping = suggestMapping(parsed.headers)
  assert.equal(mapping.title, 0)
  assert.equal(mapping.price, 2)
  const result = validateImport(parsed.rows.map((row) => mapImportRow(row, mapping)))
  assert.deepEqual(result.problems, [])
  assert.equal(result.payload[0].price, 12.5)
})

test('identifies comma and tab separators with quoted delimiters', () => {
  const comma = parseCommercialCsv('Produto,Preço\n"Picanha, premium","89,90"')
  assert.equal(comma.delimiter, ',')
  assert.equal(comma.rows[0][0], 'Picanha, premium')
  const tab = parseCommercialCsv('Produto\tPreço\nAcém\t32,90')
  assert.equal(tab.delimiter, '\t')
})

test('rejects malformed input rather than shifting data into another column', () => {
  assert.throws(() => parseCommercialCsv('Produto;Preço\n"Picanha;89,90'), /aspas/)
  assert.throws(() => parseCommercialCsv('Produto;Preço\nPicanha;89,90;extra'), /quantidades diferentes/)
  assert.throws(() => parseCommercialCsv('Produto;Preço\n'), /ao menos uma linha/)
})

test('accepts unambiguous Brazilian and decimal prices only', () => {
  assert.equal(parseBrl('R$ 1.234,50'), 1234.5)
  assert.equal(parseBrl('12,50'), 12.5)
  assert.equal(parseBrl('12.50'), 12.5)
  assert.equal(parseBrl('0'), 0)
  assert.equal(parseBrl('1,234'), null)
  assert.equal(parseBrl('-1'), null)
  assert.equal(parseBrl('R$ 1,234.567'), null)
  assert.equal(parseBrl(''), null)
})

test('validates item lengths, promotions, duplicates and unit preservation', () => {
  const valid = { title: 'Picanha', category: 'Carnes', description: 'Resfriada', unit: 'kg', price: '89,90', promo_price: '79,90' }
  const result = validateImport([valid])
  assert.deepEqual(result.problems, [])
  assert.equal(result.payload[0].description, 'Resfriada · Unidade: kg')
  assert.equal(result.payload[0].promo_price, 79.9)
  assert.match(validateImport([valid, valid]).problems.join(' '), /duplicados/)
  assert.match(validateImport([{ ...valid, promo_price: '99,90' }]).problems.join(' '), /preço/)
  assert.match(validateImport([{ ...valid, price: '' }]).problems.join(' '), /preço/)
})

test('preserves all 30 items in order during CSV mapping and validation', () => {
  const lines = Array.from({ length: 30 }, (_, index) => `Produto ${index + 1};Categoria;un;${index + 1},90`)
  const parsed = parseCommercialCsv(['Produto;Categoria;Unidade;Preço', ...lines].join('\n'))
  assert.equal(parsed.rows.length, 30)
  const mapped = parsed.rows.map((row) => mapImportRow(row, suggestMapping(parsed.headers)))
  const result = validateImport(mapped)
  assert.deepEqual(result.problems, [])
  assert.equal(result.payload.length, 30)
  assert.deepEqual(result.payload.map((item) => item.position), Array.from({ length: 30 }, (_, index) => index))
  assert.equal(result.payload[0].title, 'Produto 1')
  assert.equal(result.payload[29].title, 'Produto 30')
  assert.equal(result.payload[29].price, 30.9)
  assert.equal(result.payload[29].description, 'Unidade: un')
})

test('accepts 200 data rows but rejects 201', () => {
  const lines = Array.from({ length: 201 }, (_, index) => `Produto ${index + 1};${index + 1},90`)
  const header = 'Produto;Preço\n'
  assert.equal(parseCommercialCsv(header + lines.slice(0, 200).join('\n')).rows.length, 200)
  assert.throws(() => parseCommercialCsv(header + lines.join('\n')), /200 linhas/)
})

test('normalizes XLSX sheets and reuses CSV mapping, currency validation and order', () => {
  const sheets = normalizeXlsxSheets([{ sheet: 'Cardápio', data: [['Produto', 'Preço', 'Unidade'], ['Café', '12,50', 'un'], ['Chá', 8, 'un']] }])
  assert.equal(sheets.length, 1)
  assert.equal(sheets[0].name, 'Cardápio')
  const mapping = suggestMapping(sheets[0].headers)
  const result = validateImport(sheets[0].rows.map((row) => mapImportRow(row, mapping)))
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.payload.map(({ price }) => price), [12.5, 8])
  assert.deepEqual(result.payload.map(({ position }) => position), [0, 1])
})

test('retains explicit multi-sheet selection and rejects invalid XLSX tables', () => {
  const sheets = normalizeXlsxSheets([{ sheet: 'A', data: [['Produto', 'Preço'], ['Café', 12]] }, { sheet: 'B', data: [['Produto', 'Preço'], ['Chá', 8]] }])
  assert.deepEqual(sheets.map(({ name }) => name), ['A', 'B'])
  assert.throws(() => normalizeXlsxSheets([]), /sem planilhas/)
  assert.throws(() => normalizeXlsxSheets([{ sheet: 'Vazia', data: [['Produto', 'Preço']] }]), /ao menos um item/)
  assert.throws(() => normalizeXlsxSheets([{ sheet: 'Sem cabeçalho', data: [['Produto', ''], ['Café', 12]] }]), /cabeçalhos/)
  assert.throws(() => normalizeXlsxSheets([{ sheet: 'Extra', data: [['Produto', 'Preço'], ['Café', 12, 'extra']] }]), /colunas extras/)
  const oversized = [['Produto', 'Preço'], ...Array.from({ length: 201 }, (_, index) => [`Produto ${index}`, index])]
  assert.throws(() => normalizeXlsxSheets([{ sheet: 'Longa', data: oversized }]), /200 itens/)
})
