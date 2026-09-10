type Orientation = 'portrait' | 'landscape'

const animatedThemes = new Set([
  'animated_hot',
  'animated_burst',
  'animated_bands',
  'animated_pulse',
  'animated_neon',
])

export function isAnimatedPosterTheme(theme: string) {
  return animatedThemes.has(theme)
}

export default function PromotionPosterBackdrop({ theme, orientation }: { theme: string; orientation: Orientation }) {
  if (!isAnimatedPosterTheme(theme)) return null

  return (
    <div
      className={`promo-poster-backdrop promo-${orientation} promo-theme-${theme}`}
      aria-hidden="true"
    >
      <div className="promo-poster-shape" />
    </div>
  )
}
