import { getHeroConfig, heroStyleVars } from './smart-scene-hero-config'
import './smart-scenes.css'
import './smart-scenes-hero.css'

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
  const heroClass = scene.scene_type === 'hero' ? ` smart-hero-preset-${hero.preset}` : ''
  return (
    <div
      className={`smart-scene-player smart-scene-${scene.scene_type} smart-scene-intensity-${scene.intensity} smart-scene-motion-${scene.motion}${heroClass} ${className}`.trim()}
      data-scene-orientation={scene.orientation}
      style={scene.scene_type === 'hero' ? heroStyleVars(hero, scene.primary_text) : undefined}
    >
      <div className="smart-scene-glow" />
      <div className="smart-scene-visual" />
      <div className="smart-scene-copy">
        <span>{scene.headline}</span>
        <strong>{scene.primary_text}</strong>
        {scene.scene_type === 'hero' && <div className="smart-hero-price-row"><b>{hero.price}</b><em>{hero.unit}</em></div>}
        <small>{scene.secondary_text}</small>
      </div>
      {scene.scene_type === 'panorama' && <div className="smart-scene-wall-grid"><i/><i/><i/></div>}
      {scene.scene_type === 'split' && <div className="smart-scene-split-line" />}
    </div>
  )
}
