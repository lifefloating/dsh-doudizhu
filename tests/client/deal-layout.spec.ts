import { describe, expect, it } from 'vitest'
import { DEAL_ANIM_MS, dealAnimationMs } from '../../src/invariant.ts'
import { dealOrder, dealSeatTargets, opponentSeats } from '../../src/client/seat-layout.ts'

describe('deal layout', () => {
  it('deals one card to each seat in turn', () => {
    expect(dealOrder(3, 2)).toEqual([0, 1, 2, 0, 1, 2])
    expect(dealOrder(3, 17)).toHaveLength(51)
  })

  it('places the local seat at the bottom and opponents around the table', () => {
    const targets = dealSeatTargets(0, 3, 1000, 800)
    expect(targets[0]).toEqual({ x: 500, y: 688 })
    expect(targets[1]?.y).toBeLessThan(targets[0]!.y)
    expect(targets[2]?.x).toBeGreaterThan(targets[1]!.x)
    expect(opponentSeats(1, 3)).toEqual([2, 0])
  })

  it('dealing window matches the fly timeline plus a short buffer', () => {
    expect(dealAnimationMs(3)).toBe(DEAL_ANIM_MS)
    expect(dealAnimationMs(3)).toBeGreaterThan(3_000)
    expect(dealAnimationMs(3)).toBeLessThan(5_000)
    expect(dealAnimationMs(4)).toBeGreaterThan(dealAnimationMs(3))
    expect(dealAnimationMs(4)).toBeLessThan(7_000)
  })
})
