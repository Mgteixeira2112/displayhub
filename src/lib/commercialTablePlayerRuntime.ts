import { regionAt } from './commercialRotation'

const LANDSCAPE_DEFAULT = 6
const PORTRAIT_DEFAULT = 5
const FALLBACK_SLOT_MS = 12_000

export function resolveVisibleCount(itemCount: number, portrait: boolean, configured?: number | null) {
  if (!Number.isSafeInteger(itemCount) || itemCount < 0) throw new RangeError('itemCount must be a nonnegative safe integer')
  const requested = configured == null ? (portrait ? PORTRAIT_DEFAULT : LANDSCAPE_DEFAULT) : configured
  if (!Number.isSafeInteger(requested) || requested < 1) throw new RangeError('visibleCount must be a positive safe integer')
  return itemCount === 0 ? requested : Math.min(itemCount, requested)
}

export function resolvePageDurationMs(slotDurationMs: number, pageCount: number, configured?: number | null) {
  if (!Number.isFinite(slotDurationMs) || slotDurationMs <= 0) throw new RangeError('slotDurationMs must be positive and finite')
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw new RangeError('pageCount must be a positive safe integer')
  if (configured != null) {
    if (!Number.isFinite(configured) || configured <= 0) throw new RangeError('configured page duration must be positive and finite')
    return Math.max(1, Math.floor(configured))
  }
  return Math.max(1, Math.floor(slotDurationMs / pageCount))
}

function readSeconds(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  const numeric = Number.parseFloat(trimmed)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return trimmed.endsWith('ms') ? numeric / 1000 : numeric
}

function readSlotDurationMs(root: HTMLElement) {
  const progress = root.querySelector<HTMLElement>('.player-screen .player-progress')
  const inlineSeconds = readSeconds(progress?.style.animationDuration)
  if (inlineSeconds) return inlineSeconds * 1000
  if (progress) {
    const computedSeconds = readSeconds(window.getComputedStyle(progress).animationDuration)
    if (computedSeconds) return computedSeconds * 1000
  }
  return FALLBACK_SLOT_MS
}

function readConfiguredPositiveInt(element: HTMLElement, name: string) {
  const raw = element.dataset[name]
  if (!raw) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

function readConfiguredPositiveMs(element: HTMLElement, name: string) {
  const raw = element.dataset[name]
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function installCommercialTableRotation(root: HTMLElement) {
  let timer: number | null = null
  let frame: number | null = null
  let currentRows: HTMLElement[] = []
  let stopped = false

  const clearTimer = () => {
    if (timer != null) window.clearTimeout(timer)
    timer = null
  }

  const restore = () => {
    currentRows.forEach((row) => { row.hidden = false })
    currentRows = []
  }

  const scheduleReset = () => {
    if (stopped || frame != null) return
    frame = window.requestAnimationFrame(() => {
      frame = null
      reset()
    })
  }

  const reset = () => {
    clearTimer()
    restore()
    if (stopped) return

    const container = root.querySelector<HTMLElement>('.player-screen .menu-template .menu-rows')
    if (!container) return
    const rows = Array.from(container.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains('menu-row'))
    if (!rows.length) return

    currentRows = rows
    const portrait = window.innerHeight > window.innerWidth
    const configuredVisible = readConfiguredPositiveInt(container, 'visibleCount')
    const visibleCount = resolveVisibleCount(rows.length, portrait, configuredVisible)
    const pageCount = Math.max(1, Math.ceil(rows.length / visibleCount))
    if (pageCount <= 1) {
      container.dataset.pageIndex = '0'
      container.dataset.pageCount = '1'
      return
    }

    const slotDurationMs = readSlotDurationMs(root)
    const configuredPageMs = readConfiguredPositiveMs(container, 'pageDurationMs')
    const pageDurationMs = resolvePageDurationMs(slotDurationMs, pageCount, configuredPageMs)
    const startedAt = performance.now()

    const renderPage = () => {
      if (stopped || !container.isConnected) return
      const elapsedMs = Math.max(0, performance.now() - startedAt)
      const page = regionAt(rows, visibleCount, elapsedMs, pageDurationMs)
      rows.forEach((row, index) => { row.hidden = index < page.firstItem || index >= page.lastItem })
      container.dataset.pageIndex = String(page.pageIndex)
      container.dataset.pageCount = String(page.pageCount)
      container.dataset.visibleCount = String(visibleCount)
      container.classList.remove('commercial-table-page-change')
      void container.offsetWidth
      container.classList.add('commercial-table-page-change')
      const remainder = elapsedMs % pageDurationMs
      timer = window.setTimeout(renderPage, Math.max(20, pageDurationMs - remainder))
    }

    renderPage()
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList' || (mutation.type === 'attributes' && mutation.attributeName === 'style'))) scheduleReset()
  })
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
  window.addEventListener('resize', scheduleReset)
  scheduleReset()

  return () => {
    stopped = true
    observer.disconnect()
    window.removeEventListener('resize', scheduleReset)
    clearTimer()
    if (frame != null) window.cancelAnimationFrame(frame)
    restore()
  }
}
