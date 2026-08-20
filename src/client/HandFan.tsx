import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import Draggable from 'gsap/Draggable'
import type { CardId } from '../types.ts'
import { CardFace } from './CardFace.tsx'
import { fanPose, fanWidth, prefersReducedMotion } from './card-motion.ts'
import css from './styles.module.css'

gsap.registerPlugin(Draggable)

export function HandFan({
  cards,
  selected,
  laiZiRanks = [],
  canPlay = false,
  onToggle,
  onPlay,
}: {
  cards: readonly CardId[]
  selected: readonly CardId[]
  laiZiRanks?: readonly string[]
  canPlay?: boolean
  onToggle: (card: CardId) => void
  onPlay?: (cards: readonly CardId[]) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef(new Map<string, HTMLButtonElement>())
  const selectedRef = useRef(selected)
  const cardsRef = useRef(cards)
  const onToggleRef = useRef(onToggle)
  const onPlayRef = useRef(onPlay)
  const canPlayRef = useRef(canPlay)
  const [hovered, setHovered] = useState<CardId | null>(null)
  const [fanMetrics, setFanMetrics] = useState({ availableWidth: 728, cardWidth: 88 })
  selectedRef.current = selected
  cardsRef.current = cards
  onToggleRef.current = onToggle
  onPlayRef.current = onPlay
  canPlayRef.current = canPlay
  const selectedKey = [...selected].join(',')
  const count = cards.length
  const key = cards.join(',')
  const selectedSet = new Set(selected)

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const container = wrap?.parentElement
    if (!container) return undefined
    const update = (): void => {
      const firstCard = cardsRef.current[0]
      const first = firstCard ? itemRefs.current.get(firstCard) : null
      const cardWidth = first?.getBoundingClientRect().width ?? 88
      const availableWidth = Math.max(cardWidth, container.clientWidth - 16)
      setFanMetrics((current) => (
        current.availableWidth === availableWidth && current.cardWidth === cardWidth
          ? current
          : { availableWidth, cardWidth }
      ))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => { observer.disconnect() }
  }, [])

  useLayoutEffect(() => {
    const reduced = prefersReducedMotion()
    const picked = new Set(selectedKey === '' ? [] : selectedKey.split(','))
    const nodes: HTMLButtonElement[] = []
    const list = cardsRef.current
    list.forEach((card, index) => {
      const node = itemRefs.current.get(card)
      if (!node) return
      nodes.push(node)
      if (node.dataset.dragging) return
      const pose = fanPose(count, index, picked.has(card), hovered === card, fanMetrics.availableWidth, fanMetrics.cardWidth)
      const next = { x: pose.x, y: pose.y, rotation: pose.rotation, transformOrigin: '50% 100%' }
      const first = node.dataset.posed !== '1'
      if (first || reduced) {
        gsap.set(node, next)
        node.dataset.posed = '1'
      } else {
        gsap.to(node, { ...next, duration: 0.28, ease: 'power2.out', overwrite: 'auto' })
      }
    })
    return () => {
      for (const node of nodes) {
        if (!node.dataset.dragging) gsap.killTweensOf(node)
      }
    }
  }, [count, fanMetrics.availableWidth, fanMetrics.cardWidth, hovered, key, selectedKey])

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return undefined
    const wrap = wrapRef.current
    if (!wrap) return undefined
    const playZone = wrap.closest('[data-table]')?.querySelector('[data-play-zone]')
    const created: Draggable[] = []
    for (const card of cards) {
      const node = itemRefs.current.get(card)
      if (!node) continue
      const [drag] = Draggable.create(node, {
        type: 'x,y',
        inertia: false,
        zIndexBoost: true,
        dragClickables: true,
        minimumMovement: 8,
        onDragStart() {
          node.dataset.dragging = '1'
          gsap.to(node, { scale: 1.06, duration: 0.12, overwrite: false })
        },
        onDragEnd() {
          const list = cardsRef.current
          const picked = selectedRef.current
          const index = list.indexOf(card)
          const hitPlay = playZone instanceof Element && Draggable.hitTest(node, playZone, '35%')
          gsap.to(node, { scale: 1, duration: 0.16, overwrite: false })
          const next = picked.includes(card) ? picked : [...picked, card]
          if (hitPlay && canPlayRef.current) onPlayRef.current?.(next)
          else if (hitPlay && !picked.includes(card)) onToggleRef.current(card)
          const pose = fanPose(list.length, index < 0 ? 0 : index, next.includes(card), false, fanMetrics.availableWidth, fanMetrics.cardWidth)
          gsap.to(node, {
            x: pose.x,
            y: pose.y,
            rotation: pose.rotation,
            duration: 0.28,
            ease: 'power2.out',
            overwrite: 'auto',
          })
          window.setTimeout(() => { delete node.dataset.dragging }, 0)
        },
      })
      if (drag) created.push(drag)
    }
    return () => {
      for (const drag of created) drag.kill()
    }
  }, [fanMetrics.availableWidth, fanMetrics.cardWidth, key])

  return (
    <div className={css.hand} data-hand>
      <div className={css.handInner} ref={wrapRef} style={{ width: fanWidth(count, fanMetrics.availableWidth, fanMetrics.cardWidth) }}>
        {cards.map((card, index) => (
          <button
            type="button"
            key={card}
            ref={(node) => {
              if (node) itemRefs.current.set(card, node)
              else itemRefs.current.delete(card)
            }}
            className={css.handCard}
            style={{ zIndex: index + (selectedSet.has(card) ? 40 : hovered === card ? 30 : 0) }}
            aria-pressed={selectedSet.has(card)}
            onMouseEnter={() => { setHovered(card) }}
            onMouseLeave={() => { setHovered((prev) => (prev === card ? null : prev)) }}
            onClick={() => {
              const node = itemRefs.current.get(card)
              if (node?.dataset.dragging) return
              onToggle(card)
            }}
          >
            <CardFace card={card} selected={selectedSet.has(card)} laiZiRanks={laiZiRanks} />
          </button>
        ))}
      </div>
    </div>
  )
}
