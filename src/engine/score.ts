import {
  asSettlementId, asTokenAtomString, type BidScore, type Hand, type PlayerId,
  type Seat, type Settlement,
} from '../types.ts'
import { formatM } from '../settle/math.ts'

export interface ScoreInput {
  readonly hand: Pick<Hand, 'handId' | 'bid' | 'landlordSeat' | 'farmerDoubledBySeat' | 'landlordReDouble' | 'bombCount' | 'rocketCount' | 'spring'>
  readonly stakeAtoms: bigint
  readonly maxMultiplier: number
  readonly winner: 'landlord' | 'farmers'
  readonly playerIds: readonly PlayerId[]
}

export function scoreHand(input: ScoreInput): Settlement {
  const { hand, stakeAtoms, maxMultiplier, winner, playerIds } = input
  if (hand.landlordSeat === null) throw new Error('cannot score without a landlord')
  if (hand.bid === 0) throw new Error('cannot score a void bid')
  const springFlag = hand.spring === 'none' ? 0 : 1
  const reDoubleFlag = hand.landlordReDouble ? 1 : 0
  const raw = 2 ** (hand.bombCount + hand.rocketCount + springFlag + reDoubleFlag)
  const multiplier = Math.min(raw, maxMultiplier)
  const unitAtoms = stakeAtoms * BigInt(hand.bid) * BigInt(multiplier)
  const landlord = hand.landlordSeat
  const farmers = playerIds
    .map((_, index) => index as Seat)
    .filter((seat) => seat !== landlord)
  const farmerPays = new Map<Seat, bigint>()
  for (const seat of farmers) {
    const doubled = hand.farmerDoubledBySeat[seat] === true
    farmerPays.set(seat, unitAtoms * (doubled ? 2n : 1n))
  }
  const sign = winner === 'landlord' ? 1n : -1n
  const landlordTotal = farmers.reduce((sum, seat) => sum + (farmerPays.get(seat) ?? 0n), 0n)
  const deltas = playerIds.map((playerId, index) => {
    const seat = index as Seat
    if (seat === landlord) return { seat, playerId, atoms: asTokenAtomString(sign * landlordTotal) }
    return { seat, playerId, atoms: asTokenAtomString(-sign * (farmerPays.get(seat) ?? 0n)) }
  })
  const formula = [
    `${formatM(stakeAtoms)} × bid ${hand.bid}`,
    `× min(2^(${hand.bombCount} bomb + ${hand.rocketCount} rocket + ${springFlag} spring + ${reDoubleFlag} reDouble), ${maxMultiplier})`,
    `= ${formatM(unitAtoms)}`,
  ].join(' ')
  return {
    settlementId: asSettlementId(`set_${hand.handId}`),
    handId: hand.handId,
    winner,
    unitAtoms: asTokenAtomString(unitAtoms),
    deltas,
    rakeAtoms: asTokenAtomString(0n),
    formula,
  }
}

export function describeBid(bid: BidScore): string {
  return bid === 0 ? '不叫' : `${bid}分`
}
