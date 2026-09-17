const { test, expect } = require('@playwright/test')

test('acesso público é utilizável e responsivo sem contas reais', async ({ page }, testInfo) => {
  const uncaught = []
  page.on('pageerror', (error) => uncaught.push(error.message))

  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Entrar', exact: true }).first()).toBeVisible()
  await expect(page.locator('form input[type="email"]')).toBeVisible()
  await expect(page.locator('form input[type="password"]')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  const inspect = async (state) => {
    const quality = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('form input:not([type="hidden"])'))
      return {
        width: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        unlabeled: inputs.filter((input) => !input.labels?.length && !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')).length,
      }
    })
    expect(quality.documentWidth, `Rolagem horizontal em ${testInfo.project.name}/${state}`).toBeLessThanOrEqual(quality.width + 1)
    expect(quality.unlabeled, `Campos sem identificação em ${state}`).toBe(0)
    await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-${state}.png`), fullPage: true, animations: 'disabled' })
  }

  await inspect('entrar')
  await page.getByRole('button', { name: 'Criar conta', exact: true }).first().click()
  await expect(page.locator('form input[required]')).toHaveCount(4)
  await inspect('cadastro-vazio')
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click()
  await expect(page.locator('form input[required]')).toHaveCount(2)

  expect(uncaught, 'Erros não tratados durante o fluxo público').toEqual([])
})
