import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import readExcelFile from 'read-excel-file/node'

// XLSX fixture built in memory: exercise the actual ZIP/XML parser, not mocked worksheets.
function workbook(sheets) {
  const entries = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${sheet.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  }
  sheets.forEach((sheet, index) => {
    entries[`xl/worksheets/sheet${index + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet.rows.map((row, i) => `<row r="${i + 1}">${row.map((value, col) => `<c r="${String.fromCharCode(65 + col)}${i + 1}" t="inlineStr"><is><t>${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`
  })
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(entries).map(([path, xml]) => [path, strToU8(xml)]))))
}

test('real XLSX: parses product, Brazilian price and multiple worksheets', async () => {
  const file = workbook([
    { name: 'Cardapio', rows: [['Produto', 'Preço'], ['Café especial', '12,50']] },
    { name: 'Ofertas', rows: [['Produto', 'Preço'], ['Suco', '8,90']] },
  ])
  assert.equal(file.subarray(0, 4).toString('hex'), '504b0304')
  const sheets = await readExcelFile(file)
  assert.equal(sheets.length, 2)
  assert.equal(sheets[0].sheet, 'Cardapio')
  assert.deepEqual(sheets[0].data[1], ['Café especial', '12,50'])
  assert.equal(sheets[1].sheet, 'Ofertas')
  assert.deepEqual(sheets[1].data[1], ['Suco', '8,90'])
})

test('real XLSX reader rejects invalid ZIP contents', async () => {
  await assert.rejects(() => readExcelFile(Buffer.from('not a spreadsheet')))
})
