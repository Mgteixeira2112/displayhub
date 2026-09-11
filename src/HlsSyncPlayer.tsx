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
const VIDEO_WALL_READY_STABILIZATION_MS = 2000
const VIDEO_WALL_DRIFT_RECOVERY_MS = 500
const VIDEO_WALL_RECOVERY_COOLDOWN_MS = 1000
const VIDEO_WALL_SAMPLE_INTERVAL_MS = 500
const VIDEO_WALL_FORWARD_BUFFER_SECONDS = 20

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
  const startTimerRef = useRef(0)
  const readyRef = useRef(false)
  const resetReadyForPreparationRef = useRef<(() => void) | null>(null)
  const startSecondsRef = useRef(startSeconds)
  const shouldPlayRef = useRef(shouldPlay)
  const startAtRef = useRef(startAt)
  const getExpectedSecondsRef = useRef(getExpectedSeconds)
  const onReadyRef = useRef(onReady)
  const onSampleRef = useRef(onSample)

  startSecondsRef.current = startSeconds
  shouldPlayRef.current = shouldPlay
  startAtRef.current = startAt
  getExpectedSecondsRef.current = getExpectedSeconds
  onReadyRef.current = onReady
  onSampleRef.current = onSample

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let disposed = false
    let hls: HlsInstance | null = null
    let sampleInterval = 0
    let readyTimer = 0
    let buffering = true
    let readySent = false
    let lastRecoverySeekAt = 0

    const updateBuffering = () => { buffering = video.readyState < 3 || video.seeking }

    const canSeekTo = (targetSeconds: number) => {
      if (!Number.isFinite(targetSeconds) || targetSeconds < 0) return false
      if (!video.seekable.length) return !Number.isFinite(video.duration) || targetSeconds <= video.duration + 0.25
      for (let index = 0; index < video.seekable.length; index += 1) {
        if (targetSeconds >= video.seekable.start(index) - 0.25 && targetSeconds <= video.seekable.end(index) + 0.25) return true
      }
      return false
    }

    const alignToMaster = () => {
      if (!shouldPlayRef.current || video.seeking) return
      const expectedSeconds = getExpectedSecondsRef.current()
      if (expectedSeconds == null || !Number.isFinite(video.currentTime)) return
      const driftMs = Math.round((video.currentTime - expectedSeconds) * 1000)
      if (Math.abs(driftMs) <= VIDEO_WALL_DRIFT_RECOVERY_MS) return
      const now = Date.now()
      if (now - lastRecoverySeekAt < VIDEO_WALL_RECOVERY_COOLDOWN_MS || !canSeekTo(expectedSeconds)) return
      lastRecoverySeekAt = now
      try { video.currentTime = Math.max(0, expectedSeconds) } catch { /* noop */ }
    }

    const scheduleStart = () => {
      window.clearTimeout(startTimerRef.current)
      startTimerRef.current = 0
      if (!shouldPlayRef.current) {
        video.pause()
        return
      }
      const targetStartAt = startAtRef.current
      const delay = targetStartAt ? Math.max(0, new Date(targetStartAt).getTime() - Date.now()) : 0
      const start = () => {
        if (!disposed) void video.play().catch(() => { buffering = true })
      }
      if (delay <= 20) start()
      else {
        video.pause()
        startTimerRef.current = window.setTimeout(start, delay)
      }
    }

    const markReady = () => {
      if (readySent || video.readyState < 3) return
      readySent = true
      window.clearTimeout(readyTimer)
      readyTimer = 0
      readyRef.current = true
      const initialStartSeconds = Math.max(0, startSecondsRef.current)
      if (initialStartSeconds > 0) {
        try { video.currentTime = initialStartSeconds } catch { /* noop */ }
      }
      video.pause()
      onReadyRef.current()
      scheduleStart()
    }

    const scheduleReady = () => {
      if (readySent || video.readyState < 3) return
      if (shouldPlayRef.current) {
        markReady()
        return
      }
      if (readyTimer) return
      readyTimer = window.setTimeout(() => {
        readyTimer = 0
        if (!disposed && video.readyState >= 3) markReady()
      }, VIDEO_WALL_READY_STABILIZATION_MS)
    }

    const resetReadyForPreparation = () => {
      readySent = false
      readyRef.current = false
      if (readyTimer) {
        window.clearTimeout(readyTimer)
        readyTimer = 0
      }
      scheduleReady()
    }
    resetReadyForPreparationRef.current = resetReadyForPreparation

    const beginSampling = () => {
      sampleInterval = window.setInterval(() => {
        if (disposed) return
        scheduleReady()
        updateBuffering()
        const expectedSeconds = getExpectedSecondsRef.current()
        if (expectedSeconds == null || !Number.isFinite(video.currentTime)) return
        const expectedPositionMs = Math.max(0, Math.round(expectedSeconds * 1000))
        const actualPositionMs = Math.max(0, Math.round(video.currentTime * 1000))
        onSampleRef.current({ expectedPositionMs, actualPositionMs, buffering, measurementKind: 'media', sampledAt: Date.now() })
        alignToMaster()
      }, VIDEO_WALL_SAMPLE_INTERVAL_MS)
    }

    const handleCanPlay = () => {
      updateBuffering()
      scheduleReady()
      alignToMaster()
    }
    const handleWaiting = () => {
      buffering = true
      if (!readySent && readyTimer) {
        window.clearTimeout(readyTimer)
        readyTimer = 0
      }
      alignToMaster()
    }
    const handlePlaying = () => {
      buffering = false
      alignToMaster()
    }
    const handleSeeking = () => { buffering = true }
    const handleSeeked = () => {
      updateBuffering()
      alignToMaster()
    }

    readyRef.current = false
    video.muted = true
    video.playsInline = true
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('progress', scheduleReady)
    video.addEventListener('loadedmetadata', scheduleReady)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('seeking', handleSeeking)
    video.addEventListener('seeked', handleSeeked)

    void loadHlsApi().then(() => {
      if (disposed) return
      const Hls = window.Hls
      if (Hls?.isSupported()) {
        const preparingForSync = !shouldPlayRef.current || Boolean(startAtRef.current)
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          ...(preparingForSync ? {
            maxBufferLength: VIDEO_WALL_FORWARD_BUFFER_SECONDS,
            maxMaxBufferLength: VIDEO_WALL_FORWARD_BUFFER_SECONDS + 10,
            backBufferLength: 0,
          } : {}),
        })
        hls.attachMedia(video)
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.loadSource(manifestUrl))
        hls.on(Hls.Events.ERROR, () => { buffering = true })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = manifestUrl
      } else {
        throw new Error('hls_not_supported')
      }
      video.load()
      beginSampling()
    }).catch(() => {
      buffering = true
      onSampleRef.current(null)
    })

    return () => {
      disposed = true
      readyRef.current = false
      if (resetReadyForPreparationRef.current === resetReadyForPreparation) resetReadyForPreparationRef.current = null
      window.clearInterval(sampleInterval)
      window.clearTimeout(readyTimer)
      window.clearTimeout(startTimerRef.current)
      startTimerRef.current = 0
      onSampleRef.current(null)
      video.pause()
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('progress', scheduleReady)
      video.removeEventListener('loadedmetadata', scheduleReady)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('seeking', handleSeeking)
      video.removeEventListener('seeked', handleSeeked)
      video.removeAttribute('src')
      video.load()
      hls?.destroy()
    }
  }, [manifestUrl])

  useEffect(() => {
    if (!shouldPlay) resetReadyForPreparationRef.current?.()
  }, [shouldPlay])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !readyRef.current) return

    const targetSeconds = Math.max(0, startSeconds)
    try { video.currentTime = targetSeconds } catch { /* noop */ }
    onReadyRef.current()

    window.clearTimeout(startTimerRef.current)
    startTimerRef.current = 0
    if (!shouldPlay) {
      video.pause()
      return
    }

    const delay = startAt ? Math.max(0, new Date(startAt).getTime() - Date.now()) : 0
    if (delay <= 20) {
      void video.play().catch(() => { /* buffering state is reported by media events */ })
      return
    }

    video.pause()
    startTimerRef.current = window.setTimeout(() => {
      void video.play().catch(() => { /* buffering state is reported by media events */ })
    }, delay)
    return () => window.clearTimeout(startTimerRef.current)
  }, [syncKey, startSeconds, shouldPlay, startAt])

  const objectFit = fitMode === 'native' ? 'fill' : fitMode
  return <video ref={videoRef} className={`hls-sync-player fit-${fitMode}`} style={{ objectFit }} aria-label={title} muted playsInline preload="auto" />
}
