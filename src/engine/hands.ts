import type { CardId, HandType, LegalCombo } from '../types.ts'
import { asCardId } from '../types.ts'
import {
  cardValue, countRanks, isJokerRank, isNaturalSeqRank, isWildCard, rankOf, rankValue, sortCards,
  WILDABLE_RANKS, type Rank,
} from './cards.ts'

export interface ClassifiedHand {
  readonly type: Exclude<HandType, 'pass'>
  readonly cards: readonly CardId[]
  readonly key: number
  readonly length: number
  readonly wingLength: number
  readonly wild?: boolean
}

export function classify(cards: readonly CardId[], laiZiRanks: readonly string[] = []): ClassifiedHand | null {
  if (laiZiRanks.length === 0) return classifyNatural(cards)
  const wilds: CardId[] = []
  const naturals: CardId[] = []
  for (const card of cards) {
    if (isWildCard(card, laiZiRanks)) wilds.push(card)
    else naturals.push(card)
  }
  if (wilds.length === 0) return classifyNatural(cards)
  return classifyWithWilds(cards, naturals, wilds.length)
}

function classifyNatural(cards: readonly CardId[]): ClassifiedHand | null {
  const sorted = sortCards(cards)
  if (sorted.length === 0) return null
  const ranks = countRanks(sorted)
  const entries = [...ranks.entries()].sort((a, b) => rankValue(a[0]) - rankValue(b[0]))

  if (jokerCount(ranks) === sorted.length && sorted.length >= 2) {
    return { type: 'rocket', cards: sorted, key: rankValue('RJ'), length: sorted.length, wingLength: 0 }
  }
  if (sorted.length === 1) {
    return { type: 'solo', cards: sorted, key: cardValue(sorted[0]!), length: 1, wingLength: 0 }
  }
  if (sorted.length === 2 && entries.length === 1) {
    return { type: 'pair', cards: sorted, key: rankValue(entries[0]![0]), length: 2, wingLength: 0 }
  }
  if (sorted.length === 3 && entries.length === 1) {
    return { type: 'trio', cards: sorted, key: rankValue(entries[0]![0]), length: 3, wingLength: 0 }
  }
  if (sorted.length >= 4 && entries.length === 1) {
    return { type: 'bomb', cards: sorted, key: rankValue(entries[0]![0]), length: sorted.length, wingLength: 0 }
  }

  const trioSolo = classifyTrioSolo(sorted, entries)
  if (trioSolo) return trioSolo
  const trioPair = classifyTrioPair(sorted, entries)
  if (trioPair) return trioPair
  const seq = classifySeq(sorted, entries)
  if (seq) return seq
  const seqPair = classifySeqPair(sorted, entries)
  if (seqPair) return seqPair
  const plane = classifyBarePlane(sorted, entries)
  if (plane) return plane
  const planePair = classifyPlanePair(sorted, entries)
  if (planePair) return planePair
  const planeSolo = classifyPlaneSolo(sorted, entries)
  if (planeSolo) return planeSolo
  const fourDualPair = classifyFourDualPair(sorted, entries)
  if (fourDualPair) return fourDualPair
  const fourDualSolo = classifyFourDualSolo(sorted, entries)
  if (fourDualSolo) return fourDualSolo
  return null
}

export function beats(prev: ClassifiedHand, next: ClassifiedHand, decks: 1 | 2 = 1): boolean {
  const nextBomb = next.type === 'bomb' || next.type === 'rocket'
  const prevBomb = prev.type === 'bomb' || prev.type === 'rocket'
  if (next.type === 'rocket' && decks === 1) return prev.type !== 'rocket'
  if (prev.type === 'rocket' && decks === 1) return false
  if (nextBomb && prevBomb) {
    if (next.length !== prev.length) return next.length > prev.length
    if (!!next.wild !== !!prev.wild) return !next.wild && !!prev.wild
    if (next.type !== prev.type) return next.type === 'rocket'
    return next.key > prev.key
  }
  if (nextBomb) return true
  if (prevBomb) return false
  if (next.type !== prev.type || next.length !== prev.length || next.wingLength !== prev.wingLength) {
    return false
  }
  return next.key > prev.key
}

export function enumerateLegal(
  hand: readonly CardId[],
  lead: ClassifiedHand | null,
  laiZiRanks: readonly string[] = [],
  decks: 1 | 2 = 1,
): LegalCombo[] {
  const sorted = sortCards(hand)
  const combos: LegalCombo[] = []
  const seen = new Set<string>()
  const push = (type: Exclude<HandType, 'pass'>, cards: readonly CardId[]): void => {
    const key = `${type}:${sortCards(cards).join(',')}`
    if (seen.has(key)) return
    seen.add(key)
    combos.push({ type, cards: sortCards(cards) })
  }

  if (lead === null) {
    for (const subset of generateCandidates(sorted)) {
      const classified = classify(subset, laiZiRanks)
      if (classified) push(classified.type, classified.cards)
    }
    return capCombos(combos)
  }

  if (!(lead.type === 'rocket' && decks === 1)) {
    for (const bomb of findBombs(sorted, laiZiRanks)) {
      const classified = classify(bomb, laiZiRanks)
      if (classified && beats(lead, classified, decks)) push(classified.type, classified.cards)
    }
    const rocket = sorted.filter((card) => isJokerRank(rankOf(card)))
    if (rocket.length >= 2) push('rocket', rocket)
  }

  for (const subset of generateFollowCandidates(sorted, lead)) {
    const classified = classify(subset, laiZiRanks)
    if (classified && beats(lead, classified, decks)) push(classified.type, classified.cards)
  }
  return capCombos(combos)
}

export function smallestSolo(hand: readonly CardId[]): CardId | null {
  const sorted = sortCards(hand)
  return sorted[0] ?? null
}

function classifyTrioSolo(
  cards: readonly CardId[],
  entries: readonly [Rank, CardId[]][],
): ClassifiedHand | null {
  if (cards.length !== 4) return null
  const trio = entries.find(([, group]) => group.length === 3)
  const kicker = entries.find(([, group]) => group.length === 1)
  if (!trio || !kicker) return null
  if (kicker[0] === 'BJ' && entries.some(([rank]) => rank === 'RJ')) return null
  if (kicker[0] === 'RJ' && entries.some(([rank]) => rank === 'BJ')) return null
  return { type: 'trioSolo', cards, key: rankValue(trio[0]), length: 4, wingLength: 1 }
}

function classifyTrioPair(
  cards: readonly CardId[],
  entries: readonly [Rank, CardId[]][],
): ClassifiedHand | null {
  if (cards.length !== 5) return null
  const trio = entries.find(([, group]) => group.length === 3)
  const pair = entries.find(([, group]) => group.length === 2)
  if (!trio || !pair || pair[0] === trio[0]) return null
  return { type: 'trioPair', cards, key: rankValue(trio[0]), length: 5, wingLength: 2 }
}

function classifySeq(
  cards: readonly CardId[],
  entries: readonly [Rank, CardId[]][],
): ClassifiedHand | null {
  if (cards.length < 5) return null
  if (!entries.every(([, group]) => group.length === 1)) return null
  if (!isConsecutive(entries.map(([rank]) => rank), 1)) return null
  return {
    type: 'seq',
    cards,
    key: rankValue(entries[entries.length - 1]![0]),
    length: cards.length,
    wingLength: 0,
  }
}

function classifySeqPair(
  cards: readonly CardId[],
  entries: readonly [Rank, CardId[]][],
): ClassifiedHand | null {
  if (cards.length < 6 || cards.length % 2 !== 0) return null
  if (!entries.every(([, group]) => group.length === 2)) return null
  if (!isConsecutive(entries.map(([rank]) => rank), 1)) return null
  if (entries.length < 3) return null
  return {
    type: 'seqPair',
    cards,
    key: rankValue(entries[entries.length - 1]![0]),
    length: cards.length,
    wingLength: 0,
  }
}

function classifyBarePlane(
  cards: readonly CardId[],
  entries: readonly [Rank, CardId[]][],
): ClassifiedHand | null {
  const trios = entries.filter(([, group]) => group.length === 3).map(([rank]) => rank)
  if (trios.length < 2) return null
  if (entries.some(([, group]) => group.length !== 3)) return null
  if (!isConsecutive(trios, 1)) return null
  return {
    type: 'plane',
    cards,
    key: rankValue(trios[trios.length - 1]!),
    length: cards.length,
    wingLength: 0,
  }
}

export function classifyPlaneSolo(
  cards: readonly CardId[],
  entries: readonly [Rank, CardId[]][] = [...countRanks(cards).entries()].sort(
    (a, b) => rankValue(a[0]) - rankValue(b[0]),
  ),
): ClassifiedHand | null {
  const available = entries
    .filter(([rank, group]) => group.length >= 3 && isNaturalSeqRank(rank) && rank !== '2')
    .map(([rank]) => rank)
    .sort((a, b) => rankValue(a) - rankValue(b))
  const maxK = Math.min(available.length, Math.floor(cards.length / 4))
  for (let k = maxK; k >= 2; k -= 1) {
    if (cards.length !== k * 4) continue
    const found: ClassifiedHand[] = []
    for (const body of consecutiveRuns(available, k)) {
      const leftover = leftoverAfterBody(cards, body, 3)
      if (leftover.length !== k) continue
      if (containsConsecutiveTrios(leftover)) continue
      found.push({
        type: 'planeSolo',
        cards,
        key: rankValue(body[body.length - 1]!),
        length: cards.length,
        wingLength: k,
      })
    }
    if (found.length > 0) {
      found.sort((a, b) => b.key - a.key)
      return found[0] ?? null
    }
  }
  return null
}

function classifyPlanePair(
  cards: readonly CardId[],
  entries: readonly [Rank, CardId[]][],
): ClassifiedHand | null {
  const trios = entries.filter(([, group]) => group.length >= 3 && isNaturalSeqRank(group[0] ? rankOf(group[0]) : '3') && rankOf(group[0]!) !== '2')
  const trioRanks = entries
    .filter(([rank, group]) => group.length >= 3 && isNaturalSeqRank(rank) && rank !== '2')
    .map(([rank]) => rank)
    .sort((a, b) => rankValue(a) - rankValue(b))
  for (let k = Math.min(trioRanks.length, Math.floor(cards.length / 5)); k >= 2; k -= 1) {
    if (cards.length !== k * 5) continue
    for (const body of consecutiveRuns(trioRanks, k)) {
      const leftoverPairs = pairWings(cards, body)
      if (leftoverPairs === k) {
        return {
          type: 'planePair',
          cards,
          key: rankValue(body[body.length - 1]!),
          length: cards.length,
          wingLength: k,
        }
      }
    }
  }
  void trios
  return null
}

function classifyFourDualSolo(
  cards: readonly CardId[],
  entries: readonly [Rank, CardId[]][],
): ClassifiedHand | null {
  if (cards.length !== 6) return null
  const quad = entries.find(([, group]) => group.length === 4)
  if (!quad) return null
  const leftovers = cards.filter((card) => rankOf(card) !== quad[0])
  if (leftovers.length !== 2) return null
  if (hasRocket(countRanks(leftovers))) return null
  return { type: 'fourDualSolo', cards, key: rankValue(quad[0]), length: 6, wingLength: 2 }
}

function classifyFourDualPair(
  cards: readonly CardId[],
  entries: readonly [Rank, CardId[]][],
): ClassifiedHand | null {
  if (cards.length !== 8) return null
  const quad = entries.find(([, group]) => group.length === 4)
  if (!quad) return null
  const leftover = leftoverAfterBody(cards, [quad[0]], 4)
  const leftoverGroups = [...countRanks(leftover).entries()]
  if (leftoverGroups.some(([rank, group]) => rank === quad[0] || group.length !== 2)) return null
  if (leftoverGroups.length !== 2) return null
  return { type: 'fourDualPair', cards, key: rankValue(quad[0]), length: 8, wingLength: 4 }
}

function hasRocket(ranks: Map<Rank, CardId[]>): boolean {
  return (ranks.get('BJ')?.length ?? 0) >= 1 && (ranks.get('RJ')?.length ?? 0) >= 1
}

function jokerCount(ranks: Map<Rank, CardId[]>): number {
  return (ranks.get('BJ')?.length ?? 0) + (ranks.get('RJ')?.length ?? 0)
}

function classifyWithWilds(original: readonly CardId[], naturals: readonly CardId[], wildCount: number): ClassifiedHand | null {
  if (wildCount <= 0) return classifyNatural(original)
  const ranksToTry = wildAssignmentRanks(naturals, wildCount)
  let best: ClassifiedHand | null = null
  const choice = new Array<number>(wildCount).fill(0)
  const walk = (): void => {
    const virtuals = choice.map((index) => asCardId(`S${ranksToTry[index]}`))
    const result = classifyNatural([...naturals, ...virtuals])
    if (!result) return
    const hand: ClassifiedHand = { ...result, cards: sortCards(original), wild: true }
    if (!best || wildPreference(hand, best) > 0) best = hand
  }
  const rec = (depth: number): void => {
    if (depth === wildCount) {
      walk()
      return
    }
    for (let i = 0; i < ranksToTry.length; i += 1) {
      choice[depth] = i
      rec(depth + 1)
    }
  }
  rec(0)
  return best
}

function wildAssignmentRanks(naturals: readonly CardId[], wildCount: number): Rank[] {
  if (naturals.length === 0) return wildCount >= 4 ? ['2'] : [...WILDABLE_RANKS]
  const present = new Set(naturals.map((card) => rankOf(card)))
  if (wildCount >= 5) {
    return WILDABLE_RANKS.filter((rank) => present.has(rank) || neighborsOf(present).has(rank))
  }
  return [...WILDABLE_RANKS]
}

function neighborsOf(present: Set<Rank>): Set<Rank> {
  const out = new Set<Rank>()
  for (const rank of present) {
    const value = rankValue(rank)
    for (const candidate of WILDABLE_RANKS) {
      if (Math.abs(rankValue(candidate) - value) === 1) out.add(candidate)
    }
  }
  return out
}

function wildPreference(next: ClassifiedHand, prev: ClassifiedHand): number {
  const bombScore = (hand: ClassifiedHand): number => {
    if (hand.type === 'rocket') return 200 + hand.length
    if (hand.type === 'bomb') return 100 + hand.length
    return 0
  }
  const byBomb = bombScore(next) - bombScore(prev)
  if (byBomb !== 0) return byBomb
  if (next.length !== prev.length) return next.length - prev.length
  return next.key - prev.key
}

function isConsecutive(ranks: readonly Rank[], step: number): boolean {
  if (ranks.some((rank) => !isNaturalSeqRank(rank))) return false
  for (let i = 1; i < ranks.length; i += 1) {
    if (rankValue(ranks[i]!) - rankValue(ranks[i - 1]!) !== step) return false
  }
  return ranks.length > 0
}

function consecutiveRuns(ranks: readonly Rank[], length: number): Rank[][] {
  const runs: Rank[][] = []
  for (let i = 0; i + length <= ranks.length; i += 1) {
    const slice = ranks.slice(i, i + length)
    if (isConsecutive(slice, 1)) runs.push(slice)
  }
  return runs
}

function containsConsecutiveTrios(cards: readonly CardId[]): boolean {
  const groups = [...countRanks(cards).entries()]
    .filter(([, group]) => group.length >= 3)
    .map(([rank]) => rank)
    .filter((rank) => isNaturalSeqRank(rank) && rank !== '2')
    .sort((a, b) => rankValue(a) - rankValue(b))
  return consecutiveRuns(groups, 2).length > 0
}

function pairWings(cards: readonly CardId[], body: readonly Rank[]): number | null {
  const leftover = leftoverAfterBody(cards, body, 3)
  const groups = countRanks(leftover)
  if ([...groups.values()].some((group) => group.length !== 2 && group.length !== 4)) return null
  let pairs = 0
  for (const [rank, group] of groups) {
    if (body.includes(rank)) return null
    if (group.length === 2) pairs += 1
    else if (group.length === 4) pairs += 2
    else return null
  }
  return pairs
}

function leftoverAfterBody(cards: readonly CardId[], body: readonly Rank[], take: number): CardId[] {
  const used = new Map<Rank, number>()
  for (const rank of body) used.set(rank, take)
  const leftover: CardId[] = []
  for (const card of cards) {
    const rank = rankOf(card)
    const remaining = used.get(rank) ?? 0
    if (remaining > 0) used.set(rank, remaining - 1)
    else leftover.push(card)
  }
  return leftover
}

function findBombs(hand: readonly CardId[], laiZiRanks: readonly string[] = []): CardId[][] {
  const bombs: CardId[][] = []
  const ranks = countRanks(hand)
  const wilds = laiZiRanks.length === 0
    ? []
    : hand.filter((card) => isWildCard(card, laiZiRanks))
  for (const [rank, group] of ranks) {
    if (isJokerRank(rank)) continue
    const natural = laiZiRanks.includes(rank)
      ? group.filter((card) => !isWildCard(card, laiZiRanks))
      : group
    const total = natural.length + wilds.length
    if (natural.length + (laiZiRanks.includes(rank) ? 0 : 0) >= 4 || total >= 4) {
      if (natural.length >= 4) bombs.push(natural.slice(0, Math.max(4, natural.length)))
      if (wilds.length > 0 && total >= 4) bombs.push([...natural, ...wilds].slice(0, total))
    }
  }
  const jokers = hand.filter((card) => isJokerRank(rankOf(card)))
  if (jokers.length >= 2) bombs.push(jokers)
  return bombs
}

function generateCandidates(hand: readonly CardId[]): CardId[][] {
  const out: CardId[][] = []
  const ranks = countRanks(hand)
  for (const group of ranks.values()) {
    for (let n = 1; n <= group.length; n += 1) out.push(group.slice(0, n))
  }
  const rocket = hand.filter((card) => isJokerRank(rankOf(card)))
  if (rocket.length === 2) out.push(rocket)
  appendSeqs(out, ranks, 1, 5)
  appendSeqs(out, ranks, 2, 3)
  appendPlanes(out, hand, ranks)
  appendKickers(out, hand, ranks)
  return out
}

function generateFollowCandidates(hand: readonly CardId[], lead: ClassifiedHand): CardId[][] {
  return generateCandidates(hand).filter((subset) => subset.length === lead.length)
}

function appendSeqs(
  out: CardId[][],
  ranks: Map<Rank, CardId[]>,
  copies: number,
  minLen: number,
): void {
  const usable = [...ranks.entries()]
    .filter(([rank, group]) => isNaturalSeqRank(rank) && group.length >= copies)
    .sort((a, b) => rankValue(a[0]) - rankValue(b[0]))
  for (let len = minLen; len <= usable.length; len += 1) {
    for (let i = 0; i + len <= usable.length; i += 1) {
      const slice = usable.slice(i, i + len)
      if (!isConsecutive(slice.map(([rank]) => rank), 1)) continue
      out.push(slice.flatMap(([, group]) => group.slice(0, copies)))
    }
  }
}

function appendPlanes(out: CardId[][], hand: readonly CardId[], ranks: Map<Rank, CardId[]>): void {
  const trioRanks = [...ranks.entries()]
    .filter(([rank, group]) => group.length >= 3 && isNaturalSeqRank(rank) && rank !== '2')
    .map(([rank]) => rank)
    .sort((a, b) => rankValue(a) - rankValue(b))
  for (let k = 2; k <= trioRanks.length; k += 1) {
    for (const body of consecutiveRuns(trioRanks, k)) {
      const bodyCards = leftoverInverse(hand, body, 3)
      out.push(bodyCards)
      const rest = leftoverAfterBody(hand, body, 3)
      for (const wings of combinations(rest, k)) out.push([...bodyCards, ...wings])
      const pairs = pairCombinations(rest, k)
      for (const wings of pairs) out.push([...bodyCards, ...wings])
    }
  }
}

function leftoverInverse(hand: readonly CardId[], body: readonly Rank[], take: number): CardId[] {
  const used = new Map<Rank, number>()
  for (const rank of body) used.set(rank, take)
  const taken: CardId[] = []
  for (const card of hand) {
    const rank = rankOf(card)
    const remaining = used.get(rank) ?? 0
    if (remaining > 0) {
      used.set(rank, remaining - 1)
      taken.push(card)
    }
  }
  return taken
}

function appendKickers(out: CardId[][], hand: readonly CardId[], ranks: Map<Rank, CardId[]>): void {
  for (const [rank, group] of ranks) {
    if (group.length >= 3) {
      const trio = group.slice(0, 3)
      for (const card of hand) {
        if (rankOf(card) === rank) continue
        out.push([...trio, card])
      }
      for (const [other, otherGroup] of ranks) {
        if (other === rank || otherGroup.length < 2) continue
        out.push([...trio, ...otherGroup.slice(0, 2)])
      }
    }
    if (group.length === 4) {
      const rest = hand.filter((card) => rankOf(card) !== rank)
      for (const wings of combinations(rest, 2)) out.push([...group, ...wings])
      const pairRanks = [...ranks.entries()].filter(([r, g]) => r !== rank && g.length >= 2)
      for (let i = 0; i < pairRanks.length; i += 1) {
        for (let j = i + 1; j < pairRanks.length; j += 1) {
          out.push([
            ...group,
            ...pairRanks[i]![1].slice(0, 2),
            ...pairRanks[j]![1].slice(0, 2),
          ])
        }
      }
    }
  }
}

function combinations(items: readonly CardId[], k: number): CardId[][] {
  const out: CardId[][] = []
  const walk = (start: number, acc: CardId[]): void => {
    if (acc.length === k) {
      out.push([...acc])
      return
    }
    for (let i = start; i < items.length; i += 1) {
      acc.push(items[i]!)
      walk(i + 1, acc)
      acc.pop()
    }
  }
  if (k <= items.length) walk(0, [])
  return out
}

function pairCombinations(items: readonly CardId[], k: number): CardId[][] {
  const groups = [...countRanks(items).entries()].filter(([, group]) => group.length >= 2)
  const out: CardId[][] = []
  const walk = (start: number, acc: CardId[], taken: number): void => {
    if (taken === k) {
      out.push([...acc])
      return
    }
    for (let i = start; i < groups.length; i += 1) {
      const group = groups[i]![1]
      acc.push(...group.slice(0, 2))
      walk(i + 1, acc, taken + 1)
      acc.splice(acc.length - 2, 2)
      if (group.length >= 4 && taken + 2 <= k) {
        acc.push(...group.slice(0, 4))
        walk(i + 1, acc, taken + 2)
        acc.splice(acc.length - 4, 4)
      }
    }
  }
  walk(0, [], 0)
  return out
}

function capCombos(combos: LegalCombo[]): LegalCombo[] {
  if (combos.length <= 200) return combos
  return combos.slice(0, 200)
}
