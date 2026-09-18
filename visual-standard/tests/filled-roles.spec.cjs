const { test, expect } = require('@playwright/test')

// Exercita o App real com um tenant inteiramente fictício. Não testa RLS nem gravações.
const fakeOrigin = 'https://example.supabase.co'
const localOrigin = 'http://127.0.0.1:4173'
const companyId = '00000000-0000-4000-8000-000000000002'
const displayOnlineId = '00000000-0000-4000-8000-000000000003'
const displayOfflineId = '00000000-0000-4000-8000-000000000004'
const playlistId = '00000000-0000-4000-8000-000000000005'
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'teste.visual@example.invalid',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Pessoa Fictícia' },
  created_at: '2020-01-01T00:00:00.000Z',
  confirmed_at: '2020-01-01T00:00:00.000Z',
}

function json(data, status = 200) {
  return {
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' },
    body: JSON.stringify(data),
  }
}

function records(role) {
  const online = {
    id: displayOnlineId,
    company_id: companyId,
    unit_id: null,
    name: 'TV Entrada Fictícia',
    location: 'Recepção de Testes',
    orientation: 'landscape',
    resolution_width: 1920,
    resolution_height: 1080,
    public_token: 'TOKEN_APENAS_DE_TESTE',
    is_active: true,
    revoked_at: null,
    last_seen_at: new Date(Date.now() - 10_000).toISOString(),
    active_playlist_id: playlistId,
  }
  const offline = {
    ...online,
    id: displayOfflineId,
    name: 'TV Depósito Fictícia',
    location: 'Depósito de Testes',
    public_token: 'OUTRO_TOKEN_APENAS_DE_TESTE',
    last_seen_at: null,
    active_playlist_id: null,
  }
  return {
    profiles: { company_id: companyId, unit_id: null, role, full_name: 'Pessoa Fictícia' },
    companies: { name: 'Empresa Fictícia' },
    units: [{ id: '00000000-0000-4000-8000-000000000006', name: 'Unidade de Testes' }],
    displays: [online, offline],
    playlists: [{ id: playlistId, name: 'Campanha Fictícia', is_active: true }],
    display_publications: [{
      id: '00000000-0000-4000-8000-000000000007',
      display_id: displayOnlineId,
      playlist_id: playlistId,
      starts_at: null,
      ends_at: null,
      is_active: true,
    }],
    promotion_posters: [{
      id: '00000000-0000-4000-8000-000000000008',
      product_name: 'Café Demonstrativo',
      price: 12.5,
      template_key: 'modelo_ficticio',
      created_at: '2020-01-01T00:00:00.000Z',
    }],
    content_items: [{
      id: '00000000-0000-4000-8000-000000000009',
      type: 'hls',
      title: 'Vídeo Demonstrativo Fictício',
      category: 'Testes',
      storage_path: null,
      mime_type: null,
      file_size: null,
      provider: 'hls',
      external_url: 'https://media.example.invalid/nao-reproduzir.m3u8',
      external_id: null,
      created_at: '2020-01-01T00:00:00.000Z',
    }],
  }
}

async function isolateBrowser(page, role, unexpected) {
  const data = records(role)
  await page.routeWebSocket(`${fakeOrigin.replace('https:', 'wss:')}/**`, (socket) => socket.close())
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === localOrigin) return route.continue()
    if (url.href === 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js' && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* QR fora deste teste */' })
    }
    if (url.origin !== fakeOrigin) {
      unexpected.push(`Host externo bloqueado: ${url.origin}`)
      return route.abort()
    }
    if (url.pathname === '/auth/v1/token' && request.method() === 'POST' && url.searchParams.get('grant_type') === 'password') {
      return route.fulfill(json({
        access_token: 'SOMENTE_FIXTURE_VISUAL',
        refresh_token: 'REFRESH_SOMENTE_FIXTURE',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user,
      }))
    }
    if (url.pathname === '/auth/v1/user' && request.method() === 'GET') return route.fulfill(json(user))
    if (url.pathname.startsWith('/rest/v1/') && request.method() === 'GET') {
      const table = url.pathname.slice('/rest/v1/'.length)
      return route.fulfill(json(Object.prototype.hasOwnProperty.call(data, table) ? data[table] : []))
    }
    // Proibir RPC, gravações, Storage e qualquer outro endpoint, mesmo no host falso.
    unexpected.push(`Operação não simulada: ${request.method()} ${url.pathname}`)
    return route.fulfill(json({ message: 'Operação proibida no teste visual' }, 405))
  })
}

async function screenshot(page, testInfo, role, view) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  expect(dimensions.document, `Overflow horizontal em ${role}/${view}/${testInfo.project.name}`).toBeLessThanOrEqual(dimensions.viewport + 1)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: testInfo.outputPath(`filled-${role}-${view}.png`),
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  })
}

for (const [role, label, canManage] of [
  ['admin', 'Administrador', true],
  ['manager', 'Gerente', true],
  ['operator', 'Operador', false],
]) {
  test(`dados preenchidos e controles de interface do perfil ${role}`, async ({ page }, testInfo) => {
    const unexpected = []
    const uncaught = []
    page.on('pageerror', (error) => uncaught.push(error.message))
    await isolateBrowser(page, role, unexpected)
    await page.goto('./', { waitUntil: 'domcontentloaded' })
    await page.locator('form input[type="email"]').fill(user.email)
    await page.locator('form input[type="password"]').fill('senha-ficticia-de-teste')
    await page.locator('form button[type="submit"]').click()

    await expect(page.locator('.software-company-summary strong')).toHaveText('Empresa Fictícia')
    await expect(page.locator('.software-user span')).toHaveText(label)
    await expect(page.locator('.view-overview .home-stats article').first().locator('strong')).toHaveText('2')
    await expect(page.locator('.view-overview .home-current .home-list')).toContainText('Campanha Fictícia')
    await expect(page.locator('.view-overview .home-attention .home-list')).toContainText('TV Depósito Fictícia')
    await expect(page.locator('.view-overview .home-offer-grid')).toContainText('Café Demonstrativo')
    await screenshot(page, testInfo, role, 'overview')

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('displayhub:navigate', { detail: 'displays' })))
    await expect(page.locator('.view-displays .display-list .display-card')).toHaveCount(2)
    await expect(page.locator('.view-displays .display-list')).toContainText('TV Entrada Fictícia')
    await expect(page.locator('.view-displays .display-list')).toContainText('TV Depósito Fictícia')
    await expect(page.locator('.view-displays .display-form')).toHaveCount(canManage ? 1 : 0)
    await expect(page.locator('.view-displays .display-list .danger-button')).toHaveCount(canManage ? 2 : 0)
    await screenshot(page, testInfo, role, 'displays')

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('displayhub:navigate', { detail: 'library' })))
    await expect(page.locator('.view-library .content-gallery-media .content-card')).toHaveCount(1)
    await expect(page.locator('.view-library .content-gallery-media')).toContainText('Vídeo Demonstrativo Fictício')
    // A biblioteca tem outra barra para conteúdo comercial; verificar apenas a barra de mídia.
    await expect(page.locator('.view-library .content-controls-media .content-create-toolbar')).toHaveCount(canManage ? 1 : 0)
    await expect(page.locator('.view-library .content-gallery-media .danger-button')).toHaveCount(canManage ? 1 : 0)
    await screenshot(page, testInfo, role, 'library')

    expect(unexpected, 'Apenas chamadas locais ou HTTP fictício de leitura e login são permitidos').toEqual([])
    expect(uncaught, 'Não podem ocorrer exceções não tratadas').toEqual([])
  })
}
