import { useMemo, useState } from 'react'

type CommonsMetadataValue = { value?: string }
type CommonsDerivative = {
  src?: string
  width?: number
  height?: number
  bandwidth?: number
  transcodekey?: string
  type?: string
}
type CommonsVideoInfo = {
  url?: string
  thumburl?: string
  width?: number
  height?: number
  mime?: string
  derivatives?: CommonsDerivative[]
  extmetadata?: Record<string, CommonsMetadataValue>
}
type CommonsPage = {
  pageid: number
  title: string
  videoinfo?: CommonsVideoInfo[]
}
type CommonsResponse = {
  query?: { pages?: CommonsPage[] }
  error?: { info?: string }
}
type VideoResult = {
  pageId: number
  title: string
  fileTitle: string
  pageUrl: string
  videoUrl: string
  thumbUrl?: string
  quality: string
  selectedHeight: number
  bitrate?: string
  bitrateBps?: number
  sourceWidth: number
  sourceHeight: number
  author?: string
  license?: string
  licenseUrl?: string
}

type Props = {
  onSelect: (url: string) => boolean
}

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const searchWordMap: Record<string, string> = {
  cerveja: 'beer',
  chope: 'draft beer',
  chopp: 'draft beer',
  copo: 'glass',
  taca: 'glass',
  servindo: 'pouring',
  servida: 'pouring',
  servido: 'pouring',
  servir: 'pouring',
  derramando: 'pouring',
  torneira: 'tap',
  garrafa: 'bottle',
  lata: 'can',
  espuma: 'foam',
  gelada: 'cold',
  cafe: 'coffee',
  praia: 'beach',
  restaurante: 'restaurant',
  natureza: 'nature',
  comida: 'food',
  bebida: 'drink',
  vinho: 'wine',
}
const portugueseStopWords = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'sendo', 'com', 'para'])

function stripHtml(value?: string) {
  if (!value) return undefined
  const doc = new DOMParser().parseFromString(value, 'text/html')
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() || undefined
}

function normalizeMediaUrl(value?: string) {
  if (!value) return undefined
  if (value.startsWith('//')) return `https:${value}`
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function derivativeHeight(item: CommonsDerivative) {
  if (typeof item.height === 'number' && item.height > 0) return item.height
  const match = item.transcodekey?.match(/(\d+)p/i)
  return match ? Number(match[1]) : 0
}

function chooseDerivative(info: CommonsVideoInfo) {
  const candidates = (info.derivatives || [])
    .map((item) => ({ ...item, normalizedSrc: normalizeMediaUrl(item.src), resolvedHeight: derivativeHeight(item) }))
    .filter((item) => item.normalizedSrc)

  if (!candidates.length) {
    const original = normalizeMediaUrl(info.url)
    if (!original) return null
    return {
      url: original,
      height: info.height || 0,
      bandwidth: undefined as number | undefined,
    }
  }

  candidates.sort((a, b) => {
    const score = (item: typeof candidates[number]) => {
      const height = item.resolvedHeight
      const over720Penalty = height > 720 ? 2000 : 0
      const heightPenalty = height ? Math.abs(720 - height) : 1200
      const type = (item.type || '').toLowerCase()
      const formatPenalty = type.includes('mp4') ? 0 : type.includes('webm') ? 5 : 20
      return over720Penalty + heightPenalty + formatPenalty
    }
    return score(a) - score(b)
  })

  const best = candidates[0]
  return {
    url: best.normalizedSrc as string,
    height: best.resolvedHeight,
    bandwidth: best.bandwidth,
  }
}

function displayFileTitle(fileTitle: string) {
  return fileTitle
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSearchTerm(value: string) {
  const ascii = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')

  return ascii
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !portugueseStopWords.has(word))
    .map((word) => searchWordMap[word] || word)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSearchVariants(value: string) {
  const normalized = normalizeSearchTerm(value)
  const variants = new Set<string>()
  if (normalized) variants.add(normalized)

  if (normalized.includes('beer')) {
    if (!normalized.includes('pour')) variants.add(`${normalized} pouring`)
    variants.add('beer pouring')
    variants.add('draft beer pouring')
    variants.add('beer glass pouring')
  }

  return Array.from(variants).slice(0, 4)
}

function toVideoResult(page: CommonsPage): VideoResult | null {
  const info = page.videoinfo?.[0]
  if (!info) return null
  const chosen = chooseDerivative(info)
  if (!chosen) return null

  const metadata = info.extmetadata || {}
  const author = stripHtml(metadata.Artist?.value || metadata.Credit?.value)
  const license = stripHtml(metadata.LicenseShortName?.value)
  const licenseUrl = normalizeMediaUrl(metadata.LicenseUrl?.value)
  const fileTitle = page.title.replace(/^File:/i, '')

  return {
    pageId: page.pageid,
    title: displayFileTitle(fileTitle),
    fileTitle,
    pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    videoUrl: chosen.url,
    thumbUrl: normalizeMediaUrl(info.thumburl),
    quality: chosen.height ? `${chosen.height}p` : 'versão otimizada',
    selectedHeight: chosen.height,
    bitrate: chosen.bandwidth ? `${(chosen.bandwidth / 1_000_000).toFixed(1)} Mbps` : undefined,
    bitrateBps: chosen.bandwidth,
    sourceWidth: info.width || 0,
    sourceHeight: info.height || 0,
    author,
    license,
    licenseUrl,
  }
}

function rankVideo(item: VideoResult, normalizedQuery: string) {
  let score = 0
  const ratio = item.sourceHeight > 0 ? item.sourceWidth / item.sourceHeight : 0
  if (ratio >= 1.5) score -= 240
  else if (ratio >= 1.2) score -= 80
  else score += 380

  if (item.selectedHeight === 720) score -= 160
  else if (item.selectedHeight >= 480 && item.selectedHeight <= 720) score -= 80
  else if (item.selectedHeight > 720) score += 70

  if (typeof item.bitrateBps === 'number') {
    if (item.bitrateBps >= 800_000 && item.bitrateBps <= 3_500_000) score -= 100
    else if (item.bitrateBps > 5_000_000) score += 220
  }

  const title = item.fileTitle.toLowerCase()
  const queryTokens = normalizedQuery.split(/\s+/).filter((word) => word.length > 2)
  for (const token of queryTokens) if (title.includes(token)) score -= 70

  if (normalizedQuery.includes('beer')) {
    if (title.includes('beer')) score -= 120
    if (title.includes('pour')) score -= 180
    if (title.includes('glass')) score -= 70
    if (title.includes('draft') || title.includes('tap')) score -= 40
  }

  return score
}

async function fetchCommonsVariant(searchTerm: string) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${searchTerm.trim()} filetype:video`,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'videoinfo',
    viprop: 'url|derivatives|extmetadata|dimensions|mime|thumburls',
    viurlwidth: '360',
    viextmetadatalanguage: 'pt-br',
    viextmetadatafilter: 'Artist|Credit|LicenseShortName|LicenseUrl',
    format: 'json',
    formatversion: '2',
    origin: '*',
  })

  const response = await fetch(`${COMMONS_API}?${params.toString()}`, { mode: 'cors' })
  if (!response.ok) throw new Error(`commons_http_${response.status}`)
  const payload = await response.json() as CommonsResponse
  if (payload.error) throw new Error(payload.error.info || 'commons_api_error')
  return (payload.query?.pages || [])
    .map(toVideoResult)
    .filter((item): item is VideoResult => Boolean(item))
}

async function searchCommonsVideos(searchTerm: string) {
  const variants = buildSearchVariants(searchTerm)
  const normalizedQuery = normalizeSearchTerm(searchTerm)
  const batches = await Promise.all(variants.map(fetchCommonsVariant))
  const unique = new Map<number, VideoResult>()
  for (const item of batches.flat()) if (!unique.has(item.pageId)) unique.set(item.pageId, item)

  return Array.from(unique.values())
    .sort((a, b) => rankVideo(a, normalizedQuery) - rankVideo(b, normalizedQuery))
    .slice(0, 8)
}

function withCommonsAttribution(item: VideoResult) {
  const url = new URL(item.videoUrl)
  const metadata = JSON.stringify({
    p: item.pageUrl,
    a: item.author || '',
    l: item.license || '',
    u: item.licenseUrl || '',
  })
  url.hash = `dhcommons=${encodeURIComponent(metadata)}`
  return url.toString()
}

export default function WikimediaVideoPicker({ onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('cerveja sendo servida no copo')
  const [results, setResults] = useState<VideoResult[]>([])
  const [previewing, setPreviewing] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const preview = useMemo(() => results.find((item) => item.pageId === previewing) || null, [results, previewing])

  async function runSearch() {
    const clean = query.trim()
    if (!clean) return
    setLoading(true)
    setMessage('Procurando as melhores opções no Wikimedia Commons...')
    setPreviewing(null)
    try {
      const nextResults = await searchCommonsVideos(clean)
      setResults(nextResults)
      setMessage(nextResults.length ? `${nextResults.length} melhor(es) opção(ões) encontrada(s).` : 'Nenhum vídeo encontrado. Descreva a cena de outra forma.')
    } catch {
      setResults([])
      setMessage('Não foi possível consultar o Wikimedia Commons agora.')
    } finally {
      setLoading(false)
    }
  }

  function selectVideo(item: VideoResult) {
    const changed = onSelect(withCommonsAttribution(item))
    setMessage(changed ? `Selecionado: ${item.title} · ${item.quality}${item.bitrate ? ` · ${item.bitrate}` : ''}` : 'Não foi possível atualizar a URL do cartaz.')
  }

  return (
    <div className="wikimedia-video-picker">
      <button className="secondary-button compact wikimedia-picker-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        {open ? 'Fechar busca no Wikimedia' : 'Buscar vídeo no Wikimedia'}
      </button>

      {open && <div className="wikimedia-picker-panel">
        <small>Descreva a cena desejada. O DisplayHub amplia a busca e prioriza vídeos horizontais e versões leves próximas de 720p.</small>
        <div className="wikimedia-picker-search">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void runSearch()
              }
            }}
            placeholder="Ex.: cerveja sendo servida no copo"
            aria-label="Buscar vídeos no Wikimedia Commons"
          />
          <button className="primary-button compact" type="button" onClick={() => void runSearch()} disabled={loading || !query.trim()}>{loading ? 'Buscando...' : 'Buscar melhores opções'}</button>
        </div>

        {message && <small className="wikimedia-picker-message">{message}</small>}

        {preview && <div className="wikimedia-picker-preview">
          <video src={preview.videoUrl} controls autoPlay muted playsInline preload="metadata" />
          <div>
            <strong>{preview.title}</strong>
            <small>{preview.quality}{preview.bitrate ? ` · ${preview.bitrate}` : ''}</small>
            <div className="wikimedia-picker-actions">
              <button className="primary-button compact" type="button" onClick={() => selectVideo(preview)}>Usar este vídeo</button>
              <a href={preview.pageUrl} target="_blank" rel="noreferrer">Abrir no Wikimedia</a>
            </div>
          </div>
        </div>}

        <div className="wikimedia-picker-grid">
          {results.map((item) => <article className="wikimedia-video-card" key={item.pageId}>
            <button className="wikimedia-video-thumb" type="button" onClick={() => setPreviewing(item.pageId)} title="Pré-visualizar vídeo">
              {item.thumbUrl ? <img src={item.thumbUrl} alt="" loading="lazy" /> : <span>▶</span>}
              <em>▶</em>
            </button>
            <div className="wikimedia-video-card-copy">
              <strong title={item.title}>{item.title}</strong>
              <small>{item.quality}{item.bitrate ? ` · ${item.bitrate}` : ''}</small>
              <div className="wikimedia-picker-actions">
                <button type="button" onClick={() => setPreviewing(item.pageId)}>Pré-visualizar</button>
                <button className="primary-button compact" type="button" onClick={() => selectVideo(item)}>Usar</button>
              </div>
            </div>
          </article>)}
        </div>

        <small className="wikimedia-picker-footnote">Autor, licença e página de origem continuam preservados junto do vídeo selecionado, sem poluir a tela de busca.</small>
      </div>}
    </div>
  )
}
