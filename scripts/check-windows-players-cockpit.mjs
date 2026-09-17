import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const imports = readFileSync('src/module-navigation.css', 'utf8')
if (!imports.includes("@import './windows-players-cockpit.css';")) {
  throw new Error('O CSS Cockpit de Players Windows não está importado.')
}

const source = readFileSync('src/windows-players-cockpit.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
if (/grid-template-columns\s*:|display\s*:\s*none|pointer-events\s*:|!important|supabase|player_device|claim_windows|queue_windows/.test(source)) {
  throw new Error('O acabamento não pode alterar layout estrutural, ocultar controles ou tocar na lógica dos Players Windows.')
}

const rules = source.match(/[^{}]+\{/g) || []
for (const rule of rules) {
  if (rule.trim().startsWith('@')) continue
  const selectors = rule.slice(0, -1).split(',')
  if (selectors.some((selector) => !selector.trim().startsWith('.modern-software-shell .view-devices '))) {
    throw new Error(`Seletor fora do escopo Players Windows: ${rule.trim()}`)
  }
}

const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.css'))
if (!assets.length) throw new Error('O build não gerou CSS.')
const compiled = assets.map((name) => readFileSync(join('dist/assets', name), 'utf8')).join('\n')
const selectors = [
  '.modern-software-shell .view-devices .windows-pairing-card',
  '.modern-software-shell .view-devices .windows-player-row',
  '.modern-software-shell .view-devices .windows-player-details',
  '.modern-software-shell .view-devices .windows-device-actions button',
]
for (const selector of selectors) {
  if (!compiled.includes(selector)) throw new Error(`CSS de Players Windows ausente no build: ${selector}`)
}
console.log(`Cockpit Players Windows: ${selectors.length} seletores compilados; pairing e comandos preservados.`)
