import { useEffect, useRef, useState } from 'react'
import PromotionPosterView, { type PromotionPosterData } from './PromotionPosterView'

export const DEMO_BEER_VIDEO_URL = 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Jane_pouring_beer_fast.webm'

export type PromotionVideoMetadata = {
  background_video_url?: string
  background_overlay_opacity?: number
}

export function readPromotionVideoMetadata(layoutPositions: unknown): PromotionVideoMetadata {
  if (!layoutPositions || typeof layoutPositions !== 'object' || Array.isArray(layoutPositions)) return {}
  const source = layoutPositions as Record<string, unknown>
  const url = typeof source.background_video_url === 'string' ? source.background_video_url.trim() : ''
  const rawOpacity = typeof source.background_overlay_opacity === 'number' && Number.isFinite(source.background_overlay_opacity)
    ? source.background_overlay_opacity
    : 0.38
  return {
    background_video_url: url || undefined,
    background_overlay_opacity: Math.min(0.8, Math.max(0, rawOpacity)),
  }
}

function SeamlessPromotionVideo({ src }: { src: string }) {
  const firstRef = useRef<HTMLVideoElement | null>(null)
  const secondRef = useRef<HTMLVideoElement | null>(null)
  const activeRef = useRef<0 | 1>(0)
  const switchingRef = useRef(false)
  const cleanupTimerRef = useRef<number | null>(null)
  const [active, setActive] = useState<0 | 1>(0)

  useEffect(() => {
    const first = firstRef.current
    const second = secondRef.current
    if (!first || !second) return

    activeRef.current = 0
    switchingRef.current = false
    setActive(0)
    first.currentTime = 0
    second.currentTime = 0
    second.pause()
    first.load()
    second.load()
    void first.play().catch(() => undefined)

    return () => {
      if (cleanupTimerRef.current != null) window.clearTimeout(cleanupTimerRef.current)
      first.pause()
      second.pause()
    }
  }, [src])

  function handoff(index: 0 | 1, force = false) {
    if (activeRef.current !== index || switchingRef.current) return
    const current = index === 0 ? firstRef.current : secondRef.current
    const next = index === 0 ? secondRef.current : firstRef.current
    if (!current || !next) return

    const remaining = Number.isFinite(current.duration) ? current.duration - current.currentTime : Number.POSITIVE_INFINITY
    if (!force && remaining > 0.9) return

    const activateNext = () => {
      if (switchingRef.current) return
      switchingRef.current = true
      try { next.currentTime = 0 } catch { /* media metadata may still be loading */ }
      void next.play().then(() => {
        const nextIndex: 0 | 1 = index === 0 ? 1 : 0
        activeRef.current = nextIndex
        setActive(nextIndex)
        cleanupTimerRef.current = window.setTimeout(() => {
          current.pause()
          try { current.currentTime = 0 } catch { /* no-op */ }
          switchingRef.current = false
          cleanupTimerRef.current = null
        }, 420)
      }).catch(() => {
        switchingRef.current = false
      })
    }

    if (next.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) activateNext()
    else {
      const onCanPlay = () => activateNext()
      next.addEventListener('canplay', onCanPlay, { once: true })
      next.load()
    }
  }

  return (
    <>
      <video
        ref={firstRef}
        className={`promo-video-background promo-video-loop-layer${active === 0 ? ' is-active' : ''}`}
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onTimeUpdate={() => handoff(0)}
        onEnded={() => handoff(0, true)}
      />
      <video
        ref={secondRef}
        className={`promo-video-background promo-video-loop-layer${active === 1 ? ' is-active' : ''}`}
        src={src}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onTimeUpdate={() => handoff(1)}
        onEnded={() => handoff(1, true)}
      />
    </>
  )
}

export default function PromotionVideoPoster({ poster, className = '' }: { poster: PromotionPosterData; className?: string }) {
  const metadata = readPromotionVideoMetadata(poster.layout_positions)
  const videoUrl = metadata.background_video_url
  const overlayOpacity = metadata.background_overlay_opacity ?? 0.38

  if (poster.theme !== 'animated_beer_video' || !videoUrl) {
    return <PromotionPosterView poster={poster} className={className} />
  }

  return (
    <div className="promo-video-stage">
      <SeamlessPromotionVideo src={videoUrl} />
      <div className="promo-video-overlay" style={{ opacity: overlayOpacity }} aria-hidden="true" />
      <PromotionPosterView poster={poster} className={`${className} promo-video-poster`.trim()} />
      {videoUrl === DEMO_BEER_VIDEO_URL && <small className="promo-video-credit">Vídeo de demonstração: Angulidayaaluta / Wikimedia Commons · CC BY-SA 4.0</small>}
    </div>
  )
}
