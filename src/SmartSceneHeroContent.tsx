type SmartSceneHeroContentProps = {
  headline?: string
  primaryText?: string
  secondaryText?: string
}

export default function SmartSceneHeroContent({ headline, primaryText, secondaryText }: SmartSceneHeroContentProps) {
  return (
    <>
      <div className="smart-hero-atmosphere" aria-hidden="true"><i/><i/><i/></div>
      <div className="smart-hero-layout">
        <div className="smart-hero-copy">
          {headline && <span className="smart-hero-kicker">{headline}</span>}
          <strong className="smart-hero-title">{primaryText || 'DESTAQUE'}</strong>
          {secondaryText && <small className="smart-hero-subtitle">{secondaryText}</small>}
          <div className="smart-hero-accent" aria-hidden="true"><i/><span/></div>
        </div>
        <div className="smart-hero-art" aria-hidden="true">
          <div className="smart-hero-disc" />
          <div className="smart-hero-poster">
            <span className="smart-hero-poster-index">01</span>
            <div className="smart-hero-poster-mark">H</div>
            <div className="smart-hero-poster-lines"><i/><i/><i/></div>
          </div>
          <div className="smart-hero-shadow" />
        </div>
      </div>
    </>
  )
}
