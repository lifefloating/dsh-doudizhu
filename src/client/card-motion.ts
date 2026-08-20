export interface CardPose {
  x: number
  y: number
  rotation: number
}

export const FAN_LIFT_HOVER = 14
export const FAN_LIFT_SELECTED = 28

export function fanPose(
  count: number,
  index: number,
  selected = false,
  hovered = false,
  availableWidth?: number,
  cardWidth = 88,
): CardPose {
  if (count <= 1) {
    return { x: 0, y: selected ? -FAN_LIFT_SELECTED : hovered ? -FAN_LIFT_HOVER : 0, rotation: 0 }
  }
  const mid = (count - 1) / 2
  const offset = index - mid
  const gap = fanGap(count, availableWidth, cardWidth)
  const rotStep = Math.min(6.5, 78 / count)
  const rotation = offset * rotStep
  const x = offset * gap
  const arc = Math.abs(offset) * 1.8
  let y = arc
  if (selected) y -= FAN_LIFT_SELECTED
  else if (hovered) y -= FAN_LIFT_HOVER
  return { x, y, rotation }
}

export function fanWidth(count: number, availableWidth?: number, cardWidth = 88): number {
  if (count <= 1) return cardWidth
  return Math.round((count - 1) * fanGap(count, availableWidth, cardWidth) + cardWidth)
}

function fanGap(count: number, availableWidth: number | undefined, cardWidth: number): number {
  if (availableWidth === undefined) return Math.min(56, 640 / count)
  return Math.min(56, Math.max(0, (availableWidth - cardWidth) / (count - 1)))
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function jokerTone(card: string): 'red' | 'black' | null {
  const raw = String(card).split('~')[0] ?? String(card)
  if (raw === 'RJ') return 'red'
  if (raw === 'BJ') return 'black'
  return null
}

export function isJokerCard(card: string): boolean {
  return jokerTone(card) !== null
}
