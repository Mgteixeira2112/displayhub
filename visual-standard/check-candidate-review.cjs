// Audita a lista de 48 imagens candidatas sem converter uma revisão em aprovação.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { screenshots } = require('./screen-inventory.cjs')

const root = path.join(__dirname, 'baselines')
const review = JSON.parse(fs.readFileSync(path.join(root, 'approved-review-20260918.json'), 'utf8'))
const active = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
const names = Object.keys(review.screenshots || {})
const expected = new Set(screenshots)
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex')
const validHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

if (review.version !== 1 || review.review_state !== 'approved_user_20260917_pr327' ||
    typeof review.source_commit !== 'string' || !/^[a-f0-9]{40}$/.test(review.source_commit) ||
    !Number.isInteger(review.ci_run) || !Number.isInteger(review.artifact_id) ||
    !validHash(review.artifact_sha256) ||
    names.length !== 48 || new Set(names).size !== 48 ||
    names.some((name) => !expected.has(name) || !validHash(review.screenshots[name]))) {
  throw new Error('Inventário de revisão inválido: exigidas 48 imagens únicas e hashes SHA-256 válidos')
}
const directory = path.join(root, 'images')
const committed = fs.existsSync(directory)
  ? fs.readdirSync(directory).filter((name) => name.endsWith('.png'))
  : []
if (active.status !== 'approved' || active.approval?.pr !== 327) throw new Error('Conjunto aprovado somente após confirmação específica da PR #327')
if (committed.length) {
  if (committed.length !== 48 || committed.some((name) => !expected.has(name))) {
    throw new Error('Imagens versionadas incompletas ou não inventariadas')
  }
  for (const name of screenshots) {
    if (sha256(fs.readFileSync(path.join(directory, name))) !== review.screenshots[name]) {
      throw new Error(`Imagem alterada desde a revisão candidata: ${name}`)
    }
  }
} else if (active.status !== 'pending') {
  throw new Error('Manifesto candidato/aprovado sem as 48 imagens versionadas')
}
console.log(`Revisão visual: ${names.length} hashes verificados no inventário; ${committed.length} PNGs versionados; baseline ativa: ${active.status}. Revisão não equivale a aprovação.`)
