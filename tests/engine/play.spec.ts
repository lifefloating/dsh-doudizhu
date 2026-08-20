import { describe, expect, it } from 'vitest'
import { asCardId, asRoomId, type CardId } from '../../src/types.ts'
import { applyBid, applyDouble, applyMingPai, applyPass, applyPlay, autoTimeout, createHand, doubleAnswerOf, type EngineState } from '../../src/engine/play.ts'

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

  it('timeout-follow auto plays the cheapest legal beat instead of passing', () => {
    const state = createHand(asRoomId('rm_follow'), 0, 1)
    forceHands(state, [
      [asCardId('S3'), asCardId('SK')],
      [asCardId('S5'), asCardId('H5'), asCardId('S9'), asCardId('S2')],
      [asCardId('S4'), asCardId('SQ')],
    ])
    expect(applyPlay(state, 0, [asCardId('S3')], 1, new Date().toISOString()).ok).toBe(true)
    expect(state.phase).toBe('playing')
    const result = autoTimeout(state, 2, new Date().toISOString())
    expect(result?.ok).toBe(true)
    if (result?.ok) {
      expect(result.play.type).toBe('solo')
      expect(result.play.cards).toHaveLength(1)
      expect(String(result.play.cards[0]).endsWith('5')).toBe(true)
    }
    expect(state.hand.turnSeat).toBe(2)
    expect(state.phase).toBe('playing')
  })

  it('timeout-follow passes when nothing beats the lead', () => {
    const state = createHand(asRoomId('rm_pass'), 0, 1)
    forceHands(state, [
      [asCardId('S2'), asCardId('SK')],
      [asCardId('S3'), asCardId('S4')],
      [asCardId('S5'), asCardId('SQ')],
    ])
    expect(applyPlay(state, 0, [asCardId('S2')], 1, new Date().toISOString()).ok).toBe(true)
    expect(state.phase).toBe('playing')
    const result = autoTimeout(state, 2, new Date().toISOString())
    expect(result?.ok).toBe(true)
    if (result?.ok) expect(result.play.type).toBe('pass')
    expect(state.hand.hands[1]).toEqual([asCardId('S3'), asCardId('S4')])
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

  it('call-then-rob doubles the public multiplier; last robber is landlord', () => {
    const state = createHand(asRoomId('rm_bid'), 0, 1)
    expect(applyBid(state, 0, 'call').ok).toBe(true)
    expect(state.hand.bid).toBe(1)
    expect(applyBid(state, 1, 'rob').ok).toBe(true)
    expect(state.hand.bid).toBe(2)
    expect(applyBid(state, 2, 'rob').ok).toBe(true)
    expect(state.hand.bid).toBe(4)
    expect(state.hand.landlordSeat).toBe(2)
    expect(state.phase).toBe('doubling')
  })

  it('nobody robbing leaves the caller as landlord', () => {
    const state = createHand(asRoomId('rm_norob'), 0, 1)
    expect(applyBid(state, 0, 'call').ok).toBe(true)
    expect(applyBid(state, 1, 'pass').ok).toBe(true)
    expect(applyBid(state, 2, 'pass').ok).toBe(true)
    expect(state.hand.landlordSeat).toBe(0)
    expect(state.hand.bid).toBe(1)
    expect(state.phase).toBe('doubling')
  })

  it('caller does not get a second rob after others have answered', () => {
    const state = createHand(asRoomId('rm_noback'), 0, 1)
    expect(applyBid(state, 0, 'call').ok).toBe(true)
    expect(applyBid(state, 1, 'rob').ok).toBe(true)
    expect(applyBid(state, 2, 'pass').ok).toBe(true)
    expect(state.hand.landlordSeat).toBe(1)
    expect(state.hand.bid).toBe(2)
    const again = applyBid(state, 0, 'rob')
    expect(again.ok).toBe(false)
  })

  it('third player calling after two passes becomes landlord', () => {
    const state = createHand(asRoomId('rm_last'), 0, 1)
    expect(applyBid(state, 0, 'pass').ok).toBe(true)
    expect(applyBid(state, 1, 'pass').ok).toBe(true)
    expect(applyBid(state, 2, 'call').ok).toBe(true)
    expect(state.hand.landlordSeat).toBe(2)
    expect(state.phase).toBe('doubling')
  })

  it('all pass during the call round redeals', () => {
    const state = createHand(asRoomId('rm_redeal'), 0, 1)
    expect(applyBid(state, 0, 'pass').ok).toBe(true)
    expect(applyBid(state, 1, 'pass').ok).toBe(true)
    expect(applyBid(state, 2, 'pass').ok).toBe(true)
    expect(state.phase).toBe('redeal')
    expect(state.hand.landlordSeat).toBeNull()
  })

  it('ming pai during the call round is ×3 and keeps the highest later multiplier', () => {
    const state = createHand(asRoomId('rm_mingmax'), 0, 1)
    expect(applyMingPai(state, 0).ok).toBe(true)
    expect(state.hand.mingPaiMult).toBe(3)
    expect(applyMingPai(state, 1).ok).toBe(true)
    expect(state.hand.mingPaiMult).toBe(3)
  })

  it('keeps doubling until every seat has answered, then starts play', () => {
    const state = createHand(asRoomId('rm_double'), 0, 1)
    expect(applyBid(state, 0, 'pass').ok).toBe(true)
    expect(applyBid(state, 1, 'pass').ok).toBe(true)
    expect(applyBid(state, 2, 'call').ok).toBe(true)
    expect(state.phase).toBe('doubling')
    expect(state.hand.landlordSeat).toBe(2)
    expect(doubleAnswerOf(state, 0)).toBeNull()
    expect(applyDouble(state, 0, 'double').ok).toBe(true)
    expect(doubleAnswerOf(state, 0)).toBe('double')
    expect(state.phase).toBe('doubling')
    expect(applyDouble(state, 1, 'pass').ok).toBe(true)
    expect(doubleAnswerOf(state, 1)).toBe('pass')
    expect(state.phase).toBe('doubling')
    expect(applyDouble(state, 2, 'reDouble').ok).toBe(true)
    expect(state.phase).toBe('playing')
    expect(doubleAnswerOf(state, 2)).toBeNull()
  })

  it('landlord can ming pai after taking the bottom, farmers cannot', () => {
    const state = createHand(asRoomId('rm_ming'), 0, 1)
    expect(applyBid(state, 0, 'pass').ok).toBe(true)
    expect(applyBid(state, 1, 'pass').ok).toBe(true)
    expect(applyBid(state, 2, 'call').ok).toBe(true)
    expect(state.phase).toBe('doubling')
    expect(applyMingPai(state, 0).ok).toBe(false)
    expect(applyMingPai(state, 2).ok).toBe(true)
    expect(state.hand.mingPaiMult).toBe(2)
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
