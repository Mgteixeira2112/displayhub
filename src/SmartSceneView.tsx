import { getHeroConfig, heroStyleVars } from './smart-scene-hero-config'
import './smart-scenes.css'
import './smart-scenes-hero.css'
import './smart-scenes-hero-layers.css'

export type SmartSceneData = {
  id: string
  name: string
  scene_type: 'hero' | 'split' | 'spotlight' | 'data' | 'countdown' | 'panorama'
  orientation: 'auto' | 'landscape' | 'portrait' | 'ultrawide'
  intensity: 'minimal' | 'commercial' | 'impact' | 'immersive'
  motion: 'soft' | 'balanced' | 'strong'
  headline: string
  primary_text: string
  secondary_text: string
  config?: Record<string, unknown>
}

export default function SmartSceneView({ scene, className = '' }: { scene: SmartSceneData; className?: string }) {
  const hero = getHeroConfig(scene.config)
  const heroClass = scene.scene_type === 'hero' ? ` smart-hero-style-${hero.style}` : ''
  const productText = scene.primary_text.trim()
  const secondaryText = scene.secondary_text.trim()
  const priceText = hero.price.trim()
  const unitText = hero.unit.trim()
  const videoUrl = hero.backgroundVideoUrl.trim()
  const productAnimationClass = hero.productAnimationEnabled ? `hero-text-animation-${hero.productAnimation}` : 'hero-text-animation-none'
  const priceAnimationClass = hero.priceAnimationEnabled ? `hero-text-animation-${hero.priceAnimation}` : 'hero-text-animation-none'
  const unitAnimationClass = hero.unitAnimationEnabled ? `hero-text-animation-${hero.unitAnimation}` : 'hero-text-animation-none'

  return (
    <div
      className={`smart-scene-player smart-scene-${scene.scene_type} smart-scene-intensity-${scene.intensity} smart-scene-motion-${scene.motion}${heroClass} ${className}`.trim()}
      data-scene-orientation={scene.orientation}
      style={scene.scene_type === 'hero' ? heroStyleVars(hero, productText) : undefined}
    >
      {scene.scene_type === 'hero' && (
        <>
          <div className={`smart-hero-background is-${hero.backgroundMode}`}>
            {hero.backgroundMode === 'video' && videoUrl && <video className="smart-hero-background-video" src={videoUrl} autoPlay muted loop playsInline />}
          </div>
          <div className={`smart-hero-style-layer smart-hero-style-${hero.style}`}>
            {hero.element1Enabled && <i className={`hero-style-element element-1 type-${hero.element1Type}`} />}
            {hero.element2Enabled && <i className={`hero-style-element element-2 type-${hero.element2Type}`} />}
            {hero.element3Enabled && <i className={`hero-style-element element-3 type-${hero.element3Type}`} />}
          </div>
        </>
      )}
      {scene.scene_type !== 'hero' && <div className="smart-scene-glow" />}
      {scene.scene_type !== 'hero' && <div className="smart-scene-visual" />}
      <div className="smart-scene-copy">
        {scene.scene_type !== 'hero' && <span>{scene.headline}</span>}
        {(scene.scene_type !== 'hero' || productText) && <strong className={scene.scene_type === 'hero' ? productAnimationClass : undefined}>{scene.scene_type === 'hero' ? productText : scene.primary_text}</strong>}
        {scene.scene_type === 'hero' && (priceText || unitText) && (
          <div className="smart-hero-price-row">
            {priceText && <b className={priceAnimationClass}>{priceText}</b>}
            {unitText && <em className={unitAnimationClass}>{unitText}</em>}
          </div>
        )}
        {(scene.scene_type !== 'hero' || secondaryText) && <small>{scene.scene_type === 'hero' ? secondaryText : scene.secondary_text}</small>}
      </div>
      {scene.scene_type === 'panorama' && <div className="smart-scene-wall-grid"><i/><i/><i/></div>}
      {scene.scene_type === 'split' && <div className="smart-scene-split-line" />}
    </div>
  )
}
