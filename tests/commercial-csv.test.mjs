import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapImportRow, parseBrl, parseCommercialCsv, suggestMapping, validateImport } from '../src/lib/commercialCsv.ts'

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
