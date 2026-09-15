from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label} not found')
    return text.replace(old, new, 1)

config = Path('src/smart-scene-hero-config.ts')
s = config.read_text()
s = replace_once(s,
"export type HeroTextAnimation = 'pulse' | 'slide' | 'zoom' | 'float' | 'blink' | 'neon' | 'glitch' | 'wave' | 'typewriter' | 'split' | 'shadow'\nexport type HeroTextCoordinateMode = 'canvas-v1'",
"export type HeroTextAnimation = 'pulse' | 'slide' | 'zoom' | 'float' | 'blink' | 'neon' | 'glitch' | 'wave' | 'typewriter' | 'split' | 'shadow'\nexport type HeroTextAlign = 'left' | 'center' | 'right'\nexport type HeroFontStyle = 'normal' | 'bold' | 'italic' | 'bold italic'\nexport type HeroTextCoordinateMode = 'canvas-v1'",
'hero text types')

for prefix in ['product', 'price', 'unit', 'complement']:
    marker = f"  {prefix}Color: string\n  {prefix}Size: number"
    insert = f"  {prefix}Color: string\n  {prefix}FontFamily: string\n  {prefix}FontStyle: HeroFontStyle\n  {prefix}Align: HeroTextAlign\n  {prefix}StrokeColor: string\n  {prefix}StrokeWidth: number\n  {prefix}ShadowEnabled: boolean\n  {prefix}ShadowColor: string\n  {prefix}ShadowBlur: number\n  {prefix}ShadowOffset: number\n  {prefix}Size: number"
    s = replace_once(s, marker, insert, f'{prefix} config fields')

repls = {
"  productColor: '#d80d0d',\n  productSize: 100,": "  productColor: '#d80d0d',\n  productFontFamily: 'Arial Black, Arial, sans-serif',\n  productFontStyle: 'bold',\n  productAlign: 'left',\n  productStrokeColor: '#000000',\n  productStrokeWidth: 0,\n  productShadowEnabled: false,\n  productShadowColor: '#000000',\n  productShadowBlur: 8,\n  productShadowOffset: 4,\n  productSize: 100,",
"  priceColor: '#111111',\n  priceSize: 100,": "  priceColor: '#111111',\n  priceFontFamily: 'Arial Black, Arial, sans-serif',\n  priceFontStyle: 'bold',\n  priceAlign: 'left',\n  priceStrokeColor: '#000000',\n  priceStrokeWidth: 0,\n  priceShadowEnabled: false,\n  priceShadowColor: '#000000',\n  priceShadowBlur: 8,\n  priceShadowOffset: 4,\n  priceSize: 100,",
"  unitColor: '#111111',\n  unitSize: 100,": "  unitColor: '#111111',\n  unitFontFamily: 'Arial Black, Arial, sans-serif',\n  unitFontStyle: 'bold',\n  unitAlign: 'left',\n  unitStrokeColor: '#000000',\n  unitStrokeWidth: 0,\n  unitShadowEnabled: false,\n  unitShadowColor: '#000000',\n  unitShadowBlur: 8,\n  unitShadowOffset: 4,\n  unitSize: 100,",
"  complementColor: '#1d1d1d',\n  complementSize: 100,": "  complementColor: '#1d1d1d',\n  complementFontFamily: 'Arial, sans-serif',\n  complementFontStyle: 'normal',\n  complementAlign: 'left',\n  complementStrokeColor: '#000000',\n  complementStrokeWidth: 0,\n  complementShadowEnabled: false,\n  complementShadowColor: '#000000',\n  complementShadowBlur: 8,\n  complementShadowOffset: 4,\n  complementSize: 100,",
}
for old,new in repls.items():
    s = replace_once(s, old, new, 'defaults')

helper_marker = "function textAnimationValue(value: unknown, fallback: HeroTextAnimation): HeroTextAnimation {\n  return value === 'pulse' || value === 'slide' || value === 'zoom' || value === 'float' || value === 'blink' || value === 'neon' || value === 'glitch' || value === 'wave' || value === 'typewriter' || value === 'split' || value === 'shadow' ? value : fallback\n}\n"
helper_new = helper_marker + "\nfunction textAlignValue(value: unknown, fallback: HeroTextAlign): HeroTextAlign {\n  return value === 'left' || value === 'center' || value === 'right' ? value : fallback\n}\n\nfunction fontStyleValue(value: unknown, fallback: HeroFontStyle): HeroFontStyle {\n  return value === 'normal' || value === 'bold' || value === 'italic' || value === 'bold italic' ? value : fallback\n}\n"
s = replace_once(s, helper_marker, helper_new, 'style helpers')

parse_repls = {
"    productColor: stringValue(hero.productColor, defaults.productColor),\n    productSize:": "    productColor: stringValue(hero.productColor, defaults.productColor),\n    productFontFamily: stringValue(hero.productFontFamily, defaults.productFontFamily),\n    productFontStyle: fontStyleValue(hero.productFontStyle, defaults.productFontStyle),\n    productAlign: textAlignValue(hero.productAlign, defaults.productAlign),\n    productStrokeColor: stringValue(hero.productStrokeColor, defaults.productStrokeColor),\n    productStrokeWidth: numberValue(hero.productStrokeWidth, defaults.productStrokeWidth, 0, 12),\n    productShadowEnabled: booleanValue(hero.productShadowEnabled, defaults.productShadowEnabled),\n    productShadowColor: stringValue(hero.productShadowColor, defaults.productShadowColor),\n    productShadowBlur: numberValue(hero.productShadowBlur, defaults.productShadowBlur, 0, 40),\n    productShadowOffset: numberValue(hero.productShadowOffset, defaults.productShadowOffset, 0, 20),\n    productSize:",
"    priceColor: stringValue(hero.priceColor, defaults.priceColor),\n    priceSize:": "    priceColor: stringValue(hero.priceColor, defaults.priceColor),\n    priceFontFamily: stringValue(hero.priceFontFamily, defaults.priceFontFamily),\n    priceFontStyle: fontStyleValue(hero.priceFontStyle, defaults.priceFontStyle),\n    priceAlign: textAlignValue(hero.priceAlign, defaults.priceAlign),\n    priceStrokeColor: stringValue(hero.priceStrokeColor, defaults.priceStrokeColor),\n    priceStrokeWidth: numberValue(hero.priceStrokeWidth, defaults.priceStrokeWidth, 0, 12),\n    priceShadowEnabled: booleanValue(hero.priceShadowEnabled, defaults.priceShadowEnabled),\n    priceShadowColor: stringValue(hero.priceShadowColor, defaults.priceShadowColor),\n    priceShadowBlur: numberValue(hero.priceShadowBlur, defaults.priceShadowBlur, 0, 40),\n    priceShadowOffset: numberValue(hero.priceShadowOffset, defaults.priceShadowOffset, 0, 20),\n    priceSize:",
"    unitColor: stringValue(hero.unitColor, hero.priceColor ? stringValue(hero.priceColor, defaults.priceColor) : defaults.unitColor),\n    unitSize:": "    unitColor: stringValue(hero.unitColor, hero.priceColor ? stringValue(hero.priceColor, defaults.priceColor) : defaults.unitColor),\n    unitFontFamily: stringValue(hero.unitFontFamily, defaults.unitFontFamily),\n    unitFontStyle: fontStyleValue(hero.unitFontStyle, defaults.unitFontStyle),\n    unitAlign: textAlignValue(hero.unitAlign, defaults.unitAlign),\n    unitStrokeColor: stringValue(hero.unitStrokeColor, defaults.unitStrokeColor),\n    unitStrokeWidth: numberValue(hero.unitStrokeWidth, defaults.unitStrokeWidth, 0, 12),\n    unitShadowEnabled: booleanValue(hero.unitShadowEnabled, defaults.unitShadowEnabled),\n    unitShadowColor: stringValue(hero.unitShadowColor, defaults.unitShadowColor),\n    unitShadowBlur: numberValue(hero.unitShadowBlur, defaults.unitShadowBlur, 0, 40),\n    unitShadowOffset: numberValue(hero.unitShadowOffset, defaults.unitShadowOffset, 0, 20),\n    unitSize:",
"    complementColor: stringValue(hero.complementColor, defaults.complementColor),\n    complementSize:": "    complementColor: stringValue(hero.complementColor, defaults.complementColor),\n    complementFontFamily: stringValue(hero.complementFontFamily, defaults.complementFontFamily),\n    complementFontStyle: fontStyleValue(hero.complementFontStyle, defaults.complementFontStyle),\n    complementAlign: textAlignValue(hero.complementAlign, defaults.complementAlign),\n    complementStrokeColor: stringValue(hero.complementStrokeColor, defaults.complementStrokeColor),\n    complementStrokeWidth: numberValue(hero.complementStrokeWidth, defaults.complementStrokeWidth, 0, 12),\n    complementShadowEnabled: booleanValue(hero.complementShadowEnabled, defaults.complementShadowEnabled),\n    complementShadowColor: stringValue(hero.complementShadowColor, defaults.complementShadowColor),\n    complementShadowBlur: numberValue(hero.complementShadowBlur, defaults.complementShadowBlur, 0, 40),\n    complementShadowOffset: numberValue(hero.complementShadowOffset, defaults.complementShadowOffset, 0, 20),\n    complementSize:",
}
for old,new in parse_repls.items():
    s = replace_once(s, old, new, 'parse fields')
config.write_text(s)

canvas = Path('src/HeroCanvas.tsx')
s = canvas.read_text()
s = replace_once(s,
"import type { HeroConfig, HeroElementType, HeroTextAnimation } from './smart-scene-hero-config'",
"import type { HeroConfig, HeroElementType, HeroFontStyle, HeroTextAlign, HeroTextAnimation } from './smart-scene-hero-config'",
'canvas imports')
s = replace_once(s,
"  fontFamily: string\n  fontStyle?: string\n  opacity?: number",
"  fontFamily: string\n  fontStyle: HeroFontStyle\n  align: HeroTextAlign\n  strokeColor: string\n  strokeWidth: number\n  shadowEnabled: boolean\n  shadowColor: string\n  shadowBlur: number\n  shadowOffset: number\n  opacity?: number",
'canvas props type')
s = replace_once(s,
"    const originalText = textNode?.text() || ''\n\n    const reset = () => {",
"    const originalText = textNode?.text() || ''\n    const baseShadow = textNode ? {\n      color: textNode.shadowColor(),\n      blur: textNode.shadowBlur(),\n      opacity: textNode.shadowOpacity(),\n      offset: textNode.shadowOffset(),\n      enabled: textNode.shadowEnabled(),\n    } : null\n\n    const reset = () => {",
'canvas base shadow')
s = replace_once(s,
"        textNode.shadowBlur(0)\n        textNode.shadowOpacity(0)\n        textNode.shadowOffset({ x: 0, y: 0 })",
"        textNode.shadowColor(baseShadow?.color || '#000000')\n        textNode.shadowBlur(baseShadow?.blur || 0)\n        textNode.shadowOpacity(baseShadow?.opacity || 0)\n        textNode.shadowOffset(baseShadow?.offset || { x: 0, y: 0 })\n        textNode.shadowEnabled(baseShadow?.enabled || false)",
'canvas shadow reset')
s = replace_once(s,
"  fontFamily,\n  fontStyle,\n  opacity = 1,",
"  fontFamily,\n  fontStyle,\n  align,\n  strokeColor,\n  strokeWidth,\n  shadowEnabled,\n  shadowColor,\n  shadowBlur,\n  shadowOffset,\n  opacity = 1,",
'canvas destructure')
s = replace_once(s,
"          fontStyle={fontStyle}\n          fontSize={fontSize}\n          opacity={opacity}\n          lineHeight={0.95}\n          shadowColor={target === 'price' ? 'rgba(255,255,255,.55)' : undefined}\n          shadowOffset={target === 'price' ? { x: 2, y: 2 } : undefined}\n          shadowBlur={0}\n          listening={editable}",
"          fontStyle={fontStyle}\n          fontSize={fontSize}\n          align={align}\n          stroke={strokeWidth > 0 ? strokeColor : undefined}\n          strokeWidth={strokeWidth}\n          fillAfterStrokeEnabled\n          opacity={opacity}\n          lineHeight={0.95}\n          shadowEnabled={shadowEnabled}\n          shadowColor={shadowColor}\n          shadowOffset={{ x: shadowOffset, y: shadowOffset }}\n          shadowBlur={shadowBlur}\n          shadowOpacity={0.72}\n          listening={editable}",
'canvas text styling')

call_repls = {
'fontFamily="Arial Black, Arial, sans-serif" fontStyle="bold" width={size.width} height={size.height} editable={editable} selected={selectedText === \'product\'}': 'fontFamily={config.productFontFamily} fontStyle={config.productFontStyle} align={config.productAlign} strokeColor={config.productStrokeColor} strokeWidth={config.productStrokeWidth} shadowEnabled={config.productShadowEnabled} shadowColor={config.productShadowColor} shadowBlur={config.productShadowBlur} shadowOffset={config.productShadowOffset} width={size.width} height={size.height} editable={editable} selected={selectedText === \'product\'}',
'fontFamily="Arial Black, Arial, sans-serif" fontStyle="bold" width={size.width} height={size.height} editable={editable} selected={selectedText === \'price\'}': 'fontFamily={config.priceFontFamily} fontStyle={config.priceFontStyle} align={config.priceAlign} strokeColor={config.priceStrokeColor} strokeWidth={config.priceStrokeWidth} shadowEnabled={config.priceShadowEnabled} shadowColor={config.priceShadowColor} shadowBlur={config.priceShadowBlur} shadowOffset={config.priceShadowOffset} width={size.width} height={size.height} editable={editable} selected={selectedText === \'price\'}',
'fontFamily="Arial Black, Arial, sans-serif" fontStyle="bold" width={size.width} height={size.height} editable={editable} selected={selectedText === \'unit\'}': 'fontFamily={config.unitFontFamily} fontStyle={config.unitFontStyle} align={config.unitAlign} strokeColor={config.unitStrokeColor} strokeWidth={config.unitStrokeWidth} shadowEnabled={config.unitShadowEnabled} shadowColor={config.unitShadowColor} shadowBlur={config.unitShadowBlur} shadowOffset={config.unitShadowOffset} width={size.width} height={size.height} editable={editable} selected={selectedText === \'unit\'}',
'fontFamily="Arial, sans-serif" width={size.width} height={size.height} editable={editable} selected={selectedText === \'complement\'}': 'fontFamily={config.complementFontFamily} fontStyle={config.complementFontStyle} align={config.complementAlign} strokeColor={config.complementStrokeColor} strokeWidth={config.complementStrokeWidth} shadowEnabled={config.complementShadowEnabled} shadowColor={config.complementShadowColor} shadowBlur={config.complementShadowBlur} shadowOffset={config.complementShadowOffset} width={size.width} height={size.height} editable={editable} selected={selectedText === \'complement\'}',
}
for old,new in call_repls.items():
    s = replace_once(s, old, new, 'canvas text call')
canvas.write_text(s)

manager = Path('src/SmartScenesManager.tsx')
s = manager.read_text()
s = replace_once(s,
"import { getHeroConfig, heroStylePreset, heroStyleVars, type HeroBackgroundMode, type HeroConfig, type HeroElementType, type HeroStyle, type HeroTextAnimation } from './smart-scene-hero-config'",
"import { getHeroConfig, heroStylePreset, heroStyleVars, type HeroBackgroundMode, type HeroConfig, type HeroElementType, type HeroFontStyle, type HeroStyle, type HeroTextAlign, type HeroTextAnimation } from './smart-scene-hero-config'",
'manager imports')
options_marker = "]\n\nfunction ScenePreview"
options = "]\n\nconst heroFontOptions = [\n  'Arial Black, Arial, sans-serif',\n  'Arial, sans-serif',\n  'Impact, Haettenschweiler, sans-serif',\n  'Verdana, Geneva, sans-serif',\n  'Trebuchet MS, Arial, sans-serif',\n  'Georgia, serif',\n  'Times New Roman, serif',\n  'Courier New, monospace',\n]\n\nconst heroFontStyleOptions: { value: HeroFontStyle; label: string }[] = [\n  { value: 'normal', label: 'Normal' },\n  { value: 'bold', label: 'Negrito' },\n  { value: 'italic', label: 'Itálico' },\n  { value: 'bold italic', label: 'Negrito + itálico' },\n]\n\nconst heroTextAlignOptions: { value: HeroTextAlign; label: string }[] = [\n  { value: 'left', label: 'Esquerda' },\n  { value: 'center', label: 'Centro' },\n  { value: 'right', label: 'Direita' },\n]\n\nfunction ScenePreview"
s = replace_once(s, options_marker, options, 'manager options')

for prefix,label in [('product','Produto'),('price','Preço'),('unit','Unidade'),('complement','Complemento')]:
    color_line = f"                  <label>Cor<input type=\"color\" value={{heroConfig.{prefix}Color}} onChange={{(event) => updateHero('{prefix}Color', event.target.value)}} /></label>"
    extras = color_line + f"\n                  <label>Fonte<select value={{heroConfig.{prefix}FontFamily}} onChange={{(event) => updateHero('{prefix}FontFamily', event.target.value)}}>{{heroFontOptions.map((font) => <option key={{font}} value={{font}}>{{font.split(',')[0]}}</option>)}}</select></label>\n                  <label>Estilo<select value={{heroConfig.{prefix}FontStyle}} onChange={{(event) => updateHero('{prefix}FontStyle', event.target.value as HeroFontStyle)}}>{{heroFontStyleOptions.map((option) => <option key={{option.value}} value={{option.value}}>{{option.label}}</option>)}}</select></label>\n                  <label>Alinhamento<select value={{heroConfig.{prefix}Align}} onChange={{(event) => updateHero('{prefix}Align', event.target.value as HeroTextAlign)}}>{{heroTextAlignOptions.map((option) => <option key={{option.value}} value={{option.value}}>{{option.label}}</option>)}}</select></label>\n                  <label>Contorno<input type=\"range\" min=\"0\" max=\"12\" step=\"1\" value={{heroConfig.{prefix}StrokeWidth}} onChange={{(event) => updateHero('{prefix}StrokeWidth', Number(event.target.value))}} /><span>{{heroConfig.{prefix}StrokeWidth}}px</span></label>\n                  <label>Cor do contorno<input type=\"color\" value={{heroConfig.{prefix}StrokeColor}} disabled={{heroConfig.{prefix}StrokeWidth === 0}} onChange={{(event) => updateHero('{prefix}StrokeColor', event.target.value)}} /></label>\n                  <label className=\"smart-hero-animation-toggle\"><input type=\"checkbox\" checked={{heroConfig.{prefix}ShadowEnabled}} onChange={{(event) => updateHero('{prefix}ShadowEnabled', event.target.checked)}} />Sombra</label>\n                  <label>Cor da sombra<input type=\"color\" value={{heroConfig.{prefix}ShadowColor}} disabled={{!heroConfig.{prefix}ShadowEnabled}} onChange={{(event) => updateHero('{prefix}ShadowColor', event.target.value)}} /></label>\n                  <label>Suavidade da sombra<input type=\"range\" min=\"0\" max=\"40\" value={{heroConfig.{prefix}ShadowBlur}} disabled={{!heroConfig.{prefix}ShadowEnabled}} onChange={{(event) => updateHero('{prefix}ShadowBlur', Number(event.target.value))}} /><span>{{heroConfig.{prefix}ShadowBlur}}px</span></label>\n                  <label>Distância da sombra<input type=\"range\" min=\"0\" max=\"20\" value={{heroConfig.{prefix}ShadowOffset}} disabled={{!heroConfig.{prefix}ShadowEnabled}} onChange={{(event) => updateHero('{prefix}ShadowOffset', Number(event.target.value))}} /><span>{{heroConfig.{prefix}ShadowOffset}}px</span></label>"
    s = replace_once(s, color_line, extras, f'{label} style controls')
manager.write_text(s)
