import type { CSSProperties } from 'react'

type Orientation = 'portrait' | 'landscape'
type ElementKey = 'headline' | 'product' | 'price' | 'unit' | 'footer'
type TextAlign = 'left' | 'center' | 'right'
type ElementLayout = { x?: number; y?: number; width?: number; height?: number; align?: TextAlign; color?: string; fontSize?: number; fontScale?: number; rotation?: number }
type OrientationLayout = Partial<Record<ElementKey, ElementLayout>>
type LayoutPositions = Partial<Record<Orientation, OrientationLayout>>

export type PromotionPosterData = {
  id: string
  template_key: string
  theme: string
  product_name: string
  price: number
  unit: string | null
  headline: string
  footer: string | null
  orientation: Orientation
  layout_positions: LayoutPositions
}

const designFontSizes: Record<Orientation, Record<ElementKey, number>> = {
  portrait: { headline: 64, product: 104, price: 190, unit: 42, footer: 36 },
  landscape: { headline: 64, product: 110, price: 200, unit: 42, footer: 36 },
}

const designWidths: Record<Orientation, number> = {
  portrait: 1080,
  landscape: 1920,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function manualFontSize(key: ElementKey, orientation: Orientation, item: ElementLayout) {
  const direct = typeof item.fontSize === 'number' ? item.fontSize : null
  const legacy = direct == null && typeof item.fontScale === 'number' ? designFontSizes[orientation][key] * item.fontScale / 100 : null
  const fontSize = direct ?? legacy
  if (fontSize == null) return undefined
  const logicalPx = clamp(fontSize, 8, 400)
  return `${((logicalPx / designWidths[orientation]) * 100).toFixed(4)}cqw`
}

function moneyLabel(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

export default function PromotionPosterView({ poster, className = '' }: { poster: PromotionPosterData; className?: string }) {
  const orientation = poster.orientation || 'portrait'
  const layout = poster.layout_positions?.[orientation] || {}

  const renderElement = (key: ElementKey, baseClass: string, tag: 'span' | 'strong' | 'div' | 'em', text: string) => {
    const item = layout[key] || {}
    const hasPosition = typeof item.x === 'number' && typeof item.y === 'number'
    const hasRotation = typeof item.rotation === 'number' && item.rotation !== 0
    const classes = `${baseClass} promo-element${hasPosition ? ' promo-custom-position' : ''}${hasRotation ? ' promo-has-rotation' : ''}`
    const style: CSSProperties & Record<string, string | number | undefined> = {}
    if (hasPosition) { style.left = `${item.x}%`; style.top = `${item.y}%` }
    if (typeof item.width === 'number') { style.width = `${item.width}%`; style.maxWidth = `${item.width}%` }
    if (typeof item.height === 'number') { style.height = `${item.height}%`; style.maxHeight = `${item.height}%`; style.overflow = 'hidden' }
    const manualSize = manualFontSize(key, orientation, item)
    if (manualSize) style.fontSize = manualSize
    if (item.align) style.textAlign = item.align
    if (item.color) style.color = item.color
    if (hasRotation) style['--promo-rotation'] = `${item.rotation}deg`
    const props = { className: classes, style: Object.keys(style).length ? style : undefined }
    if (tag === 'strong') return <strong {...props}>{text}</strong>
    if (tag === 'div') return <div {...props}>{text}</div>
    if (tag === 'em') return <em {...props}>{text}</em>
    return <span {...props}>{text}</span>
  }

  return <div className={`promo-poster promo-${orientation} promo-theme-${poster.theme || 'hot_red'} ${className}`.trim()}>
    <div className="promo-poster-shape" aria-hidden="true" />
    <div className="promo-poster-content">
      {renderElement('headline', 'promo-headline', 'span', poster.headline)}
      {renderElement('product', 'promo-product', 'strong', poster.product_name)}
      {renderElement('price', 'promo-price', 'div', moneyLabel(poster.price))}
      {poster.unit && renderElement('unit', 'promo-unit', 'span', poster.unit)}
      {poster.footer && renderElement('footer', 'promo-footer', 'em', poster.footer)}
    </div>
  </div>
}
