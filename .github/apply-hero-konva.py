from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old, new, 1)

manager_path = Path('src/SmartScenesManager.tsx')
manager = manager_path.read_text()
manager = replace_once(
    manager,
    "import { getHeroConfig, heroStylePreset, heroStyleVars, type HeroBackgroundMode, type HeroConfig, type HeroElementType, type HeroStyle, type HeroTextAnimation } from './smart-scene-hero-config'\n",
    "import { getHeroConfig, heroStylePreset, heroStyleVars, type HeroBackgroundMode, type HeroConfig, type HeroElementType, type HeroStyle, type HeroTextAnimation } from './smart-scene-hero-config'\nimport HeroCanvas, { type HeroCanvasTextPatch, type HeroCanvasTextTarget } from './HeroCanvas'\n",
    'manager import',
)
manager = replace_once(
    manager,
    "function ScenePreview({ scene, headline, primaryText, secondaryText, orientation = 'auto', intensity = 'impact', motion = 'balanced', heroConfig, editableHero = false, onHeroPositionChange, onHeroElement1Change }: {",
    "function ScenePreview({ scene, headline, primaryText, secondaryText, orientation = 'auto', intensity = 'impact', motion = 'balanced', heroConfig, editableHero = false, onHeroPositionChange, onHeroTextChange, onHeroElement1Change }: {",
    'scene preview signature',
)
manager = replace_once(
    manager,
    "  onHeroPositionChange?: (target: HeroDragTarget, x: number, y: number) => void\n  onHeroElement1Change?: (patch: HeroElement1Patch) => void",
    "  onHeroPositionChange?: (target: HeroDragTarget, x: number, y: number) => void\n  onHeroTextChange?: (target: HeroCanvasTextTarget, patch: HeroCanvasTextPatch) => void\n  onHeroElement1Change?: (patch: HeroElement1Patch) => void",
    'scene preview props',
)
anchor = "  const complementAnimationClass = hero.complementAnimationEnabled ? `hero-text-animation-${hero.complementAnimation}` : 'hero-text-animation-none'\n\n  function beginHeroDrag"
insert = """  const complementAnimationClass = hero.complementAnimationEnabled ? `hero-text-animation-${hero.complementAnimation}` : 'hero-text-animation-none'\n\n  if (scene.key === 'hero') {\n    return (\n      <div\n        className={`smart-scene-preview smart-scene-hero smart-scene-intensity-${intensity} smart-scene-motion-${motion}${heroClass}${editableHero ? ' is-hero-editable' : ''}`}\n        data-scene-orientation={orientation}\n        aria-hidden=\"true\"\n      >\n        <HeroCanvas\n          config={hero}\n          productText={displayPrimary}\n          complementText={displaySecondary}\n          editable={editableHero}\n          onTextChange={onHeroTextChange}\n          onElement1Change={onHeroElement1Change}\n        />\n      </div>\n    )\n  }\n\n  function beginHeroDrag"""
manager = replace_once(manager, anchor, insert, 'hero early return')
move_anchor = """  function moveHero(target: HeroDragTarget, x: number, y: number) {
    setHeroConfig((current) => {
      if (target === 'product') return { ...current, productX: x, productY: y }
      if (target === 'price') return { ...current, priceX: x, priceY: y }
      if (target === 'unit') return { ...current, unitX: x, unitY: y }
      return { ...current, complementX: x, complementY: y }
    })
  }

  function transformHeroElement1"""
move_replace = """  function moveHero(target: HeroDragTarget, x: number, y: number) {
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
manager = replace_once(manager, move_anchor, move_replace, 'hero text updater')
manager = replace_once(
    manager,
    "<ScenePreview scene={editorScene} headline={headline} primaryText={primaryText} secondaryText={secondaryText} orientation={orientation} intensity={intensity} motion={motion} heroConfig={heroConfig} editableHero={editorKind === 'hero'} onHeroPositionChange={moveHero} onHeroElement1Change={transformHeroElement1} />",
    "<ScenePreview scene={editorScene} headline={headline} primaryText={primaryText} secondaryText={secondaryText} orientation={orientation} intensity={intensity} motion={motion} heroConfig={heroConfig} editableHero={editorKind === 'hero'} onHeroPositionChange={moveHero} onHeroTextChange={transformHeroText} onHeroElement1Change={transformHeroElement1} />",
    'editor preview call',
)
manager = manager.replace('type="range" min="60" max="150" value={heroConfig.productSize}', 'type="range" min="40" max="240" value={heroConfig.productSize}')
manager = manager.replace('type="range" min="60" max="160" value={heroConfig.priceSize}', 'type="range" min="40" max="240" value={heroConfig.priceSize}')
manager = manager.replace('type="range" min="60" max="160" value={heroConfig.unitSize}', 'type="range" min="40" max="240" value={heroConfig.unitSize}')
manager = manager.replace('type="range" min="60" max="160" value={heroConfig.complementSize}', 'type="range" min="40" max="240" value={heroConfig.complementSize}')
manager_path.write_text(manager)

view_path = Path('src/SmartSceneView.tsx')
view = view_path.read_text()
view = replace_once(
    view,
    "import { getHeroConfig, heroStyleVars } from './smart-scene-hero-config'\n",
    "import { getHeroConfig, heroStyleVars } from './smart-scene-hero-config'\nimport HeroCanvas from './HeroCanvas'\n",
    'view import',
)
view_anchor = "  const complementAnimationClass = hero.complementAnimationEnabled ? `hero-text-animation-${hero.complementAnimation}` : 'hero-text-animation-none'\n\n  return ("
view_insert = """  const complementAnimationClass = hero.complementAnimationEnabled ? `hero-text-animation-${hero.complementAnimation}` : 'hero-text-animation-none'\n\n  if (scene.scene_type === 'hero') {\n    return (\n      <div\n        className={`smart-scene-player smart-scene-hero smart-scene-intensity-${scene.intensity} smart-scene-motion-${scene.motion}${heroClass} ${className}`.trim()}\n        data-scene-orientation={scene.orientation}\n      >\n        <HeroCanvas config={hero} productText={productText} complementText={secondaryText} />\n      </div>\n    )\n  }\n\n  return ("""
view = replace_once(view, view_anchor, view_insert, 'view early return')
view_path.write_text(view)

config_path = Path('src/smart-scene-hero-config.ts')
config = config_path.read_text()
config = config.replace("productSize: numberValue(hero.productSize, defaults.productSize, 60, 150)", "productSize: numberValue(hero.productSize, defaults.productSize, 40, 240)")
config = config.replace("priceSize: numberValue(hero.priceSize, defaults.priceSize, 60, 160)", "priceSize: numberValue(hero.priceSize, defaults.priceSize, 40, 240)")
config = config.replace("unitSize: numberValue(hero.unitSize, defaults.unitSize, 60, 160)", "unitSize: numberValue(hero.unitSize, defaults.unitSize, 40, 240)")
config = config.replace("complementSize: numberValue(hero.complementSize, defaults.complementSize, 60, 160)", "complementSize: numberValue(hero.complementSize, defaults.complementSize, 40, 240)")
config_path.write_text(config)
