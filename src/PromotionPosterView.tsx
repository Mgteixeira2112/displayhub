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

const previewWidths: Record<Orientation, number> = {
  portrait: 430,
  landscape: 720,
}

const fontRules: Record<Orientation, Record<ElementKey, { min: number; fluid: number; max: number }>> = {
  portrait: {
    headline: { min: 1.05, fluid: 3, max: 2 },
    product: { min: 1.3, fluid: 4.6, max: 3.5 },
    price: { min: 2.8, fluid: 10, max: 7.3 },
    unit: { min: 0.8, fluid: 2, max: 1.25 },
    footer: { min: 0.75, fluid: 1.8, max: 1.2 },
  },
  landscape: {
    headline: { min: 1.05, fluid: 3, max: 2 },
    product: { min: 1.7, fluid: 4.2, max: 4.5 },
    price: { min: 3.6, fluid: 9, max: 8.5 },
    unit: { min: 0.8, fluid: 2, max: 1.25 },
    footer: { min: 0.75, fluid: 1.8, max: 1.2 },
  },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function manualFontSize(key: ElementKey, orientation: Orientation, item: ElementLayout) {
  const direct = typeof item.fontSize === 'number' ? item.fontSize : null
  const legacy = direct == null && typeof item.fontScale === 'number' ? designFontSizes[orientation][key] * item.fontScale / 100 : null
  const fontSize = direct ?? legacy
  if (fontSize == null) return undefined

  const rule = fontRules[orientation][key]
  const basePreviewPx = clamp(
    previewWidths[orientation] * rule.fluid / 100,
    rule.min * 16,
    rule.max * 16,
  )
  const scale = clamp(fontSize, 8, 400) / designFontSizes[orientation][key]
  const previewPx = basePreviewPx * scale
  return `${((previewPx / previewWidths[orientation]) * 100).toFixed(4)}cqw`
}

function moneyLabel(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

export default function PromotionPosterView({ poster, className = '' }: { poster: PromotionPosterData; className?: string }) {
  const orientation = poster.orientation || 'portrait'
  const layout = poster.layout_positions?.[orientation] || {}
  const theme = poster.theme || 'hot_red'
  const renderKey = `${poster.id}:${theme}:${orientation}`

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

  return (
    <div key={renderKey} className={`promo-poster promo-editable promo-${orientation} promo-theme-${theme} ${className}`.trim()} data-poster-theme={theme}>
      <div className="promo-poster-shape" aria-hidden="true" />
      <div className="promo-poster-content">
        {renderElement('headline', 'promo-headline', 'span', poster.headline)}
        {renderElement('product', 'promo-product', 'strong', poster.product_name)}
        {renderElement('price', 'promo-price', 'div', moneyLabel(poster.price))}
        {poster.unit && renderElement('unit', 'promo-unit', 'span', poster.unit)}
        {poster.footer && renderElement('footer', 'promo-footer', 'em', poster.footer)}
      </div>
    </div>
  )
}
