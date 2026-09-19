const { test, expect } = require('@playwright/test')
const { zipSync, strToU8 } = require('fflate')

const origin = 'https://example.supabase.co'
const appOrigin = 'http://127.0.0.1:4173'
const companyId = '00000000-0000-4000-8000-000000000002'
const tableId = '00000000-0000-4000-8000-000000000010'
const user = {
  id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated',
  email: 'importacao@example.invalid', app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Pessoa de Teste' }, created_at: '2020-01-01T00:00:00.000Z',
  confirmed_at: '2020-01-01T00:00:00.000Z',
}
const json = (data, status = 200) => ({
  status, contentType: 'application/json; charset=utf-8',
  headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' },
  body: JSON.stringify(data),
})

function xlsxFixture() {
  const names = ['Cardapio', 'Ofertas']
  const entries = {
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  }
  const rows = [[['Produto', 'Preço'], ['Cafe', '12,50']], [['Produto', 'Preço'], ['Suco', '8,90']]]
  rows.forEach((sheet, index) => {
    entries[`xl/worksheets/sheet${index + 1}.xml`] = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet.map((row, i) => `<row r="${i + 1}">${row.map((value, col) => `<c r="${String.fromCharCode(65 + col)}${i + 1}" t="inlineStr"><is><t>${value}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`
  })
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(entries).map(([path, xml]) => [path, strToU8(xml)]))))
}

test('CSV e XLSX real: prévia, seleção de abas e inserção somente após confirmação com banco fictício', async ({ page }, testInfo) => {
  const unexpected = []
  const errors = []
  const writes = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.routeWebSocket('wss://example.supabase.co/**', (socket) => socket.close())
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === appOrigin) return route.continue()
    if (url.href === 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js' && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mock QR */' })
    }
    if (url.origin !== origin) { unexpected.push(`Host externo: ${url.origin}`); return route.abort() }
    const table = url.pathname.startsWith('/rest/v1/') ? url.pathname.slice('/rest/v1/'.length) : ''
    if (url.pathname === '/auth/v1/token' && request.method() === 'POST' && url.searchParams.get('grant_type') === 'password') {
      return route.fulfill(json({ access_token: 'APENAS_TESTE', refresh_token: 'APENAS_TESTE_REFRESH', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }))
    }
    if (url.pathname === '/auth/v1/user' && request.method() === 'GET') return route.fulfill(json(user))
    if (table && request.method() === 'GET') {
      if (table === 'profiles') return route.fulfill(json({ company_id: companyId, role: 'admin', full_name: 'Pessoa de Teste' }))
      if (table === 'companies') return route.fulfill(json({ name: 'Empresa de Teste' }))
      if (table === 'structured_contents') {
        const content = { id: tableId, company_id: companyId, kind: 'menu', title: 'Tabela Vazia de Teste', category: null, description: null, price: null, promo_price: null, qr_value: null, created_at: '2020-01-01T00:00:00Z' }
        return route.fulfill(json(url.searchParams.has('id') ? content : [content]))
      }
      return route.fulfill(json([]))
    }
    if (table === 'structured_content_rows' && request.method() === 'POST') {
      writes.push(JSON.parse(request.postData() || 'null'))
      return route.fulfill(json([], 201))
    }
    unexpected.push(`Operação externa não prevista: ${request.method()} ${url.pathname}`)
    return route.fulfill(json({ message: 'Bloqueada' }, 405))
  })

  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await page.locator('form input[type="email"]').fill(user.email)
  await page.locator('form input[type="password"]').fill('senha-ficticia')
  await page.locator('form button[type="submit"]').click()
  await expect(page.locator('.software-company-summary strong')).toHaveText('Empresa de Teste')
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('displayhub:navigate', { detail: 'universal-tables' })))
  const panel = page.locator('.content-import-section')
  await expect(panel.getByRole('button', { name: 'Importar planilha' })).toBeVisible()
  await panel.getByRole('button', { name: 'Importar planilha' }).click()
  await expect(panel.getByText('Crie antes uma estrutura vazia', { exact: false })).toBeVisible()
  const upload = panel.locator('input[type="file"]')
  await upload.setInputFiles({ name: 'produtos.csv', mimeType: 'text/csv', buffer: Buffer.from('Produto;Categoria;Unidade;Preço;Promoção\nPicanha;Carnes;kg;89,90;79,90\nAcém;Carnes;kg;32,90;\n', 'utf8') })
  await expect(panel.getByText('Arquivo lido localmente: 2 linhas.', { exact: false })).toBeVisible()
  await expect(panel.getByRole('button', { name: /Confirmar importação de 2 itens/ })).toBeDisabled()
  await panel.locator('.content-import-controls select').selectOption(tableId)
  await expect(panel.getByRole('button', { name: /Confirmar importação de 2 itens/ })).toBeEnabled()
  const width = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }))
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1)
  await page.screenshot({ path: testInfo.outputPath(`csv-preview-${testInfo.project.name}.png`), fullPage: true, animations: 'disabled', caret: 'hide' })
  await panel.getByRole('button', { name: /Confirmar importação de 2 itens/ }).click()
  await expect(panel.getByText('2 itens importados com sucesso.', { exact: false })).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0]).toHaveLength(2)
  expect(writes[0][0]).toMatchObject({ title: 'Picanha', price: 89.9, promo_price: 79.9, description: 'Unidade: kg', company_id: companyId, content_id: tableId })
  expect(writes[0][1]).toMatchObject({ title: 'Acém', price: 32.9, promo_price: null })

  // Invalid uploads must not keep a stale preview or trigger a write.
  await upload.setInputFiles({ name: 'invalido.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('not an excel workbook') })
  await expect(panel.getByText('assinatura ZIP ausente', { exact: false })).toBeVisible()
  await expect(panel.getByRole('button', { name: /Confirmar importação/ })).toHaveCount(0)
  expect(writes).toHaveLength(1)

  await upload.setInputFiles({ name: 'produtos.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsxFixture() })
  await expect(panel.getByText('Selecione a aba do Excel que deseja importar.', { exact: false })).toBeVisible()
  await expect(panel.getByRole('button', { name: /Confirmar importação/ })).toHaveCount(0)
  expect(writes).toHaveLength(1)
  await panel.getByLabel('Aba do Excel').selectOption('Ofertas')
  await expect(panel.getByText('Aba Ofertas: 1 linhas.', { exact: false })).toBeVisible()
  await expect(panel.getByRole('button', { name: /Confirmar importação de 1 itens/ })).toBeEnabled()
  expect(writes).toHaveLength(1)
  await panel.getByRole('button', { name: /Confirmar importação de 1 itens/ }).click()
  await expect(panel.getByText('1 itens importados com sucesso.', { exact: false })).toBeVisible()
  expect(writes).toHaveLength(2)
  expect(writes[1]).toHaveLength(1)
  expect(writes[1][0]).toMatchObject({ title: 'Suco', price: 8.9, company_id: companyId, content_id: tableId })
  expect(unexpected).toEqual([])
  expect(errors).toEqual([])
})
