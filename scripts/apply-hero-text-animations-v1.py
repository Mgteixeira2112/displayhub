from pathlib import Path

config = Path('src/smart-scene-hero-config.ts')
s = config.read_text()
s = s.replace(
    "export type HeroTextAnimation = 'pulse' | 'slide' | 'zoom' | 'float' | 'blink'",
    "export type HeroTextAnimation = 'pulse' | 'slide' | 'zoom' | 'float' | 'blink' | 'neon' | 'glitch' | 'wave' | 'typewriter' | 'split' | 'shadow'",
)
s = s.replace(
    "  return value === 'pulse' || value === 'slide' || value === 'zoom' || value === 'float' || value === 'blink' ? value : fallback",
    "  return value === 'pulse' || value === 'slide' || value === 'zoom' || value === 'float' || value === 'blink' || value === 'neon' || value === 'glitch' || value === 'wave' || value === 'typewriter' || value === 'split' || value === 'shadow' ? value : fallback",
)
config.write_text(s)

manager = Path('src/SmartScenesManager.tsx')
s = manager.read_text()
old = """const heroTextAnimationOptions: { value: HeroTextAnimation; label: string }[] = [
  { value: 'pulse', label: 'Pulso' },
  { value: 'slide', label: 'Deslizar' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'float', label: 'Flutuar' },
  { value: 'blink', label: 'Piscar suave' },
]"""
new = """const heroTextAnimationOptions: { value: HeroTextAnimation; label: string }[] = [
  { value: 'pulse', label: 'Pulso' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'neon', label: 'Neon Glow' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'wave', label: 'Wavy Text' },
  { value: 'shadow', label: 'Dancing Shadow' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'split', label: 'Split Text' },
  { value: 'slide', label: 'Deslizar' },
  { value: 'float', label: 'Flutuar' },
  { value: 'blink', label: 'Piscar suave' },
]"""
if old not in s:
    raise SystemExit('heroTextAnimationOptions block not found')
manager.write_text(s.replace(old, new, 1))

canvas = Path('src/HeroCanvas.tsx')
s = canvas.read_text()
old = """function AnimatedInnerGroup({ enabled, animation, amplitude, children }: {
  enabled: boolean
  animation: HeroTextAnimation
  amplitude: number
  children: ReactNode
}) {
  const ref = useRef<Konva.Group>(null)

  useEffect(() => {
    const node = ref.current
    const layer = node?.getLayer()
    if (!node || !layer) return

    const reset = () => {
      node.position({ x: 0, y: 0 })
      node.scale({ x: 1, y: 1 })
      node.opacity(1)
      layer.batchDraw()
    }

    reset()
    if (!enabled) return

    const runner = new Konva.Animation((frame) => {
      const seconds = (frame?.time || 0) / 1000
      const wave = Math.sin(seconds * Math.PI * 1.25)
      if (animation === 'pulse') {
        const scale = 1 + wave * 0.07
        node.scale({ x: scale, y: scale })
      } else if (animation === 'zoom') {
        const scale = 1.02 + wave * 0.09
        node.scale({ x: scale, y: scale })
      } else if (animation === 'slide') {
        node.x(wave * amplitude)
      } else if (animation === 'float') {
        node.y(wave * amplitude * 0.7)
      } else if (animation === 'blink') {
        node.opacity(0.72 + ((wave + 1) / 2) * 0.28)
      }
    }, layer)

    runner.start()
    return () => {
      runner.stop()
      reset()
    }
  }, [enabled, animation, amplitude])

  return <Group ref={ref}>{children}</Group>
}"""
new = """function AnimatedInnerGroup({ enabled, animation, amplitude, children }: {
  enabled: boolean
  animation: HeroTextAnimation
  amplitude: number
  children: ReactNode
}) {
  const ref = useRef<Konva.Group>(null)

  useEffect(() => {
    const node = ref.current
    const layer = node?.getLayer()
    if (!node || !layer) return
    const textNode = node.getChildren()[0] as Konva.Text | undefined
    const originalText = textNode?.text() || ''

    const reset = () => {
      node.position({ x: 0, y: 0 })
      node.scale({ x: 1, y: 1 })
      node.rotation(0)
      node.skewX(0)
      node.opacity(1)
      if (textNode) {
        textNode.text(originalText)
        textNode.shadowBlur(0)
        textNode.shadowOpacity(0)
        textNode.shadowOffset({ x: 0, y: 0 })
      }
      layer.batchDraw()
    }

    reset()
    if (!enabled) return

    const runner = new Konva.Animation((frame) => {
      const seconds = (frame?.time || 0) / 1000
      const wave = Math.sin(seconds * Math.PI * 1.25)
      if (animation === 'pulse') {
        const scale = 1 + wave * 0.07
        node.scale({ x: scale, y: scale })
      } else if (animation === 'zoom') {
        const scale = 1.02 + wave * 0.09
        node.scale({ x: scale, y: scale })
      } else if (animation === 'slide') {
        node.x(wave * amplitude)
      } else if (animation === 'float') {
        node.y(wave * amplitude * 0.7)
      } else if (animation === 'blink') {
        node.opacity(0.72 + ((wave + 1) / 2) * 0.28)
      } else if (animation === 'neon' && textNode) {
        textNode.shadowColor(String(textNode.fill() || '#ffffff'))
        textNode.shadowBlur(12 + ((wave + 1) / 2) * 20)
        textNode.shadowOpacity(0.68 + ((wave + 1) / 2) * 0.32)
      } else if (animation === 'glitch' && textNode) {
        const tick = Math.floor(seconds * 14)
        const direction = tick % 2 === 0 ? 1 : -1
        node.position({ x: direction * amplitude * 0.28, y: (tick % 3 - 1) * amplitude * 0.12 })
        node.rotation(direction * 0.8)
        textNode.shadowColor(tick % 2 === 0 ? '#00eaff' : '#ff2bd6')
        textNode.shadowOffset({ x: direction * 4, y: 0 })
        textNode.shadowOpacity(0.85)
        textNode.shadowBlur(0)
      } else if (animation === 'wave') {
        node.position({ x: Math.cos(seconds * Math.PI * 1.1) * amplitude * 0.18, y: wave * amplitude * 0.62 })
        node.rotation(wave * 1.5)
      } else if (animation === 'shadow' && textNode) {
        const angle = seconds * Math.PI * 1.2
        textNode.shadowColor('#000000')
        textNode.shadowOffset({ x: Math.cos(angle) * 8, y: Math.sin(angle) * 8 })
        textNode.shadowOpacity(0.72)
        textNode.shadowBlur(1)
      } else if (animation === 'typewriter' && textNode) {
        const length = originalText.length
        const cursorPause = 5
        const step = Math.floor(seconds * 9) % Math.max(1, length + cursorPause)
        textNode.text(originalText.slice(0, Math.min(length, step)))
      } else if (animation === 'split') {
        const open = (Math.sin(seconds * Math.PI * 0.9) + 1) / 2
        node.scaleX(0.78 + open * 0.22)
        node.skewX((0.5 - open) * 0.16)
        node.opacity(0.72 + open * 0.28)
      }
    }, layer)

    runner.start()
    return () => {
      runner.stop()
      reset()
    }
  }, [enabled, animation, amplitude, children])

  return <Group ref={ref}>{children}</Group>
}"""
if old not in s:
    raise SystemExit('AnimatedInnerGroup block not found')
canvas.write_text(s.replace(old, new, 1))
