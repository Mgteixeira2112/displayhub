const { test, expect } = require('@playwright/test')

// Este teste monta o aplicativo real; somente as respostas HTTP são sintéticas.
// Nenhuma credencial, conta, registro ou serviço de produção participa do teste.
const fakeOrigin = 'https://example.supabase.co'
const localOrigin = 'http://127.0.0.1:4173'
const fakeUser = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'visual.test@example.invalid',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Pessoa Fictícia' },
  created_at: '2020-01-01T00:00:00.000Z',
  confirmed_at: '2020-01-01T00:00:00.000Z',
}
const account = { company_id: '00000000-0000-4000-8000-000000000002', unit_id: null, role: 'admin', full_name: 'Pessoa Fictícia' }
const views = [
  ['overview', 'Início'],
  ['displays', 'Telas'],
  ['library', 'Conteúdo'],
  ['posters', 'Criar'],
  ['smart-scenes', 'Smart Scenes'],
  ['campaigns', 'Campanhas'],
  ['devices', 'Players Windows'],
  ['groups', 'Video Wall e Grupos'],
  ['playlists', 'Playlists avançadas'],
  ['schedule', 'Programação avançada'],
  ['technical-templates', 'Templates técnicos'],
  ['history', 'Histórico técnico'],
  ['settings', 'Configurações'],
]

function json(data, status = 200) {
  return { status, contentType: 'application/json; charset=utf-8', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(data) }
}

test('navegação interna real com banco e login completamente fictícios', async ({ page }, testInfo) => {
  const unexpected = []
  const uncaught = []
  page.on('pageerror', (error) => uncaught.push(error.message))

  // Impedir explicitamente sockets de Realtime; também não há pareamento nem players.
  await page.routeWebSocket(`${fakeOrigin.replace('https:', 'wss:')}/**`, (socket) => socket.close())
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === localOrigin) return route.continue()
    // O script público de QR é referenciado no HTML, mas o teste de estados vazios não
    // precisa gerar QR. Neutralizá-lo somente no navegador de teste, sem acessar a CDN.
    if (url.href === 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js' && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* QR fora do escopo dos estados vazios */' })
    }
    if (url.origin !== fakeOrigin) {
      unexpected.push(`Endereço externo bloqueado: ${url.origin}`)
      return route.abort()
    }

    const { pathname } = url
    if (pathname === '/auth/v1/token' && request.method() === 'POST' && url.searchParams.get('grant_type') === 'password') {
      return route.fulfill(json({ access_token: 'VISUAL_FIXTURE_ONLY', refresh_token: 'VISUAL_FIXTURE_REFRESH', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: fakeUser }))
    }
    if (pathname === '/auth/v1/user' && request.method() === 'GET') return route.fulfill(json(fakeUser))
    if (pathname.startsWith('/rest/v1/') && request.method() === 'GET') {
      const table = pathname.slice('/rest/v1/'.length)
      const data = table === 'profiles' ? account : table === 'companies' ? { name: 'Empresa Fictícia' } : []
      return route.fulfill(json(data))
    }
    // Não permitir nenhuma escrita, função ou endpoint não listado, mesmo no servidor fictício.
    unexpected.push(`Operação não simulada: ${request.method()} ${pathname}`)
    return route.fulfill(json({ message: 'Operação não disponível no teste visual' }, 405))
  })

  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await page.locator('form input[type="email"]').fill(fakeUser.email)
  await page.locator('form input[type="password"]').fill('senha-apenas-para-simulacao')
  await page.locator('form button[type="submit"]').click()
  await expect(page.locator('.software-company-summary strong')).toHaveText('Empresa Fictícia')
  await expect(page.locator('.software-main.view-overview')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  for (const [view, heading] of views) {
    // O evento é o mecanismo de navegação já usado pelo app, sem acionar ações de gravação.
    await page.evaluate((target) => window.dispatchEvent(new CustomEvent('displayhub:navigate', { detail: target })), view)
    const surface = page.locator(`.software-main.view-${view}`)
    await expect(surface).toBeVisible()
    await expect(surface.locator('.software-topbar-copy strong')).toHaveText(heading)
    await expect(surface.locator('.software-content')).toBeVisible()
    const metrics = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }))
    expect(metrics.document, `Rolagem horizontal em ${testInfo.project.name}/${view}`).toBeLessThanOrEqual(metrics.viewport + 1)
    await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-interno-${view}.png`), fullPage: true, animations: 'disabled' })
  }

  expect(unexpected, 'Toda requisição deve ficar local ou receber resposta fictícia; nenhuma escrita é permitida').toEqual([])
  expect(uncaught, 'Sem exceções não tratadas na navegação interna').toEqual([])
})
