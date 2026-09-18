const fs = require('node:fs')
const path = require('node:path')
const { expect } = require('@playwright/test')
const { screenshots } = require('./screen-inventory.cjs')

const root = path.join(__dirname, 'baselines')
const images = path.join(root, 'images')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
const inventory = new Set(screenshots)
const listed = new Set(manifest.screenshots)

function validateManifest() {
  if (manifest.version !== 1 || !['pending', 'candidate', 'approved'].includes(manifest.status)) {
    throw new Error('Manifesto visual inválido: versão ou estado desconhecido')
  }
  if (!Array.isArray(manifest.screenshots) || listed.size !== manifest.screenshots.length ||
      manifest.screenshots.some((name) => !inventory.has(name))) {
    throw new Error('Manifesto visual contém imagens ausentes do inventário ou repetidas')
  }
  if (screenshots.length !== 48 || inventory.size !== 48) {
    throw new Error('Inventário visual inesperado: exigidas 48 telas distintas')
  }
  if (manifest.status === 'pending') {
    if (listed.size || manifest.approval !== null) throw new Error('Manifesto pendente não pode aprovar imagens')
    return
  }
  if (listed.size !== inventory.size || screenshots.some((name) => !listed.has(name))) {
    throw new Error('Baseline candidata/aprovada deve conter exatamente as 48 imagens inventariadas')
  }
  if (manifest.status === 'candidate' && manifest.approval !== null) {
    throw new Error('Candidatas não podem ser declaradas aprovadas')
  }
  if (manifest.status === 'approved' && (!manifest.approval ||
      !Number.isInteger(manifest.approval.pr) || typeof manifest.approval.confirmation !== 'string' ||
      !manifest.approval.confirmation.trim())) {
    throw new Error('Baseline só pode ser ativada após confirmação humana registrada na PR')
  }
  for (const name of screenshots) {
    const file = path.join(images, name)
    if (!fs.existsSync(file) || !fs.readFileSync(file).subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
      throw new Error(`Imagem de referência ausente ou inválida: ${name}`)
    }
  }
}

validateManifest()

async function captureAndCompare(page, testInfo, id) {
  const name = `${testInfo.project.name}-${id}.png`
  if (!inventory.has(name)) throw new Error(`Tela não inventariada: ${name}`)
  const screenshot = await page.screenshot({
    path: testInfo.outputPath(name),
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  })
  if (manifest.status === 'approved') {
    // A referência é imutável no CI; diferenças geram imagens expected/actual/diff no relatório.
    expect(screenshot, `Diferença visual em ${name}`).toMatchSnapshot(name, {
      threshold: 0.2,
      maxDiffPixelRatio: 0.005,
    })
  }
  return screenshot
}

if (require.main === module) {
  console.log(`Baseline visual: ${manifest.status}; ${manifest.status === 'approved' ? '48 comparações obrigatórias' : 'comparação PENDENTE de aprovação humana'}`)
}

module.exports = { captureAndCompare, validateManifest }
