import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import type { CardId } from '../types.ts'
import { CardFace } from './CardFace.tsx'
import { prefersReducedMotion } from './card-motion.ts'
import css from './styles.module.css'

const CARD_BACK = '/doudizhu/assets/card-back.png'

export function FlipCard({
  card,
  faceUp,
  laiZiRanks = [],
  delay = 0,
}: {
  card: CardId
  faceUp: boolean
  laiZiRanks?: readonly string[]
  delay?: number
}) {
  const sceneRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined
    const reduced = prefersReducedMotion()
    gsap.set(scene, { rotateY: 0, transformPerspective: 640 })
    const tween = gsap.to(scene, {
      rotateY: faceUp ? 180 : 0,
      duration: reduced ? 0 : 0.48,
      delay: reduced ? 0 : delay,
      ease: 'power2.inOut',
      overwrite: 'auto',
    })
    return () => { tween.kill() }
  }, [delay, faceUp])

  return (
    <div className={css.flipScene}>
      <div className={css.flipInner} ref={sceneRef}>
        <div className={css.flipFront}>
          <div className={css.cardBack}>
            <img className={css.cardBackArt} src={CARD_BACK} alt="" />
          </div>
        </div>
        <div className={css.flipBack}>
          <CardFace card={card} laiZiRanks={laiZiRanks} />
        </div>
      </div>
    </div>
  )
}
