import { describe, expect, it } from 'vitest'
import { FAN_LIFT_HOVER, FAN_LIFT_SELECTED, fanPose, fanWidth, isJokerCard, jokerTone } from '../../src/client/card-motion.ts'

describe('card motion', () => {
  it('fans a 17-card hand around the center with more lift when selected', () => {
    const left = fanPose(17, 0)
    const mid = fanPose(17, 8)
    const right = fanPose(17, 16)
    const up = fanPose(17, 8, true)
    const hover = fanPose(17, 8, false, true)
    expect(left.x).toBeLessThan(0)
    expect(right.x).toBeGreaterThan(0)
    expect(mid.x).toBe(0)
    expect(left.rotation).toBeLessThan(0)
    expect(right.rotation).toBeGreaterThan(0)
    expect(up.y).toBe(mid.y - FAN_LIFT_SELECTED)
    expect(hover.y).toBe(mid.y - FAN_LIFT_HOVER)
  })

  it('compresses a full hand to the measured mobile width', () => {
    const availableWidth = 304
    const cardWidth = 72
    const left = fanPose(17, 0, false, false, availableWidth, cardWidth)
    const right = fanPose(17, 16, false, false, availableWidth, cardWidth)
    expect(fanWidth(17, availableWidth, cardWidth)).toBe(availableWidth)
    expect(right.x - left.x + cardWidth).toBe(availableWidth)
    expect(left.x).toBe(-right.x)
  })

  it('marks red and black jokers by card id', () => {
    expect(jokerTone('RJ')).toBe('red')
    expect(jokerTone('BJ')).toBe('black')
    expect(jokerTone('RJ~1')).toBe('red')
    expect(isJokerCard('SA')).toBe(false)
  })
})
