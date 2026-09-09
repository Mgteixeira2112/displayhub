import { useEffect, useRef } from 'react'
import type { MediaFit } from './YouTubeSyncPlayer'

type HlsInstance = {
  loadSource: (url: string) => void
  attachMedia: (media: HTMLMediaElement) => void
  destroy: () => void
  on: (event: string, callback: (...args: unknown[]) => void) => void
}

type HlsConstructor = {
  new (config?: Record<string, unknown>): HlsInstance
  isSupported: () => boolean
  Events: { MEDIA_ATTACHED: string; ERROR: string }
}

declare global {
  interface Window { Hls?: HlsConstructor }
}

let hlsApiPromise: Promise<void> | null = null

function loadHlsApi() {
  if (window.Hls?.isSupported) return Promise.resolve()
  if (hlsApiPromise) return hlsApiPromise
  hlsApiPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-displayhub-hls]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('hls_api_load_failed')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.1/dist/hls.min.js'
    script.async = true
    script.dataset.displayhubHls = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('hls_api_load_failed'))
    document.head.appendChild(script)
  })
  return hlsApiPromise
}

export type HlsMediaSample = {
  expectedPositionMs: number
  actualPositionMs: number
  buffering: boolean
  measurementKind: 'media'
  sampledAt: number
}

type Props = {
  manifestUrl: string
  title: string
  startSeconds: number
  syncKey: string
  shouldPlay: boolean
  startAt: string | null
  fitMode?: MediaFit
  getExpectedSeconds: () => number | null
  onReady: () => void
  onSample: (sample: HlsMediaSample | null) => void
}

export default function HlsSyncPlayer({ manifestUrl, title, startSeconds, syncKey, shouldPlay, startAt, fitMode = 'cover', getExpectedSeconds, onReady, onSample }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let disposed = false
    let hls: HlsInstance | null = null
    let interval = 0
    let startTimer = 0
    let buffering = true
    let readySent = false

    const updateBuffering = () => { buffering = video.readyState < 3 || video.seeking }
    const scheduleStart = () => {
      window.clearTimeout(startTimer)
      if (!shouldPlay) { video.pause(); return }
      const delay = startAt ? Math.max(0, new Date(startAt).getTime() - Date.now()) : 0
      const start = () => { if (!disposed) void video.play().catch(() => { buffering = true }) }
      if (delay <= 20) start()
      else { video.pause(); startTimer = window.setTimeout(start, delay) }
    }
    const markReady = () => {
      if (readySent) return
      readySent = true
      if (startSeconds > 0) { try { video.currentTime = startSeconds } catch { /* noop */ } }
      video.pause()
      onReady()
      scheduleStart()
    }
    const beginSampling = () => {
      interval = window.setInterval(() => {
        if (disposed) return
        updateBuffering()
        const expectedSeconds = getExpectedSeconds()
        if (expectedSeconds == null || !Number.isFinite(video.currentTime)) return
        const expectedPositionMs = Math.max(0, Math.round(expectedSeconds * 1000))
        const actualPositionMs = Math.max(0, Math.round(video.currentTime * 1000))
        const driftMs = actualPositionMs - expectedPositionMs
        onSample({ expectedPositionMs, actualPositionMs, buffering, measurementKind: 'media', sampledAt: Date.now() })
        if (shouldPlay && !buffering && !video.paused && Math.abs(driftMs) > 400) video.currentTime = expectedSeconds
      }, 1000)
    }

    video.muted = true
    video.playsInline = true
    video.addEventListener('canplay', markReady)
    video.addEventListener('waiting', () => { buffering = true })
    video.addEventListener('playing', () => { buffering = false })
    video.addEventListener('seeking', () => { buffering = true })
    video.addEventListener('seeked', () => { buffering = false })

    void loadHlsApi().then(() => {
      if (disposed) return
      const Hls = window.Hls
      if (Hls?.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: false })
        hls.attachMedia(video)
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.loadSource(manifestUrl))
        hls.on(Hls.Events.ERROR, () => { buffering = true })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = manifestUrl
      } else throw new Error('hls_not_supported')
      video.load()
      beginSampling()
    }).catch(() => { buffering = true; onSample(null) })

    return () => {
      disposed = true
      window.clearInterval(interval)
      window.clearTimeout(startTimer)
      onSample(null)
      video.pause()
      video.removeEventListener('canplay', markReady)
      video.removeAttribute('src')
      video.load()
      hls?.destroy()
    }
  }, [manifestUrl, startSeconds, syncKey, shouldPlay, startAt, getExpectedSeconds, onReady, onSample])

  const objectFit = fitMode === 'native' ? 'fill' : fitMode
  return <video ref={videoRef} className={`hls-sync-player fit-${fitMode}`} style={{ objectFit }} aria-label={title} muted playsInline preload="auto" />
}
