import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const imports = readFileSync('src/smart-scenes-hero-top-layout.css', 'utf8')
if (!imports.includes("@import './smart-scenes-cockpit.css';")) {
  throw new Error('O CSS Cockpit de Smart Scenes não está importado.')
}

const source = readFileSync('src/smart-scenes-cockpit.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
if (/grid-template-columns\s*:|display\s*:\s*none|pointer-events\s*:|!important|\.smart-scene-preview|\.smart-scene-player|\.smart-scene-hero|\.hero-canvas/.test(source)) {
  throw new Error('O acabamento não pode mudar grades, ocultar controles nem alterar canvas, prévias ou player.')
}
const rules = source.match(/[^{}]+\{/g) || []
for (const rule of rules) {
  if (rule.trim().startsWith('@')) continue
  const selectors = rule.slice(0, -1).split(',')
  if (selectors.some((selector) => !selector.trim().startsWith('.modern-software-shell .view-smart-scenes '))) {
    throw new Error(`Seletor fora do escopo Smart Scenes: ${rule.trim()}`)
  }
}

const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.css'))
if (!assets.length) throw new Error('O build não gerou CSS.')
const compiled = assets.map((name) => readFileSync(join('dist/assets', name), 'utf8')).join('\n')
const selectors = [
  '.modern-software-shell .view-smart-scenes .smart-scenes-toolbar > input',
  '.modern-software-shell .view-smart-scenes .smart-scene-row.is-expanded',
  '.modern-software-shell .view-smart-scenes .smart-scene-editor',
  '.modern-software-shell .view-smart-scenes .smart-scenes-saved',
]
for (const selector of selectors) {
  if (!compiled.includes(selector)) throw new Error(`CSS de Smart Scenes ausente no build: ${selector}`)
}
console.log(`Cockpit Smart Scenes: ${selectors.length} seletores compilados; escopo, canvas, prévias e player protegidos.`)
