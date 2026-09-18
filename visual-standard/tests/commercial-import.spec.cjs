const { test, expect } = require('@playwright/test')

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

test('CSV: prévia, validação, permissão e inserção simulada sem acesso a produção', async ({ page }, testInfo) => {
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
  await expect(panel.getByRole('button', { name: 'Importar CSV' })).toBeVisible()
  await panel.getByRole('button', { name: 'Importar CSV' }).click()
  await expect(panel.getByText('Crie antes uma estrutura vazia', { exact: false })).toBeVisible()
  await panel.locator('input[type="file"]').setInputFiles({
    name: 'produtos.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Produto;Categoria;Unidade;Preço;Promoção\nPicanha;Carnes;kg;89,90;79,90\nAcém;Carnes;kg;32,90;\n', 'utf8'),
  })
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
  expect(unexpected).toEqual([])
  expect(errors).toEqual([])
})
