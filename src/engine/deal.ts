import { asCardId, holeCount, type CardId, type Seat, type SeatCount } from '../types.ts'
import { stackedDeck, shuffle, WILDABLE_RANKS, type Rank } from './cards.ts'
import { cryptoUnit } from './random.ts'

export interface Deal {
  readonly hands: readonly CardId[][]
  readonly bottom: readonly CardId[]
}

export function dealCards(seatCount: SeatCount = 3, random: () => number = cryptoUnit): Deal {
  const decks = seatCount === 3 ? 1 : 2
  const deck = shuffle(stackedDeck(decks), random)
  const hole = holeCount(seatCount)
  const per = (deck.length - hole) / seatCount
  const hands = Array.from({ length: seatCount }, (_, index) => (
    deck.slice(index * per, (index + 1) * per).map(asCardId)
  ))
  return {
    hands,
    bottom: deck.slice(seatCount * per, seatCount * per + hole).map(asCardId),
  }
}

export function giveBottom(hands: readonly CardId[][], bottom: readonly CardId[], landlord: Seat): CardId[][] {
  return hands.map((hand, index) => (index === landlord ? [...hand, ...bottom] : [...hand]))
}

export function randomSeat(count: SeatCount = 3, random: () => number = cryptoUnit): Seat {
  return Math.floor(random() * count) as Seat
}

export function pickLaiZiRanks(count: 1 | 2, random: () => number = cryptoUnit, exclude: readonly string[] = []): Rank[] {
  const pool = WILDABLE_RANKS.filter((rank) => !exclude.includes(rank))
  const picked: Rank[] = []
  const available = [...pool]
  for (let i = 0; i < count && available.length > 0; i += 1) {
    const index = Math.floor(random() * available.length)
    const rank = available.splice(index, 1)[0]
    if (rank) picked.push(rank)
  }
  return picked
}
