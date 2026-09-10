type Orientation = 'portrait' | 'landscape'

export default function PromotionPosterBackdrop({ theme, orientation }: { theme: string; orientation: Orientation }) {
  return (
    <div
      className={`promo-poster-backdrop promo-${orientation} promo-theme-${theme || 'hot_red'}`}
      aria-hidden="true"
    >
      <div className="promo-poster-shape" />
    </div>
  )
}
