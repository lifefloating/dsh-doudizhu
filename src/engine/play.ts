import {
  asHandId, decksFor, nextSeat, type BidScore, type CardId,
  type Hand, type HandId, type Play, type RoomId, type Seat, type SeatCount,
} from '../types.ts'
import { sortCards } from './cards.ts'
import { dealCards, giveBottom, pickLaiZiRanks, randomSeat } from './deal.ts'
import { beats, classify, enumerateLegal, smallestSolo, type ClassifiedHand } from './hands.ts'

export type EnginePhase = 'bidding' | 'doubling' | 'playing' | 'settled' | 'redeal'

export interface EngineState {
  phase: EnginePhase
  seatCount: SeatCount
  laiZi: boolean
  hand: MutableHand
  firstLeadSeq: number | null
  successfulLandlordPlaysAfterLead: number
  farmerPlayed: boolean[]
  bids: Array<BidScore | null>
  bidTurn: Seat
  highestBid: BidScore
  highestBidder: Seat | null
  passesInRow: number
  doubleDeadlineAt: number
  farmerDoubleDone: boolean[]
  landlordDoubleDone: boolean
}

export interface MutableHand {
  handId: Hand['handId']
  roomId: Hand['roomId']
  dealerSeat: Seat
  bottom: CardId[]
  hands: CardId[][]
  bid: BidScore
  landlordSeat: Seat | null
  farmerDoubledBySeat: Partial<Record<Seat, boolean>>
  landlordReDouble: boolean
  bombCount: number
  rocketCount: number
  spring: 'none' | 'spring' | 'anti'
  table: Play[]
  turnSeat: Seat
  leadSeat: Seat
  laiZiRanks: string[]
}

export type PlayResult = {
  readonly ok: true
  readonly play: Play
  readonly emptied: boolean
} | {
  readonly ok: false
  readonly code: 'illegal' | 'not-your-turn' | 'phase'
  readonly reason: string
}

export function createHand(
  roomId: RoomId,
  dealerSeat: Seat | null,
  seq: number,
  options: { seatCount?: SeatCount; laiZi?: boolean } = {},
): EngineState {
  const seatCount = options.seatCount ?? 3
  const laiZi = options.laiZi === true
  const deal = dealCards(seatCount)
  const start = dealerSeat ?? randomSeat(seatCount)
  const laiZiRanks = laiZi ? pickLaiZiRanks(2) : []
  const hand: MutableHand = {
    handId: asHandId(`hand_${roomId}_${seq}`),
    roomId,
    dealerSeat: start,
    bottom: [...deal.bottom],
    hands: deal.hands.map((cards) => [...cards]),
    bid: 0,
    landlordSeat: null,
    farmerDoubledBySeat: {},
    landlordReDouble: false,
    bombCount: 0,
    rocketCount: 0,
    spring: 'none',
    table: [],
    turnSeat: start,
    leadSeat: start,
    laiZiRanks,
  }
  return {
    phase: 'bidding',
    seatCount,
    laiZi,
    hand,
    firstLeadSeq: null,
    successfulLandlordPlaysAfterLead: 0,
    farmerPlayed: Array.from({ length: seatCount }, () => false),
    bids: Array.from({ length: seatCount }, () => null),
    bidTurn: start,
    highestBid: 0,
    highestBidder: null,
    passesInRow: 0,
    doubleDeadlineAt: 0,
    farmerDoubleDone: Array.from({ length: seatCount }, () => false),
    landlordDoubleDone: false,
  }
}

export function applyBid(state: EngineState, seat: Seat, score: BidScore): PlayResult {
  if (state.phase !== 'bidding') return { ok: false, code: 'phase', reason: 'not bidding' }
  if (state.bidTurn !== seat) return { ok: false, code: 'not-your-turn', reason: 'not your bid' }
  if (score !== 0 && score <= state.highestBid) {
    return { ok: false, code: 'illegal', reason: 'bid must be higher' }
  }
  state.bids[seat] = score
  if (score > state.highestBid) {
    state.highestBid = score
    state.highestBidder = seat
  }
  if (score === 3) {
    lockLandlord(state, seat, 3)
    return { ok: true, play: dummyPlay(seat), emptied: false }
  }
  state.bidTurn = nextSeat(seat, state.seatCount)
  if (state.bids.every((bid) => bid !== null)) {
    if (state.highestBidder === null || state.highestBid === 0) {
      state.phase = 'redeal'
      return { ok: true, play: dummyPlay(seat), emptied: false }
    }
    lockLandlord(state, state.highestBidder, state.highestBid)
  }
  return { ok: true, play: dummyPlay(seat), emptied: false }
}

export function applyDouble(
  state: EngineState,
  seat: Seat,
  action: 'pass' | 'double' | 'reDouble',
  now = Date.now(),
): PlayResult {
  if (state.phase !== 'doubling') return { ok: false, code: 'phase', reason: 'not doubling' }
  if (now > state.doubleDeadlineAt) {
    finishDoubling(state)
    return { ok: false, code: 'phase', reason: 'double window closed' }
  }
  const landlord = state.hand.landlordSeat
  if (landlord === null) return { ok: false, code: 'phase', reason: 'no landlord' }
  if (seat === landlord) {
    if (action === 'double') return { ok: false, code: 'illegal', reason: 'landlord cannot double' }
    if (!farmersFinished(state)) return { ok: false, code: 'illegal', reason: 'wait for farmers' }
    if (state.landlordDoubleDone) return { ok: false, code: 'illegal', reason: 'already answered' }
    state.hand.landlordReDouble = action === 'reDouble'
    state.landlordDoubleDone = true
    finishDoubling(state)
    return { ok: true, play: dummyPlay(seat), emptied: false }
  }
  if (action === 'reDouble') return { ok: false, code: 'illegal', reason: 'farmers cannot reDouble' }
  if (state.farmerDoubleDone[seat]) return { ok: false, code: 'illegal', reason: 'already answered' }
  state.farmerDoubleDone[seat] = true
  if (action === 'double') state.hand.farmerDoubledBySeat[seat] = true
  if (farmersFinished(state) && state.landlordDoubleDone) finishDoubling(state)
  return { ok: true, play: dummyPlay(seat), emptied: false }
}

export function expireDoubling(state: EngineState, now = Date.now()): void {
  if (state.phase !== 'doubling') return
  if (now >= state.doubleDeadlineAt) finishDoubling(state)
}

export function applyPlay(state: EngineState, seat: Seat, cards: readonly CardId[], seq: number, ts: string): PlayResult {
  if (state.phase !== 'playing') return { ok: false, code: 'phase', reason: 'not playing' }
  if (state.hand.turnSeat !== seat) return { ok: false, code: 'not-your-turn', reason: 'not your turn' }
  const handCards = state.hand.hands[seat] ?? []
  if (!containsAll(handCards, cards)) return { ok: false, code: 'illegal', reason: 'cards not in hand' }
  const classified = classify(cards, state.hand.laiZiRanks)
  if (!classified) return { ok: false, code: 'illegal', reason: 'unknown hand type' }
  const lead = currentLead(state)
  const isLead = lead === null || state.hand.leadSeat === seat
  if (isLead) {
    const play = commitPlay(state, seat, classified, seq, ts)
    return { ok: true, play, emptied: state.hand.hands[seat]!.length === 0 }
  }
  if (!beats(lead, classified, decksFor(state.seatCount))) {
    return { ok: false, code: 'illegal', reason: 'does not beat lead' }
  }
  const play = commitPlay(state, seat, classified, seq, ts)
  return { ok: true, play, emptied: (state.hand.hands[seat] ?? []).length === 0 }
}

export function applyPass(state: EngineState, seat: Seat, seq: number, ts: string): PlayResult {
  if (state.phase !== 'playing') return { ok: false, code: 'phase', reason: 'not playing' }
  if (state.hand.turnSeat !== seat) return { ok: false, code: 'not-your-turn', reason: 'not your turn' }
  if (state.hand.leadSeat === seat || currentLead(state) === null) {
    return { ok: false, code: 'illegal', reason: 'cannot pass when leading' }
  }
  const play: Play = { seat, type: 'pass', cards: [], seq, ts }
  state.hand.table.push(play)
  state.passesInRow += 1
  if (state.passesInRow >= state.seatCount - 1) {
    state.hand.leadSeat = nextSeat(seat, state.seatCount)
    state.hand.turnSeat = state.hand.leadSeat
    state.passesInRow = 0
  } else {
    state.hand.turnSeat = nextSeat(seat, state.seatCount)
  }
  return { ok: true, play, emptied: false }
}

export function autoTimeout(state: EngineState, seq: number, ts: string): PlayResult | null {
  if (state.phase !== 'playing') return null
  const seat = state.hand.turnSeat
  if (state.hand.leadSeat === seat || currentLead(state) === null) {
    const card = smallestSolo(state.hand.hands[seat] ?? [])
    if (!card) return null
    return applyPlay(state, seat, [card], seq, ts)
  }
  return applyPass(state, seat, seq, ts)
}

export function legalFor(state: EngineState, seat: Seat) {
  if (state.phase !== 'playing' || state.hand.turnSeat !== seat) {
    return { canPass: false, combos: [] as const }
  }
  const lead = currentLead(state)
  const canPass = !(state.hand.leadSeat === seat || lead === null)
  return {
    canPass,
    combos: enumerateLegal(state.hand.hands[seat] ?? [], lead, state.hand.laiZiRanks, decksFor(state.seatCount)),
  }
}

export function finishHand(state: EngineState, winnerSeat: Seat): void {
  const landlord = state.hand.landlordSeat
  if (landlord === null) return
  const landlordEmptied = winnerSeat === landlord
  const farmersNeverPlayed = state.hand.hands
    .map((_, seat) => seat as Seat)
    .filter((seat) => seat !== landlord)
    .every((seat) => !state.farmerPlayed[seat])
  const spring = landlordEmptied && farmersNeverPlayed
  const anti = !landlordEmptied && state.successfulLandlordPlaysAfterLead === 0
  state.hand.spring = spring ? 'spring' : anti ? 'anti' : 'none'
  state.phase = 'settled'
}

export function snapshotHand(state: EngineState): Hand {
  return {
    ...state.hand,
    hands: state.hand.hands.map((cards) => sortCards(cards)),
    bottom: [...state.hand.bottom],
    table: [...state.hand.table],
    farmerDoubledBySeat: { ...state.hand.farmerDoubledBySeat },
    laiZiRanks: [...state.hand.laiZiRanks],
  }
}

function lockLandlord(state: EngineState, seat: Seat, bid: BidScore): void {
  state.hand.landlordSeat = seat
  state.hand.bid = bid
  state.hand.hands = giveBottom(state.hand.hands, state.hand.bottom, seat)
  state.hand.turnSeat = seat
  state.hand.leadSeat = seat
  state.phase = 'doubling'
  state.doubleDeadlineAt = Date.now() + 8_000
}

function finishDoubling(state: EngineState): void {
  if (state.phase !== 'doubling') return
  state.phase = 'playing'
  state.passesInRow = 0
}

function farmersFinished(state: EngineState): boolean {
  const landlord = state.hand.landlordSeat
  return state.hand.hands.every((_, index) => {
    const seat = index as Seat
    return seat === landlord || state.farmerDoubleDone[seat]
  })
}

function currentLead(state: EngineState): ClassifiedHand | null {
  for (let i = state.hand.table.length - 1; i >= 0; i -= 1) {
    const play = state.hand.table[i]
    if (!play || play.type === 'pass') continue
    const classified = classify(play.cards, state.hand.laiZiRanks)
    return classified
  }
  return null
}

function commitPlay(
  state: EngineState,
  seat: Seat,
  classified: ClassifiedHand,
  seq: number,
  ts: string,
): Play {
  const play: Play = { seat, type: classified.type, cards: classified.cards, seq, ts }
  const held = state.hand.hands[seat]
  if (!held) return play
  removeCards(held, classified.cards)
  state.hand.table.push(play)
  if (classified.type === 'bomb') state.hand.bombCount += 1
  if (classified.type === 'rocket') state.hand.rocketCount += 1
  const landlord = state.hand.landlordSeat
  if (landlord !== null && seat !== landlord) state.farmerPlayed[seat] = true
  if (state.firstLeadSeq === null) {
    state.firstLeadSeq = seq
  } else if (landlord !== null && seat === landlord) {
    state.successfulLandlordPlaysAfterLead += 1
  }
  state.hand.leadSeat = seat
  state.hand.turnSeat = nextSeat(seat, state.seatCount)
  state.passesInRow = 0
  if ((state.hand.hands[seat] ?? []).length === 0) finishHand(state, seat)
  return play
}

function containsAll(hand: readonly CardId[], cards: readonly CardId[]): boolean {
  const bag = new Map<CardId, number>()
  for (const card of hand) bag.set(card, (bag.get(card) ?? 0) + 1)
  for (const card of cards) {
    const count = bag.get(card) ?? 0
    if (count === 0) return false
    bag.set(card, count - 1)
  }
  return true
}

function removeCards(hand: CardId[], cards: readonly CardId[]): void {
  for (const card of cards) {
    const index = hand.indexOf(card)
    if (index >= 0) hand.splice(index, 1)
  }
}

function dummyPlay(seat: Seat): Play {
  return { seat, type: 'pass', cards: [], seq: 0, ts: new Date().toISOString() }
}

export function createHandId(roomId: RoomId, seq: number): HandId {
  return asHandId(`hand_${roomId}_${seq}`)
}
