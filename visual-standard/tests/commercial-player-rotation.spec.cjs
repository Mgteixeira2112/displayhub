const { test, expect } = require('@playwright/test')

const fakeOrigin = 'https://example.supabase.co'
const localOrigin = 'http://127.0.0.1:4173'
const qrScriptUrl = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'

function json(data, status = 200) {
  return { status, contentType: 'application/json; charset=utf-8', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(data) }
}

function makeProgram() {
  const rows = Array.from({ length: 30 }, (_, index) => ({
    id: `row-${String(index + 1).padStart(2, '0')}`,
    title: `Produto ${String(index + 1).padStart(2, '0')}`,
    category: index < 10 ? 'Categoria A' : index < 20 ? 'Categoria B' : 'Categoria C',
    description: index % 4 === 0 ? `Descrição comercial um pouco mais longa do produto ${index + 1}` : null,
    price: 10 + index,
    promo_price: index % 5 === 0 ? 9 + index : null,
    position: index,
  }))
  return {
    display: { id: 'display-fixture', name: 'Loja de Teste', location: 'Ambiente fictício', orientation: 'landscape', resolution_width: 1920, resolution_height: 1080 },
    publications: [{
      id: 'publication-fixture', repeat_mode: 'always', daily_start: null, daily_end: null, weekdays: [0, 1, 2, 3, 4, 5, 6],
      playlist: {
        id: 'playlist-fixture', name: 'Tabela 30 itens', transition_type: 'fade', transition_duration_ms: 300,
        items: [{
          id: 'item-table-fixture', position: 0, duration_seconds: 6, duration_mode: 'fixed',
          template: { name: 'Tabela padrão', template_type: 'price_table' }, content: null,
          structured: { kind: 'price_table', title: 'Tabela de preços', category: null, description: '30 itens para validar a rotação gradual', price: null, promo_price: null, qr_value: null, rows },
          poster: null, smart_scene: null,
        }],
      },
    }],
    group_mode: null, group_id: null, sync_session: null, group_launch: null,
  }
}

test('player mantém a composição e avança somente os lotes da tabela de 30 itens', async ({ page }, testInfo) => {
  const unexpected = []
  const uncaught = []
  page.on('pageerror', (error) => uncaught.push(error.message))
  await page.routeWebSocket(`${fakeOrigin.replace('https:', 'wss:')}/**`, (socket) => socket.close())
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === localOrigin) return route.continue()
    if (request.method() === 'GET' && url.href === qrScriptUrl) {
      return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: '/* QR dependency is not exercised by this price-table fixture. */' })
    }
    if (url.origin !== fakeOrigin) {
      unexpected.push(`${request.method()} ${url.href}`)
      return route.abort()
    }
    if (url.pathname === '/functions/v1/display-program' && request.method() === 'POST') return route.fulfill(json(makeProgram()))
    if (url.pathname === '/functions/v1/display-state' && request.method() === 'POST') return route.fulfill(json({ ok: true }))
    unexpected.push(`${request.method()} ${url.pathname}`)
    return route.fulfill(json({ message: 'Operação não simulada' }, 405))
  })

  await page.goto('./display/table-rotation-fixture', { waitUntil: 'domcontentloaded' })
  const table = page.locator('.menu-template')
  await expect(table).toBeVisible()
  await expect(table.locator('h1')).toHaveText('Tabela de preços')
  await expect(table.locator('.menu-row')).toHaveCount(30)

  const expectedVisible = testInfo.project.name === 'desktop' ? 6 : 5
  const pageCount = Math.ceil(30 / expectedVisible)
  const pageDurationMs = Math.floor(6000 / pageCount)
  const visibleRows = table.locator('.menu-row:visible')
  await expect(visibleRows).toHaveCount(expectedVisible)
  await expect(visibleRows.first()).toContainText('Produto 01')
  await expect(visibleRows.last()).toContainText(`Produto ${String(expectedVisible).padStart(2, '0')}`)
  const headerBefore = await table.locator('header').textContent()
  await page.screenshot({ path: testInfo.outputPath(`commercial-table-30-${testInfo.project.name}-page-1.png`), fullPage: true })

  await page.waitForTimeout(pageDurationMs + 220)
  await expect(visibleRows).toHaveCount(expectedVisible)
  await expect(visibleRows.first()).toContainText(`Produto ${String(expectedVisible + 1).padStart(2, '0')}`)
  expect(await table.locator('header').textContent()).toBe(headerBefore)
  await page.screenshot({ path: testInfo.outputPath(`commercial-table-30-${testInfo.project.name}-page-2.png`), fullPage: true })

  const metrics = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }))
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1)
  expect(unexpected, 'Player fictício não deve acessar outros serviços').toEqual([])
  expect(uncaught, 'Player não deve gerar exceções não tratadas').toEqual([])
})
