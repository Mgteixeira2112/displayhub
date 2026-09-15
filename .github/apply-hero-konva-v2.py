from pathlib import Path


def once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

p = Path('src/SmartScenesManager.tsx')
s = p.read_text()
s = once(s,
    "import { getHeroConfig, heroStylePreset, heroStyleVars, type HeroBackgroundMode, type HeroConfig, type HeroElementType, type HeroStyle, type HeroTextAnimation } from './smart-scene-hero-config'\n",
    "import { getHeroConfig, heroStylePreset, heroStyleVars, type HeroBackgroundMode, type HeroConfig, type HeroElementType, type HeroStyle, type HeroTextAnimation } from './smart-scene-hero-config'\nimport HeroCanvas, { type HeroCanvasTextPatch, type HeroCanvasTextTarget } from './HeroCanvas'\n",
    'manager import')
s = once(s,
    "function ScenePreview({ scene, headline, primaryText, secondaryText, orientation = 'auto', intensity = 'impact', motion = 'balanced', heroConfig, editableHero = false, onHeroPositionChange, onHeroElement1Change }: {",
    "function ScenePreview({ scene, headline, primaryText, secondaryText, orientation = 'auto', intensity = 'impact', motion = 'balanced', heroConfig, editableHero = false, onHeroPositionChange, onHeroTextChange, onHeroElement1Change }: {",
    'preview signature')
s = once(s,
    "  onHeroPositionChange?: (target: HeroDragTarget, x: number, y: number) => void\n  onHeroElement1Change?: (patch: HeroElement1Patch) => void",
    "  onHeroPositionChange?: (target: HeroDragTarget, x: number, y: number) => void\n  onHeroTextChange?: (target: HeroCanvasTextTarget, patch: HeroCanvasTextPatch) => void\n  onHeroElement1Change?: (patch: HeroElement1Patch) => void",
    'preview props')
anchor = "  const complementAnimationClass = hero.complementAnimationEnabled ? `hero-text-animation-${hero.complementAnimation}` : 'hero-text-animation-none'\n\n  function heroPosition"
insert = """  const complementAnimationClass = hero.complementAnimationEnabled ? `hero-text-animation-${hero.complementAnimation}` : 'hero-text-animation-none'\n\n  if (scene.key === 'hero') {\n    return (\n      <div\n        className={`smart-scene-preview smart-scene-hero smart-scene-intensity-${intensity} smart-scene-motion-${motion}${heroClass}${editableHero ? ' is-hero-editable' : ''}`}\n        data-scene-orientation={orientation}\n        aria-hidden=\"true\"\n      >\n        <HeroCanvas\n          config={hero}\n          productText={displayPrimary}\n          complementText={displaySecondary}\n          editable={editableHero}\n          onTextChange={onHeroTextChange}\n          onElement1Change={onHeroElement1Change}\n        />\n      </div>\n    )\n  }\n\n  function heroPosition"""
s = once(s, anchor, insert, 'hero early return')
move = """  function moveHero(target: HeroDragTarget, x: number, y: number) {
    setHeroConfig((current) => {
      if (target === 'product') return { ...current, productX: x, productY: y }
      if (target === 'price') return { ...current, priceX: x, priceY: y }
      if (target === 'unit') return { ...current, unitX: x, unitY: y }
      return { ...current, complementX: x, complementY: y }
    })
  }

  function transformHeroElement1"""
move_new = """  function moveHero(target: HeroDragTarget, x: number, y: number) {
    setHeroConfig((current) => {
      if (target === 'product') return { ...current, productX: x, productY: y }
      if (target === 'price') return { ...current, priceX: x, priceY: y }
      if (target === 'unit') return { ...current, unitX: x, unitY: y }
      return { ...current, complementX: x, complementY: y }
    })
  }

  function transformHeroText(target: HeroCanvasTextTarget, patch: HeroCanvasTextPatch) {
    setHeroConfig((current) => {
      const next = { ...current, coordinateMode: 'canvas-v1' as const }
      if (target === 'product') {
        if (patch.x !== undefined) next.productX = patch.x
        if (patch.y !== undefined) next.productY = patch.y
        if (patch.size !== undefined) next.productSize = patch.size
        if (patch.rotation !== undefined) next.productRotation = patch.rotation
      } else if (target === 'price') {
        if (patch.x !== undefined) next.priceX = patch.x
        if (patch.y !== undefined) next.priceY = patch.y
        if (patch.size !== undefined) next.priceSize = patch.size
        if (patch.rotation !== undefined) next.priceRotation = patch.rotation
      } else if (target === 'unit') {
        if (patch.x !== undefined) next.unitX = patch.x
        if (patch.y !== undefined) next.unitY = patch.y
        if (patch.size !== undefined) next.unitSize = patch.size
        if (patch.rotation !== undefined) next.unitRotation = patch.rotation
      } else {
        if (patch.x !== undefined) next.complementX = patch.x
        if (patch.y !== undefined) next.complementY = patch.y
        if (patch.size !== undefined) next.complementSize = patch.size
        if (patch.rotation !== undefined) next.complementRotation = patch.rotation
      }
      return next
    })
  }

  function transformHeroElement1"""
s = once(s, move, move_new, 'text transform updater')
s = once(s,
    "<ScenePreview scene={editorScene} headline={headline} primaryText={primaryText} secondaryText={secondaryText} orientation={orientation} intensity={intensity} motion={motion} heroConfig={heroConfig} editableHero={editorKind === 'hero'} onHeroPositionChange={moveHero} onHeroElement1Change={transformHeroElement1} />",
    "<ScenePreview scene={editorScene} headline={headline} primaryText={primaryText} secondaryText={secondaryText} orientation={orientation} intensity={intensity} motion={motion} heroConfig={heroConfig} editableHero={editorKind === 'hero'} onHeroPositionChange={moveHero} onHeroTextChange={transformHeroText} onHeroElement1Change={transformHeroElement1} />",
    'editor preview')
s = s.replace('type="range" min="60" max="150" value={heroConfig.productSize}', 'type="range" min="40" max="240" value={heroConfig.productSize}')
s = s.replace('type="range" min="60" max="160" value={heroConfig.priceSize}', 'type="range" min="40" max="240" value={heroConfig.priceSize}')
s = s.replace('type="range" min="60" max="160" value={heroConfig.unitSize}', 'type="range" min="40" max="240" value={heroConfig.unitSize}')
s = s.replace('type="range" min="60" max="160" value={heroConfig.complementSize}', 'type="range" min="40" max="240" value={heroConfig.complementSize}')
p.write_text(s)

p = Path('src/SmartSceneView.tsx')
s = p.read_text()
s = once(s,
    "import { getHeroConfig, heroStyleVars } from './smart-scene-hero-config'\n",
    "import { getHeroConfig, heroStyleVars } from './smart-scene-hero-config'\nimport HeroCanvas from './HeroCanvas'\n",
    'view import')
anchor = "  const complementAnimationClass = hero.complementAnimationEnabled ? `hero-text-animation-${hero.complementAnimation}` : 'hero-text-animation-none'\n\n  return ("
insert = """  const complementAnimationClass = hero.complementAnimationEnabled ? `hero-text-animation-${hero.complementAnimation}` : 'hero-text-animation-none'\n\n  if (scene.scene_type === 'hero') {\n    return (\n      <div\n        className={`smart-scene-player smart-scene-hero smart-scene-intensity-${scene.intensity} smart-scene-motion-${scene.motion}${heroClass} ${className}`.trim()}\n        data-scene-orientation={scene.orientation}\n      >\n        <HeroCanvas config={hero} productText={productText} complementText={secondaryText} />\n      </div>\n    )\n  }\n\n  return ("""
s = once(s, anchor, insert, 'view early return')
p.write_text(s)

p = Path('src/smart-scene-hero-config.ts')
s = p.read_text()
s = s.replace("productSize: numberValue(hero.productSize, defaults.productSize, 60, 150)", "productSize: numberValue(hero.productSize, defaults.productSize, 40, 240)")
s = s.replace("priceSize: numberValue(hero.priceSize, defaults.priceSize, 60, 160)", "priceSize: numberValue(hero.priceSize, defaults.priceSize, 40, 240)")
s = s.replace("unitSize: numberValue(hero.unitSize, defaults.unitSize, 60, 160)", "unitSize: numberValue(hero.unitSize, defaults.unitSize, 40, 240)")
s = s.replace("complementSize: numberValue(hero.complementSize, defaults.complementSize, 60, 160)", "complementSize: numberValue(hero.complementSize, defaults.complementSize, 40, 240)")
p.write_text(s)
