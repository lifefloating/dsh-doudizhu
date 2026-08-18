import { asCardId, type CardId } from '../types.ts'

export const SUITS = ['S', 'H', 'C', 'D'] as const
export const RANK_ORDER = [
  '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', 'BJ', 'RJ',
] as const

export type Suit = typeof SUITS[number]
export type Rank = typeof RANK_ORDER[number]

const RANK_VALUE: Record<string, number> = Object.fromEntries(
  RANK_ORDER.map((rank, index) => [rank, index]),
)

export function cardBase(card: CardId | string): string {
  return String(card).split('~')[0] ?? String(card)
}

export function rankOf(card: CardId): Rank {
  const raw = cardBase(card)
  if (raw === 'BJ' || raw === 'RJ') return raw
  if (raw.startsWith('S') || raw.startsWith('H') || raw.startsWith('C') || raw.startsWith('D')) {
    return raw.slice(1) as Rank
  }
  throw new Error(`invalid card: ${raw}`)
}

export function suitOf(card: CardId): Suit | null {
  const raw = cardBase(card)
  if (raw === 'BJ' || raw === 'RJ') return null
  return raw[0] as Suit
}

export function rankValue(rank: string): number {
  const value = RANK_VALUE[rank]
  if (value === undefined) throw new Error(`invalid rank: ${rank}`)
  return value
}

export function cardValue(card: CardId): number {
  return rankValue(rankOf(card))
}

export function compareCards(a: CardId, b: CardId): number {
  const byRank = cardValue(a) - cardValue(b)
  if (byRank !== 0) return byRank
  return a.localeCompare(b)
}

export function sortCards(cards: readonly CardId[]): CardId[] {
  return [...cards].sort(compareCards)
}

export function fullDeck(copy = 0): CardId[] {
  const suffix = copy === 0 ? '' : `~${copy}`
  const cards: CardId[] = []
  for (const suit of SUITS) {
    for (const rank of RANK_ORDER) {
      if (rank === 'BJ' || rank === 'RJ') continue
      cards.push(asCardId(`${suit}${rank}${suffix}`))
    }
  }
  cards.push(asCardId(`BJ${suffix}`), asCardId(`RJ${suffix}`))
  return cards
}

export function stackedDeck(decks: 1 | 2): CardId[] {
  const cards: CardId[] = []
  for (let copy = 0; copy < decks; copy += 1) cards.push(...fullDeck(copy))
  return cards
}

export const WILDABLE_RANKS = RANK_ORDER.filter((rank) => rank !== 'BJ' && rank !== 'RJ')

export function isJokerRank(rank: Rank): boolean {
  return rank === 'BJ' || rank === 'RJ'
}

export function isWildCard(card: CardId, wildRanks: readonly string[]): boolean {
  if (wildRanks.length === 0) return false
  const rank = rankOf(card)
  return !isJokerRank(rank) && wildRanks.includes(rank)
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const a = next[i]
    const b = next[j]
    if (a === undefined || b === undefined) continue
    next[i] = b
    next[j] = a
  }
  return next
}

export function parseCardId(raw: string): CardId | null {
  if (/^(BJ|RJ)(?:~\d+)?$/.test(raw)) return asCardId(raw)
  const match = /^(S|H|C|D)(10|[3-9JQKA2])(?:~\d+)?$/.exec(raw)
  return match ? asCardId(raw) : null
}

export function countRanks(cards: readonly CardId[]): Map<Rank, CardId[]> {
  const groups = new Map<Rank, CardId[]>()
  for (const card of cards) {
    const rank = rankOf(card)
    const bucket = groups.get(rank)
    if (bucket) bucket.push(card)
    else groups.set(rank, [card])
  }
  return groups
}

export function isNaturalSeqRank(rank: Rank): boolean {
  return rank !== '2' && rank !== 'BJ' && rank !== 'RJ'
}
