import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Smoke de build: evita aprovar a prévia e publicar o dashboard sem os estilos.
// Verifica o CSS entregue pelo Vite, não apenas o arquivo-fonte.
const source = readFileSync('src/home-dashboard.css', 'utf8')
if (!source.includes("@import './home-dashboard-cockpit.css';")) {
  throw new Error('O CSS do Cockpit não está importado pelo dashboard.')
}

const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.css'))
if (assets.length === 0) throw new Error('O build não gerou um arquivo CSS.')
const compiledCss = assets.map((name) => readFileSync(join('dist/assets', name), 'utf8')).join('\n')

const requiredSelectors = [
  '.software-shell .home-welcome',
  '.software-shell .home-action',
  '.software-shell .home-stats',
  '.software-shell .home-grid',
  '.software-shell .home-offer-grid',
]

for (const selector of requiredSelectors) {
  if (!compiledCss.includes(selector)) {
    throw new Error(`Estilo do Cockpit ausente no build: ${selector}`)
  }
}

console.log(`Cockpit: CSS compilado validado (${assets.length} arquivo(s), ${requiredSelectors.length} seletores).`)
