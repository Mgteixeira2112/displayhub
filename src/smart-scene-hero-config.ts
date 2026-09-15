import type { CSSProperties } from 'react'
import './smart-scenes-hero-v2.css'
import './smart-scenes-hero-text-animations.css'

export type HeroStyle = 'explosive' | 'bands' | 'clean'
export type HeroBackgroundMode = 'none' | 'solid' | 'video'
export type HeroElementType = 'burst' | 'band' | 'circle' | 'block' | 'glow'
export type HeroTextAnimation = 'pulse' | 'slide' | 'zoom' | 'float' | 'blink' | 'neon' | 'glitch' | 'wave' | 'typewriter' | 'split' | 'shadow'
export type HeroTextAlign = 'left' | 'center' | 'right'
export type HeroFontStyle = 'normal' | 'bold' | 'italic' | 'bold italic'
export type HeroTextCoordinateMode = 'canvas-v1'

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
  coordinateMode: HeroTextCoordinateMode
  productColor: string
  productFontFamily: string
  productFontStyle: HeroFontStyle
  productAlign: HeroTextAlign
  productStrokeColor: string
  productStrokeWidth: number
  productShadowEnabled: boolean
  productShadowColor: string
  productShadowBlur: number
  productShadowOffset: number
  productSize: number
  productRotation: number
  productX: number
  productY: number
  productAnimationEnabled: boolean
  productAnimation: HeroTextAnimation
  priceColor: string
  priceFontFamily: string
  priceFontStyle: HeroFontStyle
  priceAlign: HeroTextAlign
  priceStrokeColor: string
  priceStrokeWidth: number
  priceShadowEnabled: boolean
  priceShadowColor: string
  priceShadowBlur: number
  priceShadowOffset: number
  priceSize: number
  priceRotation: number
  priceX: number
  priceY: number
  priceAnimationEnabled: boolean
  priceAnimation: HeroTextAnimation
  unitColor: string
  unitFontFamily: string
  unitFontStyle: HeroFontStyle
  unitAlign: HeroTextAlign
  unitStrokeColor: string
  unitStrokeWidth: number
  unitShadowEnabled: boolean
  unitShadowColor: string
  unitShadowBlur: number
  unitShadowOffset: number
  unitSize: number
  unitRotation: number
  unitX: number
  unitY: number
  unitAnimationEnabled: boolean
  unitAnimation: HeroTextAnimation
  complementColor: string
  complementFontFamily: string
  complementFontStyle: HeroFontStyle
  complementAlign: HeroTextAlign
  complementStrokeColor: string
  complementStrokeWidth: number
  complementShadowEnabled: boolean
  complementShadowColor: string
  complementShadowBlur: number
  complementShadowOffset: number
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
  coordinateMode: 'canvas-v1',
  productColor: '#d80d0d',
  productFontFamily: 'Arial Black, Arial, sans-serif',
  productFontStyle: 'bold',
  productAlign: 'left',
  productStrokeColor: '#000000',
  productStrokeWidth: 0,
  productShadowEnabled: false,
  productShadowColor: '#000000',
  productShadowBlur: 8,
  productShadowOffset: 4,
  productSize: 100,
  productRotation: 0,
  productX: 0,
  productY: 18,
  productAnimationEnabled: false,
  productAnimation: 'pulse',
  priceColor: '#111111',
  priceFontFamily: 'Arial Black, Arial, sans-serif',
  priceFontStyle: 'bold',
  priceAlign: 'left',
  priceStrokeColor: '#000000',
  priceStrokeWidth: 0,
  priceShadowEnabled: false,
  priceShadowColor: '#000000',
  priceShadowBlur: 8,
  priceShadowOffset: 4,
  priceSize: 100,
  priceRotation: -3,
  priceX: 0,
  priceY: 51,
  priceAnimationEnabled: false,
  priceAnimation: 'pulse',
  unitColor: '#111111',
  unitFontFamily: 'Arial Black, Arial, sans-serif',
  unitFontStyle: 'bold',
  unitAlign: 'left',
  unitStrokeColor: '#000000',
  unitStrokeWidth: 0,
  unitShadowEnabled: false,
  unitShadowColor: '#000000',
  unitShadowBlur: 8,
  unitShadowOffset: 4,
  unitSize: 100,
  unitRotation: 0,
  unitX: 42,
  unitY: 60,
  unitAnimationEnabled: false,
  unitAnimation: 'float',
  complementColor: '#1d1d1d',
  complementFontFamily: 'Arial, sans-serif',
  complementFontStyle: 'normal',
  complementAlign: 'left',
  complementStrokeColor: '#000000',
  complementStrokeWidth: 0,
  complementShadowEnabled: false,
  complementShadowColor: '#000000',
  complementShadowBlur: 8,
  complementShadowOffset: 4,
  complementSize: 100,
  complementRotation: 0,
  complementX: 0,
  complementY: 78,
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
  return value === 'pulse' || value === 'slide' || value === 'zoom' || value === 'float' || value === 'blink' || value === 'neon' || value === 'glitch' || value === 'wave' || value === 'typewriter' || value === 'split' || value === 'shadow' ? value : fallback
}

function textAlignValue(value: unknown, fallback: HeroTextAlign): HeroTextAlign {
  return value === 'left' || value === 'center' || value === 'right' ? value : fallback
}

function fontStyleValue(value: unknown, fallback: HeroFontStyle): HeroFontStyle {
  return value === 'normal' || value === 'bold' || value === 'italic' || value === 'bold italic' ? value : fallback
}

function clampCanvas(value: number) {
  return Math.min(100, Math.max(0, value))
}

function legacyCanvasCoordinate(value: unknown, legacyBase: number, leftInset = 0) {
  const legacyValue = numberValue(value, 0, -40, 40)
  return clampCanvas(legacyBase + legacyValue * 2.3 - leftInset)
}

function textCanvasCoordinate(hero: Record<string, unknown>, key: string, fallback: number, legacyBase: number, leftInset = 0) {
  if (hero.coordinateMode === 'canvas-v1') return numberValue(hero[key], fallback, 0, 100)
  return legacyCanvasCoordinate(hero[key], legacyBase, leftInset)
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
    coordinateMode: 'canvas-v1',
    productColor: stringValue(hero.productColor, defaults.productColor),
    productFontFamily: stringValue(hero.productFontFamily, defaults.productFontFamily),
    productFontStyle: fontStyleValue(hero.productFontStyle, defaults.productFontStyle),
    productAlign: textAlignValue(hero.productAlign, defaults.productAlign),
    productStrokeColor: stringValue(hero.productStrokeColor, defaults.productStrokeColor),
    productStrokeWidth: numberValue(hero.productStrokeWidth, defaults.productStrokeWidth, 0, 12),
    productShadowEnabled: booleanValue(hero.productShadowEnabled, defaults.productShadowEnabled),
    productShadowColor: stringValue(hero.productShadowColor, defaults.productShadowColor),
    productShadowBlur: numberValue(hero.productShadowBlur, defaults.productShadowBlur, 0, 40),
    productShadowOffset: numberValue(hero.productShadowOffset, defaults.productShadowOffset, 0, 20),
    productSize: numberValue(hero.productSize, defaults.productSize, 40, 240),
    productRotation: numberValue(hero.productRotation, defaults.productRotation, -15, 15),
    productX: textCanvasCoordinate(hero, 'productX', defaults.productX, 7, 7),
    productY: textCanvasCoordinate(hero, 'productY', defaults.productY, 18),
    productAnimationEnabled: booleanValue(hero.productAnimationEnabled, defaults.productAnimationEnabled),
    productAnimation: textAnimationValue(hero.productAnimation, defaults.productAnimation),
    priceColor: stringValue(hero.priceColor, defaults.priceColor),
    priceFontFamily: stringValue(hero.priceFontFamily, defaults.priceFontFamily),
    priceFontStyle: fontStyleValue(hero.priceFontStyle, defaults.priceFontStyle),
    priceAlign: textAlignValue(hero.priceAlign, defaults.priceAlign),
    priceStrokeColor: stringValue(hero.priceStrokeColor, defaults.priceStrokeColor),
    priceStrokeWidth: numberValue(hero.priceStrokeWidth, defaults.priceStrokeWidth, 0, 12),
    priceShadowEnabled: booleanValue(hero.priceShadowEnabled, defaults.priceShadowEnabled),
    priceShadowColor: stringValue(hero.priceShadowColor, defaults.priceShadowColor),
    priceShadowBlur: numberValue(hero.priceShadowBlur, defaults.priceShadowBlur, 0, 40),
    priceShadowOffset: numberValue(hero.priceShadowOffset, defaults.priceShadowOffset, 0, 20),
    priceSize: numberValue(hero.priceSize, defaults.priceSize, 40, 240),
    priceRotation: numberValue(hero.priceRotation, defaults.priceRotation, -15, 15),
    priceX: textCanvasCoordinate(hero, 'priceX', defaults.priceX, 7, 7),
    priceY: textCanvasCoordinate(hero, 'priceY', defaults.priceY, 51),
    priceAnimationEnabled: booleanValue(hero.priceAnimationEnabled, defaults.priceAnimationEnabled),
    priceAnimation: textAnimationValue(hero.priceAnimation, defaults.priceAnimation),
    unitColor: stringValue(hero.unitColor, hero.priceColor ? stringValue(hero.priceColor, defaults.priceColor) : defaults.unitColor),
    unitFontFamily: stringValue(hero.unitFontFamily, defaults.unitFontFamily),
    unitFontStyle: fontStyleValue(hero.unitFontStyle, defaults.unitFontStyle),
    unitAlign: textAlignValue(hero.unitAlign, defaults.unitAlign),
    unitStrokeColor: stringValue(hero.unitStrokeColor, defaults.unitStrokeColor),
    unitStrokeWidth: numberValue(hero.unitStrokeWidth, defaults.unitStrokeWidth, 0, 12),
    unitShadowEnabled: booleanValue(hero.unitShadowEnabled, defaults.unitShadowEnabled),
    unitShadowColor: stringValue(hero.unitShadowColor, defaults.unitShadowColor),
    unitShadowBlur: numberValue(hero.unitShadowBlur, defaults.unitShadowBlur, 0, 40),
    unitShadowOffset: numberValue(hero.unitShadowOffset, defaults.unitShadowOffset, 0, 20),
    unitSize: numberValue(hero.unitSize, defaults.unitSize, 40, 240),
    unitRotation: numberValue(hero.unitRotation, defaults.unitRotation, -15, 15),
    unitX: textCanvasCoordinate(hero, 'unitX', defaults.unitX, 42),
    unitY: textCanvasCoordinate(hero, 'unitY', defaults.unitY, 60),
    unitAnimationEnabled: booleanValue(hero.unitAnimationEnabled, defaults.unitAnimationEnabled),
    unitAnimation: textAnimationValue(hero.unitAnimation, defaults.unitAnimation),
    complementColor: stringValue(hero.complementColor, defaults.complementColor),
    complementFontFamily: stringValue(hero.complementFontFamily, defaults.complementFontFamily),
    complementFontStyle: fontStyleValue(hero.complementFontStyle, defaults.complementFontStyle),
    complementAlign: textAlignValue(hero.complementAlign, defaults.complementAlign),
    complementStrokeColor: stringValue(hero.complementStrokeColor, defaults.complementStrokeColor),
    complementStrokeWidth: numberValue(hero.complementStrokeWidth, defaults.complementStrokeWidth, 0, 12),
    complementShadowEnabled: booleanValue(hero.complementShadowEnabled, defaults.complementShadowEnabled),
    complementShadowColor: stringValue(hero.complementShadowColor, defaults.complementShadowColor),
    complementShadowBlur: numberValue(hero.complementShadowBlur, defaults.complementShadowBlur, 0, 40),
    complementShadowOffset: numberValue(hero.complementShadowOffset, defaults.complementShadowOffset, 0, 20),
    complementSize: numberValue(hero.complementSize, defaults.complementSize, 40, 240),
    complementRotation: numberValue(hero.complementRotation, defaults.complementRotation, -15, 15),
    complementX: textCanvasCoordinate(hero, 'complementX', defaults.complementX, 7, 7),
    complementY: textCanvasCoordinate(hero, 'complementY', defaults.complementY, 78),
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
    '--hero-product-x': `${config.productX}%`,
    '--hero-product-y': `${config.productY}%`,
    '--hero-price-color': config.priceColor,
    '--hero-price-scale': String(config.priceSize / 100),
    '--hero-price-rotation': `${config.priceRotation}deg`,
    '--hero-price-x': `${config.priceX}%`,
    '--hero-price-y': `${config.priceY}%`,
    '--hero-unit-color': config.unitColor,
    '--hero-unit-scale': String(config.unitSize / 100),
    '--hero-unit-rotation': `${config.unitRotation}deg`,
    '--hero-unit-x': `${config.unitX}%`,
    '--hero-unit-y': `${config.unitY}%`,
    '--hero-complement-color': config.complementColor,
    '--hero-complement-scale': String(config.complementSize / 100),
    '--hero-complement-rotation': `${config.complementRotation}deg`,
    '--hero-complement-x': `${config.complementX}%`,
    '--hero-complement-y': `${config.complementY}%`,
  } as CSSProperties
}
