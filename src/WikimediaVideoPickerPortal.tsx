import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import WikimediaVideoPicker from './WikimediaVideoPicker'

function findVideoControls() {
  return document.querySelector<HTMLElement>('.promotion-video-controls')
}

export default function WikimediaVideoPickerPortal() {
  const [target, setTarget] = useState<HTMLElement | null>(() => findVideoControls())

  useEffect(() => {
    let frame = 0
    const refreshTarget = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const next = findVideoControls()
        setTarget((current) => current === next ? current : next)
      })
    }

    refreshTarget()
    document.addEventListener('click', refreshTarget, true)
    document.addEventListener('change', refreshTarget, true)

    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('click', refreshTarget, true)
      document.removeEventListener('change', refreshTarget, true)
    }
  }, [])

  if (!target) return null

  return createPortal(
    <WikimediaVideoPicker
      onSelect={(url) => {
        const input = target.querySelector<HTMLInputElement>('input[type="url"]')
        if (!input) return false
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        nativeSetter?.call(input, url)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        input.focus()
        return true
      }}
    />,
    target,
  )
}
