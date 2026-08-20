import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { CardId } from '../types.ts'
import { CardFace } from './CardFace.tsx'
import { prefersReducedMotion } from './card-motion.ts'
import css from './styles.module.css'

export function PlayFly({
  cards,
  laiZiRanks = [],
}: {
  cards: readonly CardId[]
  laiZiRanks?: readonly string[]
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const key = cards.join(',')

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return undefined
    const nodes = [...wrap.children] as HTMLElement[]
    if (prefersReducedMotion()) {
      gsap.set(nodes, { x: 0, y: 0, opacity: 1, scale: 1, rotation: 0 })
      return undefined
    }
    gsap.set(nodes, { y: 28, opacity: 0, scale: 0.9, rotation: -6 })
    const tween = gsap.to(nodes, {
      y: 0,
      opacity: 1,
      scale: 1,
      rotation: 0,
      duration: 0.34,
      stagger: 0.04,
      ease: 'back.out(1.4)',
      overwrite: 'auto',
    })
    return () => { tween.kill() }
  }, [key])

  return (
    <div className={css.playFly} ref={wrapRef} data-play-cards>
      {cards.map((card) => (
        <CardFace key={card} card={card} laiZiRanks={laiZiRanks} />
      ))}
    </div>
  )
}