import type { CSSProperties } from 'react'
import './smart-scenes-hero-v2.css'

export type HeroStyle = 'explosive' | 'bands' | 'clean'
export type HeroBackgroundMode = 'none' | 'solid' | 'video'
export type HeroElementType = 'burst' | 'band' | 'circle' | 'block' | 'glow'

export type HeroConfig = {
  style: HeroStyle
  backgroundMode: HeroBackgroundMode
  backgroundColor: string
  backgroundVideoUrl: string
  styleColor1: string
  styleColor2: string
  styleColor3: string
  element1Enabled: boolean
  element1Type: HeroElementType
  element1Color: string
  element2Enabled: boolean
  element2Type: HeroElementType
  element2Color: string
  element3Enabled: boolean
  element3Type: HeroElementType
  element3Color: string
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
  element1Enabled: true,
  element1Type: 'burst',
  element1Color: '#d80d0d',
  element2Enabled: true,
  element2Type: 'band',
  element2Color: '#ff7a00',
  element3Enabled: true,
  element3Type: 'glow',
  element3Color: '#ffd400',
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

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function elementTypeValue(value: unknown, fallback: HeroElementType): HeroElementType {
  return value === 'burst' || value === 'band' || value === 'circle' || value === 'block' || value === 'glow' ? value : fallback
}

export function heroStylePreset(style: HeroStyle) {
  if (style === 'bands') return ['band', 'band', 'band'] as const
  if (style === 'clean') return ['circle', 'circle', 'block'] as const
  return ['burst', 'band', 'glow'] as const
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
  const presetElements = heroStylePreset(style)
  const styleColor1 = stringValue(hero.styleColor1, defaults.styleColor1)
  const styleColor2 = stringValue(hero.styleColor2, defaults.styleColor2)
  const styleColor3 = stringValue(hero.styleColor3, defaults.styleColor3)
  return {
    style,
    backgroundMode,
    backgroundColor: stringValue(hero.backgroundColor, defaults.backgroundColor),
    backgroundVideoUrl: optionalStringValue(hero.backgroundVideoUrl, defaults.backgroundVideoUrl),
    styleColor1,
    styleColor2,
    styleColor3,
    element1Enabled: booleanValue(hero.element1Enabled, defaults.element1Enabled),
    element1Type: elementTypeValue(hero.element1Type, presetElements[0]),
    element1Color: stringValue(hero.element1Color, styleColor1),
    element2Enabled: booleanValue(hero.element2Enabled, defaults.element2Enabled),
    element2Type: elementTypeValue(hero.element2Type, presetElements[1]),
    element2Color: stringValue(hero.element2Color, styleColor2),
    element3Enabled: booleanValue(hero.element3Enabled, defaults.element3Enabled),
    element3Type: elementTypeValue(hero.element3Type, presetElements[2]),
    element3Color: stringValue(hero.element3Color, styleColor3),
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
    '--hero-style-color-1': config.element1Color,
    '--hero-style-color-2': config.element2Color,
    '--hero-style-color-3': config.element3Color,
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
