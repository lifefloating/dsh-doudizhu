import { describe, expect, it } from 'vitest'
import { asHandId, asPlayerId, asRoomId, parseAtoms } from '../../src/types.ts'
import { scoreHand } from '../../src/engine/score.ts'
import { seatCapAtoms } from '../../src/settle/math.ts'

describe('score', () => {
  it('score-default-cap: stake 1M bid 3 no bomb/spring/double', () => {
    const settlement = scoreHand({
      hand: {
        handId: asHandId('hand_1'),
        bid: 3,
        landlordSeat: 0,
        farmerDoubledBySeat: {},
        landlordReDouble: 1,
        mingPaiMult: 1,
        bombCount: 0,
        rocketCount: 0,
        spring: 'none',
      },
      stakeAtoms: 1_000_000n,
      maxMultiplier: 8,
      winner: 'landlord',
      playerIds: [asPlayerId('a'), asPlayerId('b'), asPlayerId('c')],
    })
    expect(parseAtoms(settlement.unitAtoms)).toBe(3_000_000n)
    expect(parseAtoms(settlement.deltas[0].atoms)).toBe(6_000_000n)
    expect(parseAtoms(settlement.deltas[1].atoms)).toBe(-3_000_000n)
    expect(parseAtoms(settlement.deltas[2].atoms)).toBe(-3_000_000n)
    expect(seatCapAtoms(1_000_000n, 8)).toBe(96_000_000n)
    expect(seatCapAtoms(1_000_000n, 8, 4)).toBe(144_000_000n)
    void asRoomId
  })

  it('four-player landlord collects from three farmers', () => {
    const settlement = scoreHand({
      hand: {
        handId: asHandId('hand_4'),
        bid: 3,
        landlordSeat: 0,
        farmerDoubledBySeat: {},
        landlordReDouble: 1,
        mingPaiMult: 1,
        bombCount: 0,
        rocketCount: 0,
        spring: 'none',
      },
      stakeAtoms: 1_000_000n,
      maxMultiplier: 8,
      winner: 'landlord',
      playerIds: [asPlayerId('a'), asPlayerId('b'), asPlayerId('c'), asPlayerId('d')],
    })
    expect(parseAtoms(settlement.unitAtoms)).toBe(3_000_000n)
    expect(parseAtoms(settlement.deltas[0]!.atoms)).toBe(9_000_000n)
    expect(settlement.deltas).toHaveLength(4)
  })
})
