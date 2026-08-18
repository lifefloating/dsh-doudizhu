import { describe, expect, it } from 'vitest'
import { asCardId, asRoomId, type CardId } from '../../src/types.ts'
import { applyPass, applyPlay, autoTimeout, createHand, type EngineState } from '../../src/engine/play.ts'

function forceHands(state: EngineState, hands: [CardId[], CardId[], CardId[]]): void {
  state.phase = 'playing'
  state.hand.hands = hands
  state.hand.landlordSeat = 0
  state.hand.bid = 3
  state.hand.turnSeat = 0
  state.hand.leadSeat = 0
}

describe('play engine', () => {
  it('lead-no-pass rejects pass on lead', () => {
    const state = createHand(asRoomId('rm_test'), 0, 1)
    forceHands(state, [[asCardId('S3')], [asCardId('S4')], [asCardId('S5')]])
    const result = applyPass(state, 0, 1, new Date().toISOString())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('illegal')
  })

  it('timeout-lead auto plays smallest solo', () => {
    const state = createHand(asRoomId('rm_test'), 0, 1)
    forceHands(state, [[asCardId('S9'), asCardId('S3')], [asCardId('S4')], [asCardId('S5')]])
    const result = autoTimeout(state, 1, new Date().toISOString())
    expect(result?.ok).toBe(true)
    if (result?.ok) expect(result.play.cards).toEqual([asCardId('S3')])
  })

  it('spring-on-lead-empty', () => {
    const state = createHand(asRoomId('rm_test'), 0, 1)
    forceHands(state, [[asCardId('S3')], [asCardId('S4')], [asCardId('S5')]])
    const result = applyPlay(state, 0, [asCardId('S3')], 1, new Date().toISOString())
    expect(result.ok).toBe(true)
    expect(state.hand.spring).toBe('spring')
    expect(state.phase).toBe('settled')
  })

  it('anti-after-one-lead', () => {
    const state = createHand(asRoomId('rm_test'), 0, 1)
    forceHands(state, [
      [asCardId('S3'), asCardId('S9')],
      [asCardId('S4')],
      [asCardId('H4')],
    ])
    expect(applyPlay(state, 0, [asCardId('S3')], 1, new Date().toISOString()).ok).toBe(true)
    expect(applyPlay(state, 1, [asCardId('S4')], 2, new Date().toISOString()).ok).toBe(true)
    expect(state.phase).toBe('settled')
    expect(state.hand.spring).toBe('anti')
  })

  it('four-player laizi deals two decks and two wild ranks', () => {
    const state = createHand(asRoomId('rm_4'), 0, 1, { seatCount: 4, laiZi: true })
    expect(state.seatCount).toBe(4)
    expect(state.hand.hands).toHaveLength(4)
    expect(state.hand.hands.every((hand) => hand.length === 25)).toBe(true)
    expect(state.hand.bottom).toHaveLength(8)
    expect(state.hand.laiZiRanks).toHaveLength(2)
  })
})
