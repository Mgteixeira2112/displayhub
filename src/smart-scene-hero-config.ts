import type { CSSProperties } from 'react'
import './smart-scenes-hero-v2.css'

export type HeroStyle = 'explosive' | 'bands' | 'clean'
export type HeroBackgroundMode = 'none' | 'solid' | 'video'

export type HeroConfig = {
  style: HeroStyle
  backgroundMode: HeroBackgroundMode
  backgroundColor: string
  backgroundVideoUrl: string
  styleColor1: string
  styleColor2: string
  styleColor3: string
  price: string
  unit: string
  productColor: string
  productSize: number
  productRotation: number
  productX: number
  productY: number
  priceColor: string
  priceSize: number
  priceRotation: number
  priceX: number
  priceY: number
}

const defaults: HeroConfig = {
  style: 'explosive',
  backgroundMode: 'solid',
  backgroundColor: '#ffd400',
  backgroundVideoUrl: '',
  styleColor1: '#d80d0d',
  styleColor2: '#ff7a00',
  styleColor3: '#ffd400',
  price: 'R$ 24,90',
  unit: 'UN',
  productColor: '#d80d0d',
  productSize: 100,
  productRotation: 0,
  productX: 0,
  productY: 0,
  priceColor: '#111111',
  priceSize: 100,
  priceRotation: -3,
  priceX: 0,
  priceY: 0,
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function optionalStringValue(value: unknown, fallback: string) {
  return typeof value === 'string' ? value.trim() : fallback
}

export function getHeroConfig(config?: Record<string, unknown>): HeroConfig {
  const raw = config?.hero
  const hero = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  const legacyPreset = hero.preset
  const style: HeroStyle = hero.style === 'bands' || hero.style === 'clean' || hero.style === 'explosive'
    ? hero.style
    : legacyPreset === 'clean'
      ? 'clean'
      : legacyPreset === 'tabloid'
        ? 'bands'
        : 'explosive'
  const backgroundMode: HeroBackgroundMode = hero.backgroundMode === 'none' || hero.backgroundMode === 'video' ? hero.backgroundMode : 'solid'
  return {
    style,
    backgroundMode,
    backgroundColor: stringValue(hero.backgroundColor, defaults.backgroundColor),
    backgroundVideoUrl: optionalStringValue(hero.backgroundVideoUrl, defaults.backgroundVideoUrl),
    styleColor1: stringValue(hero.styleColor1, defaults.styleColor1),
    styleColor2: stringValue(hero.styleColor2, defaults.styleColor2),
    styleColor3: stringValue(hero.styleColor3, defaults.styleColor3),
    price: optionalStringValue(hero.price, defaults.price),
    unit: optionalStringValue(hero.unit, defaults.unit),
    productColor: stringValue(hero.productColor, defaults.productColor),
    productSize: numberValue(hero.productSize, defaults.productSize, 60, 150),
    productRotation: numberValue(hero.productRotation, defaults.productRotation, -15, 15),
    productX: numberValue(hero.productX, defaults.productX, -40, 40),
    productY: numberValue(hero.productY, defaults.productY, -40, 40),
    priceColor: stringValue(hero.priceColor, defaults.priceColor),
    priceSize: numberValue(hero.priceSize, defaults.priceSize, 60, 160),
    priceRotation: numberValue(hero.priceRotation, defaults.priceRotation, -15, 15),
    priceX: numberValue(hero.priceX, defaults.priceX, -40, 40),
    priceY: numberValue(hero.priceY, defaults.priceY, -40, 40),
  }
}

export function heroStyleVars(config: HeroConfig, productText = ''): CSSProperties {
  const lengthFit = productText.length > 24 ? .66 : productText.length > 18 ? .74 : productText.length > 13 ? .84 : productText.length > 9 ? .92 : 1
  return {
    '--hero-background-color': config.backgroundColor,
    '--hero-style-color-1': config.styleColor1,
    '--hero-style-color-2': config.styleColor2,
    '--hero-style-color-3': config.styleColor3,
    '--hero-product-color': config.productColor,
    '--hero-product-scale': String((config.productSize / 100) * lengthFit),
    '--hero-product-rotation': `${config.productRotation}deg`,
    '--hero-product-x': `${config.productX}%`,
    '--hero-product-y': `${config.productY}%`,
    '--hero-price-color': config.priceColor,
    '--hero-price-scale': String(config.priceSize / 100),
    '--hero-price-rotation': `${config.priceRotation}deg`,
    '--hero-price-x': `${config.priceX}%`,
    '--hero-price-y': `${config.priceY}%`,
  } as CSSProperties
}
