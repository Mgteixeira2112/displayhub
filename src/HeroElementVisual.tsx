import type { HeroElementType } from './smart-scene-hero-config'

type Props = {
  type: HeroElementType
  className?: string
}

export default function HeroElementVisual({ type, className = '' }: Props) {
  const classes = `${className} type-${type}`.trim()

  if (type === 'burst') {
    return (
      <svg className={`${classes} hero-burst-svg`.trim()} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="50,7 57,24 70,13 70,31 90,23 78,41 94,46 78,53 91,66 72,64 77,86 60,72 53,93 45,74 31,87 32,66 10,72 22,54 7,49 24,40 11,29 31,32 29,12 44,25" />
      </svg>
    )
  }

  return <i className={classes} />
}
