import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Konva from 'konva'
import { Ellipse, Group, Layer, Line, Rect, Stage, Star, Text, Transformer } from 'react-konva'
import type { HeroConfig, HeroElementType, HeroTextAnimation } from './smart-scene-hero-config'
import './hero-canvas.css'

export type HeroCanvasTextTarget = 'product' | 'price' | 'unit' | 'complement'

export type HeroCanvasTextPatch = {
  x?: number
  y?: number
  size?: number
  rotation?: number
}

export type HeroCanvasElement1Patch = Partial<Pick<HeroConfig, 'element1X' | 'element1Y' | 'element1Width' | 'element1Height' | 'element1Rotation'>>

type HeroCanvasProps = {
  config: HeroConfig
  productText: string
  complementText: string
  editable?: boolean
  onTextChange?: (target: HeroCanvasTextTarget, patch: HeroCanvasTextPatch) => void
  onElement1Change?: (patch: HeroCanvasElement1Patch) => void
}

type Size = { width: number; height: number }

type CanvasTextObjectProps = {
  target: HeroCanvasTextTarget
  text: string
  x: number
  y: number
  size: number
  rotation: number
  color: string
  animationEnabled: boolean
  animation: HeroTextAnimation
  fontSize: number
  fontFamily: string
  fontStyle?: string
  opacity?: number
  width: number
  height: number
  editable: boolean
  selected: boolean
  onSelect: () => void
  onChange?: (target: HeroCanvasTextTarget, patch: HeroCanvasTextPatch) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function percent(value: number, total: number) {
  return total > 0 ? clamp((value / total) * 100, 0, 100) : 0
}

function AnimatedInnerGroup({ enabled, animation, amplitude, children }: {
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
}

const CanvasTextObject = forwardRef<Konva.Group, CanvasTextObjectProps>(function CanvasTextObject({
  target,
  text,
  x,
  y,
  size,
  rotation,
  color,
  animationEnabled,
  animation,
  fontSize,
  fontFamily,
  fontStyle,
  opacity = 1,
  width,
  height,
  editable,
  selected,
  onSelect,
  onChange,
}, ref) {
  if (!text) return null

  return (
    <Group
      ref={ref}
      x={(x / 100) * width}
      y={(y / 100) * height}
      rotation={rotation}
      draggable={editable}
      listening={editable}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onSelect}
      dragBoundFunc={(pos) => ({ x: clamp(pos.x, 0, width), y: clamp(pos.y, 0, height) })}
      onDragEnd={(event) => {
        if (!onChange) return
        onChange(target, { x: Math.round(percent(event.target.x(), width)), y: Math.round(percent(event.target.y(), height)) })
      }}
      onTransformEnd={(event) => {
        if (!onChange) return
        const node = event.target as Konva.Group
        const scale = clamp(Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY())), 0.5, 2.5)
        const nextSize = Math.round(clamp(size * scale, 40, 240))
        const nextRotation = Math.round(node.rotation())
        const nextX = Math.round(percent(node.x(), width))
        const nextY = Math.round(percent(node.y(), height))
        node.scale({ x: 1, y: 1 })
        onChange(target, { x: nextX, y: nextY, size: nextSize, rotation: nextRotation })
      }}
      name={`hero-text-${target}`}
    >
      <AnimatedInnerGroup enabled={animationEnabled} animation={animation} amplitude={Math.max(5, fontSize * 0.12)}>
        <Text
          text={text}
          fill={color}
          fontFamily={fontFamily}
          fontStyle={fontStyle}
          fontSize={fontSize}
          opacity={opacity}
          lineHeight={0.95}
          shadowColor={target === 'price' ? 'rgba(255,255,255,.55)' : undefined}
          shadowOffset={target === 'price' ? { x: 2, y: 2 } : undefined}
          shadowBlur={0}
          listening={editable}
        />
      </AnimatedInnerGroup>
      {selected && editable && <Rect x={-4} y={-4} width={8} height={8} opacity={0} listening={false} />}
    </Group>
  )
})

type HeroGraphicProps = {
  type: HeroElementType
  color: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  animationIndex: 1 | 2 | 3
  editable?: boolean
  selected?: boolean
  stageWidth: number
  stageHeight: number
  onSelect?: () => void
  onChange?: (patch: HeroCanvasElement1Patch) => void
}

const HeroGraphic = forwardRef<Konva.Group, HeroGraphicProps>(function HeroGraphic({
  type,
  color,
  x,
  y,
  width,
  height,
  rotation = 0,
  animationIndex,
  editable = false,
  stageWidth,
  stageHeight,
  onSelect,
  onChange,
}, ref) {
  const animationRef = useRef<Konva.Group>(null)
  const pixelWidth = (width / 100) * stageWidth
  const pixelHeight = (height / 100) * stageHeight
  const minSize = Math.max(1, Math.min(pixelWidth, pixelHeight))

  useEffect(() => {
    const node = animationRef.current
    const layer = node?.getLayer()
    if (!node || !layer) return
    node.position({ x: pixelWidth / 2, y: pixelHeight / 2 })
    node.scale({ x: 1, y: 1 })
    node.rotation(0)

    const runner = new Konva.Animation((frame) => {
      const seconds = (frame?.time || 0) / 1000
      if (animationIndex === 1) {
        const wave = Math.sin(seconds * Math.PI * 0.8)
        const scale = 1 + wave * 0.055
        node.scale({ x: scale, y: scale })
        node.rotation(wave * 2)
      } else if (animationIndex === 2) {
        const wave = Math.sin(seconds * Math.PI * 0.6)
        node.x(pixelWidth / 2 + wave * stageWidth * 0.02)
        node.rotation(wave * 2)
      } else {
        const wave = Math.sin(seconds * Math.PI * 0.45)
        const scale = 1 + wave * 0.04
        node.scale({ x: scale, y: scale })
        node.rotation(wave * 5)
      }
    }, layer)
    runner.start()
    return () => { runner.stop() }
  }, [animationIndex, pixelHeight, pixelWidth, stageWidth])

  const visual = useMemo(() => {
    if (type === 'burst') {
      return <Star numPoints={18} innerRadius={minSize * 0.29} outerRadius={minSize * 0.5} scaleX={pixelWidth / minSize} scaleY={pixelHeight / minSize} fill={color} listening={false} />
    }
    if (type === 'band') {
      return <Line points={[-pixelWidth / 2, -pixelHeight * 0.38, pixelWidth / 2, -pixelHeight / 2, pixelWidth * 0.4, pixelHeight * 0.38, -pixelWidth / 2, pixelHeight / 2]} closed fill={color} listening={false} />
    }
    if (type === 'circle') {
      return <Ellipse radiusX={pixelWidth / 2} radiusY={pixelHeight / 2} fill={color} listening={false} />
    }
    if (type === 'glow') {
      return <Ellipse radiusX={pixelWidth / 2} radiusY={pixelHeight / 2} fill={color} opacity={0.32} shadowColor={color} shadowBlur={Math.max(18, minSize * 0.16)} shadowOpacity={0.85} listening={false} />
    }
    return <Rect x={-pixelWidth / 2} y={-pixelHeight / 2} width={pixelWidth} height={pixelHeight} cornerRadius={Math.max(4, minSize * 0.06)} fill={color} listening={false} />
  }, [type, minSize, pixelWidth, pixelHeight, color])

  return (
    <Group
      ref={ref}
      x={(x / 100) * stageWidth}
      y={(y / 100) * stageHeight}
      rotation={rotation}
      draggable={editable}
      listening={editable}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onSelect}
      onDragEnd={(event) => onChange?.({
        element1X: Math.round((event.target.x() / stageWidth) * 100),
        element1Y: Math.round((event.target.y() / stageHeight) * 100),
      })}
      onTransformEnd={(event) => {
        if (!onChange) return
        const node = event.target as Konva.Group
        const scaleX = Math.abs(node.scaleX())
        const scaleY = Math.abs(node.scaleY())
        const nextWidth = clamp(width * scaleX, 8, 140)
        const nextHeight = clamp(height * scaleY, 8, 140)
        node.scale({ x: 1, y: 1 })
        onChange({
          element1X: Math.round((node.x() / stageWidth) * 100),
          element1Y: Math.round((node.y() / stageHeight) * 100),
          element1Width: Math.round(nextWidth),
          element1Height: Math.round(nextHeight),
          element1Rotation: Math.round(node.rotation()),
        })
      }}
    >
      {editable && <Rect x={0} y={0} width={pixelWidth} height={pixelHeight} fill="rgba(0,0,0,0.001)" listening />}
      <Group ref={animationRef} x={pixelWidth / 2} y={pixelHeight / 2} listening={false}>{visual}</Group>
    </Group>
  )
})

export default function HeroCanvas({ config, productText, complementText, editable = false, onTextChange, onElement1Change }: HeroCanvasProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>({ width: 1, height: 1 })
  const [selectedText, setSelectedText] = useState<HeroCanvasTextTarget | null>(null)
  const [element1Selected, setElement1Selected] = useState(false)
  const productRef = useRef<Konva.Group>(null)
  const priceRef = useRef<Konva.Group>(null)
  const unitRef = useRef<Konva.Group>(null)
  const complementRef = useRef<Konva.Group>(null)
  const element1Ref = useRef<Konva.Group>(null)
  const textTransformerRef = useRef<Konva.Transformer>(null)
  const elementTransformerRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    const update = () => {
      const rect = shell.getBoundingClientRect()
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(shell)
    return () => observer.disconnect()
  }, [])

  const textRefs = useMemo(() => ({ product: productRef, price: priceRef, unit: unitRef, complement: complementRef }), [])

  useEffect(() => {
    const transformer = textTransformerRef.current
    if (!transformer) return
    const node = selectedText ? textRefs[selectedText].current : null
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedText, textRefs, size])

  useEffect(() => {
    const transformer = elementTransformerRef.current
    if (!transformer) return
    transformer.nodes(element1Selected && element1Ref.current ? [element1Ref.current] : [])
    transformer.getLayer()?.batchDraw()
  }, [element1Selected, size])

  const lengthFit = productText.length > 24 ? 0.66 : productText.length > 18 ? 0.74 : productText.length > 13 ? 0.84 : productText.length > 9 ? 0.92 : 1
  const productFontSize = Math.max(18, size.width * 0.072) * (config.productSize / 100) * lengthFit
  const priceFontSize = Math.max(22, size.width * 0.082) * (config.priceSize / 100)
  const unitFontSize = Math.max(11, size.width * 0.022) * (config.unitSize / 100)
  const complementFontSize = Math.max(12, size.width * 0.025) * (config.complementSize / 100)
  const priceText = config.price.trim()
  const unitText = config.unit.trim()
  const videoUrl = config.backgroundVideoUrl.trim()

  const selectText = (target: HeroCanvasTextTarget) => {
    if (!editable) return
    setElement1Selected(false)
    setSelectedText(target)
  }

  return (
    <div ref={shellRef} className={`hero-konva-shell${editable ? ' is-editable' : ''}`}>
      {config.backgroundMode === 'video' && videoUrl && <video className="hero-konva-video" src={videoUrl} autoPlay muted loop playsInline />}
      <Stage
        width={size.width}
        height={size.height}
        className="hero-konva-stage"
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) {
            setSelectedText(null)
            setElement1Selected(false)
          }
        }}
        onTouchStart={(event) => {
          if (event.target === event.target.getStage()) {
            setSelectedText(null)
            setElement1Selected(false)
          }
        }}
      >
        <Layer listening={false}>
          {config.backgroundMode === 'solid' && <Rect width={size.width} height={size.height} fill={config.backgroundColor} />}
        </Layer>

        <Layer>
          {config.element3Enabled && <HeroGraphic type={config.element3Type} color={config.element3Color} x={40} y={58} width={42} height={60} animationIndex={3} stageWidth={size.width} stageHeight={size.height} />}
          {config.element2Enabled && <HeroGraphic type={config.element2Type} color={config.element2Color} x={56} y={-12} width={54} height={128} animationIndex={2} stageWidth={size.width} stageHeight={size.height} />}
          {config.element1Enabled && <HeroGraphic ref={element1Ref} type={config.element1Type} color={config.element1Color} x={config.element1X} y={config.element1Y} width={config.element1Width} height={config.element1Height} rotation={config.element1Rotation} animationIndex={1} editable={editable} selected={element1Selected} stageWidth={size.width} stageHeight={size.height} onSelect={() => { if (!editable) return; setSelectedText(null); setElement1Selected(true) }} onChange={onElement1Change} />}
          {editable && <Transformer ref={elementTransformerRef} rotateEnabled keepRatio={false} enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} borderStroke="#ffffff" anchorFill="#ffffff" anchorStroke="#111111" anchorSize={8} boundBoxFunc={(oldBox, nextBox) => nextBox.width < 18 || nextBox.height < 18 ? oldBox : nextBox} />}
        </Layer>

        <Layer>
          <CanvasTextObject ref={productRef} target="product" text={productText.trim()} x={config.productX} y={config.productY} size={config.productSize} rotation={config.productRotation} color={config.productColor} animationEnabled={config.productAnimationEnabled} animation={config.productAnimation} fontSize={productFontSize} fontFamily="Arial Black, Arial, sans-serif" fontStyle="bold" width={size.width} height={size.height} editable={editable} selected={selectedText === 'product'} onSelect={() => selectText('product')} onChange={onTextChange} />
          <CanvasTextObject ref={priceRef} target="price" text={priceText} x={config.priceX} y={config.priceY} size={config.priceSize} rotation={config.priceRotation} color={config.priceColor} animationEnabled={config.priceAnimationEnabled} animation={config.priceAnimation} fontSize={priceFontSize} fontFamily="Arial Black, Arial, sans-serif" fontStyle="bold" width={size.width} height={size.height} editable={editable} selected={selectedText === 'price'} onSelect={() => selectText('price')} onChange={onTextChange} />
          <CanvasTextObject ref={unitRef} target="unit" text={unitText} x={config.unitX} y={config.unitY} size={config.unitSize} rotation={config.unitRotation} color={config.unitColor} animationEnabled={config.unitAnimationEnabled} animation={config.unitAnimation} fontSize={unitFontSize} fontFamily="Arial Black, Arial, sans-serif" fontStyle="bold" width={size.width} height={size.height} editable={editable} selected={selectedText === 'unit'} onSelect={() => selectText('unit')} onChange={onTextChange} />
          <CanvasTextObject ref={complementRef} target="complement" text={complementText.trim()} x={config.complementX} y={config.complementY} size={config.complementSize} rotation={config.complementRotation} color={config.complementColor} animationEnabled={config.complementAnimationEnabled} animation={config.complementAnimation} fontSize={complementFontSize} fontFamily="Arial, sans-serif" width={size.width} height={size.height} editable={editable} selected={selectedText === 'complement'} onSelect={() => selectText('complement')} onChange={onTextChange} />
          {editable && <Transformer ref={textTransformerRef} rotateEnabled keepRatio enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} borderStroke="#ffffff" borderDash={[5, 4]} anchorFill="#ffffff" anchorStroke="#111111" anchorSize={8} boundBoxFunc={(oldBox, nextBox) => nextBox.width < 12 || nextBox.height < 12 ? oldBox : nextBox} />}
        </Layer>
      </Stage>
    </div>
  )
}
