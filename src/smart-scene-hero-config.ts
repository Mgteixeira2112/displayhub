import type { CSSProperties } from 'react'
import './smart-scenes-hero-v2.css'
import './smart-scenes-hero-text-animations.css'

export type HeroStyle = 'explosive' | 'bands' | 'clean'
export type HeroBackgroundMode = 'none' | 'solid' | 'video'
export type HeroElementType = 'burst' | 'band' | 'circle' | 'block' | 'glow'
export type HeroTextAnimation = 'pulse' | 'slide' | 'zoom' | 'float' | 'blink'

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
  element1X: number
  element1Y: number
  element1Width: number
  element1Height: number
  element1Rotation: number
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
  productAnimationEnabled: boolean
  productAnimation: HeroTextAnimation
  priceColor: string
  priceSize: number
  priceRotation: number
  priceX: number
  priceY: number
  priceAnimationEnabled: boolean
  priceAnimation: HeroTextAnimation
  unitColor: string
  unitSize: number
  unitRotation: number
  unitX: number
  unitY: number
  unitAnimationEnabled: boolean
  unitAnimation: HeroTextAnimation
  complementColor: string
  complementSize: number
  complementRotation: number
  complementX: number
  complementY: number
  complementAnimationEnabled: boolean
  complementAnimation: HeroTextAnimation
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
  element1X: 2,
  element1Y: 14,
  element1Width: 62,
  element1Height: 72,
  element1Rotation: 0,
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
  productAnimationEnabled: false,
  productAnimation: 'pulse',
  priceColor: '#111111',
  priceSize: 100,
  priceRotation: -3,
  priceX: 0,
  priceY: 0,
  priceAnimationEnabled: false,
  priceAnimation: 'pulse',
  unitColor: '#111111',
  unitSize: 100,
  unitRotation: 0,
  unitX: 0,
  unitY: 0,
  unitAnimationEnabled: false,
  unitAnimation: 'float',
  complementColor: '#1d1d1d',
  complementSize: 100,
  complementRotation: 0,
  complementX: 0,
  complementY: 0,
  complementAnimationEnabled: false,
  complementAnimation: 'float',
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

function textAnimationValue(value: unknown, fallback: HeroTextAnimation): HeroTextAnimation {
  return value === 'pulse' || value === 'slide' || value === 'zoom' || value === 'float' || value === 'blink' ? value : fallback
}

function canvasCoordinate(value: number, legacyBase: number) {
  return Math.min(100, Math.max(0, legacyBase + value * 2.3))
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
    element1X: numberValue(hero.element1X, defaults.element1X, -60, 100),
    element1Y: numberValue(hero.element1Y, defaults.element1Y, -60, 100),
    element1Width: numberValue(hero.element1Width, defaults.element1Width, 8, 140),
    element1Height: numberValue(hero.element1Height, defaults.element1Height, 8, 140),
    element1Rotation: numberValue(hero.element1Rotation, defaults.element1Rotation, -180, 180),
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
    productAnimationEnabled: booleanValue(hero.productAnimationEnabled, defaults.productAnimationEnabled),
    productAnimation: textAnimationValue(hero.productAnimation, defaults.productAnimation),
    priceColor: stringValue(hero.priceColor, defaults.priceColor),
    priceSize: numberValue(hero.priceSize, defaults.priceSize, 60, 160),
    priceRotation: numberValue(hero.priceRotation, defaults.priceRotation, -15, 15),
    priceX: numberValue(hero.priceX, defaults.priceX, -40, 40),
    priceY: numberValue(hero.priceY, defaults.priceY, -40, 40),
    priceAnimationEnabled: booleanValue(hero.priceAnimationEnabled, defaults.priceAnimationEnabled),
    priceAnimation: textAnimationValue(hero.priceAnimation, defaults.priceAnimation),
    unitColor: stringValue(hero.unitColor, hero.priceColor ? stringValue(hero.priceColor, defaults.priceColor) : defaults.unitColor),
    unitSize: numberValue(hero.unitSize, defaults.unitSize, 60, 160),
    unitRotation: numberValue(hero.unitRotation, defaults.unitRotation, -15, 15),
    unitX: numberValue(hero.unitX, defaults.unitX, -40, 40),
    unitY: numberValue(hero.unitY, defaults.unitY, -40, 40),
    unitAnimationEnabled: booleanValue(hero.unitAnimationEnabled, defaults.unitAnimationEnabled),
    unitAnimation: textAnimationValue(hero.unitAnimation, defaults.unitAnimation),
    complementColor: stringValue(hero.complementColor, defaults.complementColor),
    complementSize: numberValue(hero.complementSize, defaults.complementSize, 60, 160),
    complementRotation: numberValue(hero.complementRotation, defaults.complementRotation, -15, 15),
    complementX: numberValue(hero.complementX, defaults.complementX, -40, 40),
    complementY: numberValue(hero.complementY, defaults.complementY, -40, 40),
    complementAnimationEnabled: booleanValue(hero.complementAnimationEnabled, defaults.complementAnimationEnabled),
    complementAnimation: textAnimationValue(hero.complementAnimation, defaults.complementAnimation),
  }
}

export function heroStyleVars(config: HeroConfig, productText = ''): CSSProperties {
  const lengthFit = productText.length > 24 ? .66 : productText.length > 18 ? .74 : productText.length > 13 ? .84 : productText.length > 9 ? .92 : 1
  return {
    '--hero-background-color': config.backgroundColor,
    '--hero-style-color-1': config.element1Color,
    '--hero-style-color-2': config.element2Color,
    '--hero-style-color-3': config.element3Color,
    '--hero-element-1-x': `${config.element1X}%`,
    '--hero-element-1-y': `${config.element1Y}%`,
    '--hero-element-1-width': `${config.element1Width}%`,
    '--hero-element-1-height': `${config.element1Height}%`,
    '--hero-element-1-rotation': `${config.element1Rotation}deg`,
    '--hero-product-color': config.productColor,
    '--hero-product-scale': String((config.productSize / 100) * lengthFit),
    '--hero-product-rotation': `${config.productRotation}deg`,
    '--hero-product-x': `${canvasCoordinate(config.productX, 7)}%`,
    '--hero-product-y': `${canvasCoordinate(config.productY, 18)}%`,
    '--hero-price-color': config.priceColor,
    '--hero-price-scale': String(config.priceSize / 100),
    '--hero-price-rotation': `${config.priceRotation}deg`,
    '--hero-price-x': `${canvasCoordinate(config.priceX, 7)}%`,
    '--hero-price-y': `${canvasCoordinate(config.priceY, 51)}%`,
    '--hero-unit-color': config.unitColor,
    '--hero-unit-scale': String(config.unitSize / 100),
    '--hero-unit-rotation': `${config.unitRotation}deg`,
    '--hero-unit-x': `${canvasCoordinate(config.unitX, 42)}%`,
    '--hero-unit-y': `${canvasCoordinate(config.unitY, 60)}%`,
    '--hero-complement-color': config.complementColor,
    '--hero-complement-scale': String(config.complementSize / 100),
    '--hero-complement-rotation': `${config.complementRotation}deg`,
    '--hero-complement-x': `${canvasCoordinate(config.complementX, 7)}%`,
    '--hero-complement-y': `${canvasCoordinate(config.complementY, 78)}%`,
  } as CSSProperties
}
