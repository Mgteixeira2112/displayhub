import type { CSSProperties } from 'react'
import './smart-scenes-hero-v2.css'

export type HeroPreset = 'tabloid' | 'explosive' | 'clean'

export type HeroConfig = {
  preset: HeroPreset
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
  badgeColor: string
  badgeBackground: string
  badgeSize: number
  badgeRotation: number
  badgeX: number
  badgeY: number
}

const defaults: HeroConfig = {
  preset: 'tabloid',
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
  badgeColor: '#ffffff',
  badgeBackground: '#d80d0d',
  badgeSize: 100,
  badgeRotation: 0,
  badgeX: 0,
  badgeY: 0,
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
  const preset = hero.preset === 'explosive' || hero.preset === 'clean' ? hero.preset : 'tabloid'
  return {
    preset,
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
    badgeColor: stringValue(hero.badgeColor, defaults.badgeColor),
    badgeBackground: stringValue(hero.badgeBackground, defaults.badgeBackground),
    badgeSize: numberValue(hero.badgeSize, defaults.badgeSize, 70, 140),
    badgeRotation: numberValue(hero.badgeRotation, defaults.badgeRotation, -15, 15),
    badgeX: numberValue(hero.badgeX, defaults.badgeX, -40, 40),
    badgeY: numberValue(hero.badgeY, defaults.badgeY, -40, 40),
  }
}

export function heroStyleVars(config: HeroConfig, productText = ''): CSSProperties {
  const lengthFit = productText.length > 24 ? .66 : productText.length > 18 ? .74 : productText.length > 13 ? .84 : productText.length > 9 ? .92 : 1
  return {
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
    '--hero-badge-color': config.badgeColor,
    '--hero-badge-background': config.badgeBackground,
    '--hero-badge-scale': String(config.badgeSize / 100),
    '--hero-badge-rotation': `${config.badgeRotation}deg`,
    '--hero-badge-x': `${config.badgeX}%`,
    '--hero-badge-y': `${config.badgeY}%`,
  } as CSSProperties
}
