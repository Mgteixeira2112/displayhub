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

export default function PromotionVideoPoster({ poster, className = '' }: { poster: PromotionPosterData; className?: string }) {
  const metadata = readPromotionVideoMetadata(poster.layout_positions)
  const videoUrl = metadata.background_video_url
  const overlayOpacity = metadata.background_overlay_opacity ?? 0.38

  if (poster.theme !== 'animated_beer_video' || !videoUrl) {
    return <PromotionPosterView poster={poster} className={className} />
  }

  return (
    <div className="promo-video-stage">
      <video className="promo-video-background" src={videoUrl} autoPlay muted loop playsInline preload="auto" aria-hidden="true" />
      <div className="promo-video-overlay" style={{ opacity: overlayOpacity }} aria-hidden="true" />
      <PromotionPosterView poster={poster} className={`${className} promo-video-poster`.trim()} />
      {videoUrl === DEMO_BEER_VIDEO_URL && <small className="promo-video-credit">Vídeo de demonstração: Angulidayaaluta / Wikimedia Commons · CC BY-SA 4.0</small>}
    </div>
  )
}
