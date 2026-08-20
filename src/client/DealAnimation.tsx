import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { DEAL_FLY_MS, DEAL_PER_CARD_MS, DEAL_SHUFFLE_MS } from '../invariant.ts'
import { dealtHandSize, type Seat } from '../types.ts'
import { dealOrder, dealSeatTargets } from './seat-layout.ts'
import css from './styles.module.css'

const CARD_BACK = '/doudizhu/assets/card-back.png'
const PRELOAD = [
  CARD_BACK,
  '/doudizhu/assets/face-a.png',
  '/doudizhu/assets/face-j.png',
  '/doudizhu/assets/face-k.png',
  '/doudizhu/assets/face-q.png',
  '/doudizhu/assets/joker-red.png',
  '/doudizhu/assets/joker-black.png',
]

interface Flight {
  x: number
  y: number
  rotation: number
  scale: number
}

export function DealAnimation({
  seatCount,
  selfSeat,
  onDone,
}: {
  seatCount: 3 | 4
  selfSeat: Seat
  onDone?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const parent = canvas.parentElement
    if (!parent) return undefined
    let disposed = false
    let frame = 0
    let timeline: { kill(): void } | null = null

    const start = async (): Promise<void> => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const image = await loadImage(CARD_BACK)
      for (const src of PRELOAD.slice(1)) void loadImage(src)
      if (disposed) return
      const size = resize(canvas, parent)
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        onDone?.()
        return
      }
      const perHand = dealtHandSize(seatCount)
      const order = dealOrder(seatCount, perHand)
      const targets = dealSeatTargets(selfSeat, seatCount, size.w, size.h)
      const origin = { x: size.w * 0.5, y: size.h * 0.46 }
      const flights: Flight[] = order.map((_, index) => ({
        x: origin.x + ((index % 5) - 2) * 3,
        y: origin.y + ((index % 3) - 1) * 2,
        rotation: 0,
        scale: 0.72,
      }))
      const radiusFor = (cardW: number): number => Math.max(8, Math.round(cardW * (16 / 88)))
      const draw = (): void => {
        ctx.clearRect(0, 0, size.w, size.h)
        const cardW = Math.max(42, Math.round(size.w * 0.07))
        const cardH = Math.round(cardW * 1.4)
        const radius = radiusFor(cardW)
        for (const flight of flights) {
          ctx.save()
          ctx.translate(flight.x, flight.y)
          ctx.rotate((flight.rotation * Math.PI) / 180)
          ctx.scale(flight.scale, flight.scale)
          ctx.beginPath()
          ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius)
          ctx.clip()
          if (image) ctx.drawImage(image, -cardW / 2, -cardH / 2, cardW, cardH)
          else {
            ctx.fillStyle = '#fff'
            ctx.fill()
          }
          ctx.restore()
          ctx.save()
          ctx.translate(flight.x, flight.y)
          ctx.rotate((flight.rotation * Math.PI) / 180)
          ctx.scale(flight.scale, flight.scale)
          ctx.strokeStyle = '#d0cdc6'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius)
          ctx.stroke()
          ctx.restore()
        }
      }
      const tl = gsap.timeline({
        onUpdate: draw,
        onComplete: () => { onDone?.() },
      })
      timeline = tl
      draw()
      for (let index = 0; index < flights.length; index += 1) {
        const flight = flights[index]!
        const scatterX = origin.x + ((index % 7) - 3) * 18 + (index % 2 === 0 ? -10 : 10)
        const scatterY = origin.y + ((index % 5) - 2) * 10
        const scatterRot = ((index % 9) - 4) * 11
        tl.to(flight, {
          x: scatterX,
          y: scatterY,
          rotation: scatterRot,
          duration: 0.18,
          ease: 'power1.inOut',
        }, index * 0.008)
        tl.to(flight, {
          x: origin.x,
          y: origin.y,
          rotation: 0,
          duration: 0.16,
          ease: 'power2.in',
        }, 0.55 + index * 0.004)
      }
      const dealAt = DEAL_SHUFFLE_MS / 1000
      const fly = DEAL_FLY_MS / 1000
      const stagger = DEAL_PER_CARD_MS / 1000
      for (let index = 0; index < flights.length; index += 1) {
        const seat = order[index]!
        const target = targets[seat] ?? origin
        const spin = seat === selfSeat ? 360 : seat % 2 === 0 ? -420 : 420
        tl.to(flights[index]!, {
          x: target.x,
          y: target.y,
          rotation: spin,
          scale: seat === selfSeat ? 1 : 0.78,
          duration: fly,
          ease: 'power2.out',
        }, dealAt + index * stagger)
      }
    }

    frame = requestAnimationFrame(() => { void start() })
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      timeline?.kill()
    }
  }, [onDone, seatCount, selfSeat])

  return <canvas ref={canvasRef} className={css.dealCanvas} aria-hidden="true" />
}

function resize(canvas: HTMLCanvasElement, parent: HTMLElement): { w: number; h: number } {
  const rect = parent.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(rect.width))
  const h = Math.max(1, Math.round(rect.height))
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { w, h }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => { resolve(image) }
    image.onerror = () => { resolve(null) }
    image.src = src
  })
}
