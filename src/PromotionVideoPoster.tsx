import { useEffect, useState } from 'react'
import PromotionPosterView, { type PromotionPosterData } from './PromotionPosterView'

export const DEMO_BEER_VIDEO_URL = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2b/Jane_pouring_beer_fast.webm/Jane_pouring_beer_fast.webm.720p.vp9.webm'

export type PromotionVideoMetadata = {
  background_video_url?: string
  background_overlay_opacity?: number
}

type CachedVideo = {
  promise: Promise<string>
  objectUrl?: string
}

const cachedPromotionVideos = new Map<string, CachedVideo>()

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

export function getCachedPromotionVideoUrl(src: string) {
  return cachedPromotionVideos.get(src)?.objectUrl || null
}

export function preloadPromotionVideoToMemory(src: string) {
  const existing = cachedPromotionVideos.get(src)
  if (existing) return existing.promise

  const entry: CachedVideo = {
    promise: fetch(src, { mode: 'cors', cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`video_download_${response.status}`)
        return response.blob()
      })
      .then((blob) => {
        if (!blob.size) throw new Error('video_download_empty')
        const objectUrl = URL.createObjectURL(blob)
        entry.objectUrl = objectUrl
        return objectUrl
      })
      .catch((error) => {
        cachedPromotionVideos.delete(src)
        throw error
      }),
  }

  cachedPromotionVideos.set(src, entry)
  return entry.promise
}

function BufferedPromotionVideo({ src, loop, onEnded }: { src: string; loop: boolean; onEnded?: () => void }) {
  const [playbackSrc, setPlaybackSrc] = useState(() => getCachedPromotionVideoUrl(src) || src)

  useEffect(() => {
    // Se o arquivo já estiver integralmente em memória, a nova exibição usa o
    // blob local. Caso contrário, esta passagem continua usando a URL remota
    // enquanto o download completo é aquecido para a próxima passagem.
    setPlaybackSrc(getCachedPromotionVideoUrl(src) || src)
    void preloadPromotionVideoToMemory(src).catch(() => undefined)
  }, [src])

  return (
    <video
      className="promo-video-background"
      src={playbackSrc}
      autoPlay
      muted
      loop={loop}
      playsInline
      preload="auto"
      aria-hidden="true"
      onEnded={onEnded}
    />
  )
}

export default function PromotionVideoPoster({ poster, className = '', loop = true, onVideoEnded }: { poster: PromotionPosterData; className?: string; loop?: boolean; onVideoEnded?: () => void }) {
  const metadata = readPromotionVideoMetadata(poster.layout_positions)
  const videoUrl = metadata.background_video_url
  const overlayOpacity = metadata.background_overlay_opacity ?? 0.38

  if (poster.theme !== 'animated_beer_video' || !videoUrl) {
    return <PromotionPosterView poster={poster} className={className} />
  }

  return (
    <div className="promo-video-stage">
      <BufferedPromotionVideo key={`${videoUrl}:${loop ? 'loop' : 'once'}`} src={videoUrl} loop={loop} onEnded={onVideoEnded} />
      <div className="promo-video-overlay" style={{ opacity: overlayOpacity }} aria-hidden="true" />
      <PromotionPosterView poster={poster} className={`${className} promo-video-poster`.trim()} />
      {videoUrl === DEMO_BEER_VIDEO_URL && <small className="promo-video-credit">Vídeo de demonstração: Angulidayaaluta / Wikimedia Commons · CC BY-SA 4.0</small>}
    </div>
  )
}
