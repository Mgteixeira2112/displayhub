import { useEffect, useRef } from 'react'

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
  getExpectedSeconds: () => number | null
  onSample: (sample: HlsMediaSample | null) => void
}

export default function HlsSyncPlayer({ manifestUrl, title, startSeconds, syncKey, getExpectedSeconds, onSample }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let disposed = false
    let hls: HlsInstance | null = null
    let interval = 0
    let buffering = true

    const updateBuffering = () => {
      buffering = video.readyState < 3 || video.seeking || video.paused
    }

    const startPlayback = async () => {
      if (disposed) return
      video.muted = true
      video.playsInline = true
      if (Number.isFinite(startSeconds) && startSeconds > 0) {
        try { video.currentTime = startSeconds } catch { /* seek after metadata */ }
      }
      try { await video.play() } catch { buffering = true }
    }

    const beginSampling = () => {
      window.clearInterval(interval)
      interval = window.setInterval(() => {
        if (disposed) return
        updateBuffering()
        const expectedSeconds = getExpectedSeconds()
        if (expectedSeconds == null || !Number.isFinite(video.currentTime)) return

        const expectedPositionMs = Math.max(0, Math.round(expectedSeconds * 1000))
        const actualPositionMs = Math.max(0, Math.round(video.currentTime * 1000))
        const driftMs = actualPositionMs - expectedPositionMs

        onSample({ expectedPositionMs, actualPositionMs, buffering, measurementKind: 'media', sampledAt: Date.now() })

        if (!buffering && !video.paused && Math.abs(driftMs) > 400) {
          video.currentTime = expectedSeconds
        }
      }, 1000)
    }

    const onWaiting = () => { buffering = true }
    const onPlaying = () => { buffering = false }
    const onSeeking = () => { buffering = true }
    const onSeeked = () => { buffering = false }
    const onLoadedMetadata = () => {
      if (startSeconds > 0) video.currentTime = startSeconds
    }

    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('seeking', onSeeking)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('loadedmetadata', onLoadedMetadata)

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
      } else {
        throw new Error('hls_not_supported')
      }

      void startPlayback()
      beginSampling()
    }).catch(() => {
      buffering = true
      onSample(null)
    })

    return () => {
      disposed = true
      window.clearInterval(interval)
      onSample(null)
      video.pause()
      video.removeAttribute('src')
      video.load()
      hls?.destroy()
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('seeking', onSeeking)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
    }
  }, [manifestUrl, startSeconds, syncKey, getExpectedSeconds, onSample])

  return <video ref={videoRef} className="hls-sync-player" aria-label={title} autoPlay muted playsInline preload="auto" />
}
