import { describe, expect, it } from 'vitest'
import { asCardId, type CardId } from '../../src/types.ts'
import { classify, enumerateLegal } from '../../src/engine/hands.ts'

function C(...ids: string[]): CardId[] {
  return ids.map(asCardId)
}

describe('hand classification', () => {
  it('lead-no-pass: pass is not a classified hand', () => {
    expect(classify([])).toBeNull()
  })

  it('plane-wings-ambig prefers max k=3 body 345 with wings 678', () => {
    const cards = C('S3', 'H3', 'C3', 'S4', 'H4', 'C4', 'S5', 'H5', 'C5', 'S6', 'S7', 'S8')
    const hand = classify(cards)
    expect(hand?.type).toBe('planeSolo')
    expect(hand?.wingLength).toBe(3)
    expect(hand?.key).toBe(2) // 5
  })

  it('plane-reject-wing-plane: bare 333444555666 is plane k=4', () => {
    const cards = C('S3', 'H3', 'C3', 'S4', 'H4', 'C4', 'S5', 'H5', 'C5', 'S6', 'H6', 'C6')
    const hand = classify(cards)
    expect(hand?.type).toBe('plane')
    expect(hand?.key).toBe(3) // 6
  })

  it('four-dual-pair-ok', () => {
    const cards = C('SA', 'HA', 'CA', 'DA', 'S3', 'H3', 'S5', 'H5')
    expect(classify(cards)?.type).toBe('fourDualPair')
  })

  it('four-dual-solo-pair-kicker', () => {
    const cards = C('SA', 'HA', 'CA', 'DA', 'S3', 'H3')
    expect(classify(cards)?.type).toBe('fourDualSolo')
  })

  it('four-no-rocket-kickers', () => {
    const cards = C('SA', 'HA', 'CA', 'DA', 'BJ', 'RJ')
    expect(classify(cards)).toBeNull()
  })

  it('cannot pass when leading: legal list has no pass type', () => {
    const combos = enumerateLegal(C('S3', 'S4'), null)
    expect(combos.every((combo) => combo.type !== 'pass')).toBe(true)
  })

  it('laizi wild fills a missing 6 in 34567', () => {
    const cards = C('S3', 'S4', 'S5', 'H7', 'D2')
    const hand = classify(cards, ['2'])
    expect(hand?.type).toBe('seq')
    expect(hand?.wild).toBe(true)
  })

  it('four-player stacked ids still classify as a pair', () => {
    expect(classify(C('S3', 'S3~1'))?.type).toBe('pair')
  })
})
