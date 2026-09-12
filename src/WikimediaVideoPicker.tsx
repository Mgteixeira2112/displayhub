import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'

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
  bitrate?: string
  author?: string
  license?: string
  licenseUrl?: string
}

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const presets = [
  { label: 'Cerveja', query: 'beer' },
  { label: 'Café', query: 'coffee' },
  { label: 'Hotel', query: 'hotel' },
  { label: 'Praia', query: 'beach' },
  { label: 'Restaurante', query: 'restaurant' },
  { label: 'Natureza', query: 'nature' },
]

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
    title: stripHtml(metadata.ImageDescription?.value) || fileTitle,
    fileTitle,
    pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    videoUrl: chosen.url,
    thumbUrl: normalizeMediaUrl(info.thumburl),
    quality: chosen.height ? `${chosen.height}p` : 'versão otimizada',
    bitrate: chosen.bandwidth ? `${(chosen.bandwidth / 1_000_000).toFixed(1)} Mbps` : undefined,
    author,
    license,
    licenseUrl,
  }
}

async function searchCommonsVideos(searchTerm: string) {
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
    viextmetadatafilter: 'Artist|Credit|LicenseShortName|LicenseUrl|ImageDescription',
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

function updateReactUrlInput(container: HTMLElement, url: string) {
  const input = container.querySelector<HTMLInputElement>('input[type="url"]')
  if (!input) return false
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  nativeSetter?.call(input, url)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  input.focus()
  return true
}

function WikimediaVideoPicker({ container }: { container: HTMLElement }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('beer')
  const [results, setResults] = useState<VideoResult[]>([])
  const [previewing, setPreviewing] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const preview = useMemo(() => results.find((item) => item.pageId === previewing) || null, [results, previewing])

  async function runSearch(nextQuery = query) {
    const clean = nextQuery.trim()
    if (!clean) return
    setLoading(true)
    setMessage('Buscando vídeos no Wikimedia Commons...')
    setPreviewing(null)
    try {
      const nextResults = await searchCommonsVideos(clean)
      setResults(nextResults)
      setMessage(nextResults.length ? `${nextResults.length} vídeo(s) encontrado(s).` : 'Nenhum vídeo encontrado. Tente outro termo.')
    } catch {
      setResults([])
      setMessage('Não foi possível consultar o Wikimedia Commons agora.')
    } finally {
      setLoading(false)
    }
  }

  function selectVideo(item: VideoResult) {
    const changed = updateReactUrlInput(container, withCommonsAttribution(item))
    setMessage(changed ? `Selecionado: ${item.fileTitle} · ${item.quality}${item.bitrate ? ` · ${item.bitrate}` : ''}` : 'Não foi possível atualizar a URL do cartaz.')
  }

  function choosePreset(label: string, presetQuery: string) {
    setQuery(presetQuery)
    void runSearch(presetQuery)
    setMessage(`Buscando: ${label}`)
  }

  return (
    <div className="wikimedia-video-picker">
      <button className="secondary-button compact wikimedia-picker-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        {open ? 'Fechar busca no Wikimedia' : 'Buscar vídeo no Wikimedia'}
      </button>

      {open && <div className="wikimedia-picker-panel">
        <div className="wikimedia-picker-presets">
          {presets.map((preset) => <button type="button" key={preset.label} onClick={() => choosePreset(preset.label, preset.query)} disabled={loading}>{preset.label}</button>)}
        </div>

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
            placeholder="Ex.: beer, coffee, beach..."
            aria-label="Buscar vídeos no Wikimedia Commons"
          />
          <button className="primary-button compact" type="button" onClick={() => void runSearch()} disabled={loading || !query.trim()}>{loading ? 'Buscando...' : 'Buscar'}</button>
        </div>

        {message && <small className="wikimedia-picker-message">{message}</small>}

        {preview && <div className="wikimedia-picker-preview">
          <video src={preview.videoUrl} controls autoPlay muted playsInline preload="metadata" />
          <div>
            <strong>{preview.title}</strong>
            <small>{preview.quality}{preview.bitrate ? ` · ${preview.bitrate}` : ''}</small>
            {(preview.author || preview.license) && <small>{preview.author || 'Autor não informado'}{preview.license ? ` · ${preview.license}` : ''}</small>}
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
              {(item.author || item.license) && <small>{item.author || 'Autor não informado'}{item.license ? ` · ${item.license}` : ''}</small>}
              <div className="wikimedia-picker-actions">
                <button type="button" onClick={() => setPreviewing(item.pageId)}>Pré-visualizar</button>
                <button className="primary-button compact" type="button" onClick={() => selectVideo(item)}>Usar</button>
              </div>
              {item.licenseUrl && <a className="wikimedia-license-link" href={item.licenseUrl} target="_blank" rel="noreferrer">Ver licença</a>}
            </div>
          </article>)}
        </div>

        <small className="wikimedia-picker-footnote">O DisplayHub prefere automaticamente uma transcodificação próxima de 720p e mantém a origem/licença junto da URL salva. Confirme os termos do arquivo antes do uso comercial.</small>
      </div>}
    </div>
  )
}

function mountPicker(control: HTMLElement) {
  if (control.querySelector(':scope > .wikimedia-picker-host')) return
  const host = document.createElement('div')
  host.className = 'wikimedia-picker-host'
  control.appendChild(host)
  createRoot(host).render(<WikimediaVideoPicker container={control} />)
}

export function installWikimediaVideoPicker() {
  const scan = () => {
    document.querySelectorAll<HTMLElement>('.promotion-video-controls').forEach(mountPicker)
  }

  scan()
  const observer = new MutationObserver(scan)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  return () => observer.disconnect()
}
