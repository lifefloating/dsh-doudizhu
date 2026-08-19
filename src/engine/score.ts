import {
  asSettlementId, asTokenAtomString, type BidScore, type Hand, type PlayerId,
  type Seat, type Settlement,
} from '../types.ts'
import { formatM } from '../settle/math.ts'

export interface ScoreInput {
  readonly hand: Pick<Hand, 'handId' | 'bid' | 'landlordSeat' | 'farmerDoubledBySeat' | 'landlordReDouble' | 'mingPaiMult' | 'bombCount' | 'rocketCount' | 'spring'>
  readonly stakeAtoms: bigint
  readonly maxMultiplier: number
  readonly winner: 'landlord' | 'farmers'
  readonly playerIds: readonly PlayerId[]
}

function personalMult(value: number | boolean | undefined): bigint {
  if (value === true) return 2n
  if (typeof value === 'number' && value > 1) return BigInt(value)
  return 1n
}

export function scoreHand(input: ScoreInput): Settlement {
  const { hand, stakeAtoms, maxMultiplier, winner, playerIds } = input
  if (hand.landlordSeat === null) throw new Error('cannot score without a landlord')
  if (hand.bid === 0) throw new Error('cannot score a void bid')
  const springFlag = hand.spring === 'none' ? 0 : 1
  const ming = hand.mingPaiMult > 1 ? hand.mingPaiMult : 1
  const raw = Math.max(1, hand.bid) * (2 ** (hand.bombCount + hand.rocketCount + springFlag)) * ming
  const multiplier = Math.min(raw, maxMultiplier)
  const unitAtoms = stakeAtoms * BigInt(multiplier)
  const landlord = hand.landlordSeat
  const landlordPersonal = personalMult(hand.landlordReDouble)
  const farmers = playerIds
    .map((_, index) => index as Seat)
    .filter((seat) => seat !== landlord)
  const farmerPays = new Map<Seat, bigint>()
  for (const seat of farmers) {
    farmerPays.set(seat, unitAtoms * personalMult(hand.farmerDoubledBySeat[seat]) * landlordPersonal)
  }
  const sign = winner === 'landlord' ? 1n : -1n
  const landlordTotal = farmers.reduce((sum, seat) => sum + (farmerPays.get(seat) ?? 0n), 0n)
  const deltas = playerIds.map((playerId, index) => {
    const seat = index as Seat
    if (seat === landlord) return { seat, playerId, atoms: asTokenAtomString(sign * landlordTotal) }
    return { seat, playerId, atoms: asTokenAtomString(-sign * (farmerPays.get(seat) ?? 0n)) }
  })
  const formula = [
    `${formatM(stakeAtoms)} × min(叫抢${hand.bid} × 2^(${hand.bombCount}炸 + ${hand.rocketCount}王炸 + ${springFlag}春天) × 明牌${ming}, ${maxMultiplier})`,
    landlordPersonal > 1n ? `× 地主${landlordPersonal.toString()}` : '',
    `= ${formatM(unitAtoms)}`,
  ].filter(Boolean).join(' ')
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
  return bid === 0 ? '未叫' : `${bid}倍`
}
