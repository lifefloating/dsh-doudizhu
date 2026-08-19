export type RoomId = string & { readonly __brand: 'RoomId' }
export type PlayerId = string & { readonly __brand: 'PlayerId' }
export type HandId = string & { readonly __brand: 'HandId' }
export type GrantId = string & { readonly __brand: 'GrantId' }
export type SettlementId = string & { readonly __brand: 'SettlementId' }
export type EntryId = string & { readonly __brand: 'EntryId' }
export type CardId = string & { readonly __brand: 'CardId' }
export type SeatCount = 3 | 4
export type Seat = 0 | 1 | 2 | 3
export type GameMode = 'classic' | 'laizi'
export type TokenAtomString = string & { readonly __atom: unique symbol }

export type RoomPhase =
  | 'waiting' | 'dealing' | 'bidding' | 'doubling'
  | 'playing' | 'settling' | 'void' | 'closed'

export type HandType =
  | 'solo' | 'pair' | 'trio' | 'trioSolo' | 'trioPair'
  | 'seq' | 'seqPair' | 'plane' | 'planeSolo' | 'planePair'
  | 'fourDualSolo' | 'fourDualPair' | 'bomb' | 'rocket' | 'pass'

export type BidScore = 0 | 1 | 2 | 3

export type RejectCode =
  | 'illegal' | 'not-your-turn' | 'phase' | 'auth' | 'duplicate-nonce'
  | 'insufficient' | 'room-full' | 'expired'

export interface Player {
  readonly playerId: PlayerId
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly createdAt: string
}

export interface SeatState {
  readonly seat: Seat
  readonly playerId: PlayerId | null
  readonly displayName: string | null
  readonly avatarUrl: string | null
  readonly ready: boolean
  readonly connected: boolean
  readonly role: 'empty' | 'farmer' | 'landlord'
  readonly grantId: GrantId | null
  readonly cardsLeft: number
}

export interface Room {
  readonly roomId: RoomId
  readonly roomCode: string
  readonly title: string
  readonly hostPlayerId: PlayerId
  readonly phase: RoomPhase
  readonly stakeAtoms: bigint
  readonly maxMultiplier: number
  readonly seatCount: SeatCount
  readonly laiZi: boolean
  readonly seats: readonly SeatState[]
  readonly spectatorIds: readonly PlayerId[]
  readonly currentHandId: HandId | null
  readonly createdAt: string
  readonly inviteExpiresAt: string
  readonly shareable: boolean
}

/** Wire copy of Room: atoms are decimal strings so JSON/WS stay serializable. */
export interface RoomView extends Omit<Room, 'stakeAtoms'> {
  readonly stakeAtoms: TokenAtomString
}

export interface Play {
  readonly seat: Seat
  readonly type: HandType
  readonly cards: readonly CardId[]
  readonly seq: number
  readonly ts: string
}

export interface Hand {
  readonly handId: HandId
  readonly roomId: RoomId
  readonly dealerSeat: Seat
  readonly bottom: readonly CardId[]
  readonly hands: readonly CardId[][]
  readonly bid: BidScore
  readonly landlordSeat: Seat | null
  readonly farmerDoubledBySeat: Partial<Record<Seat, boolean>>
  readonly landlordReDouble: boolean
  readonly bombCount: number
  readonly rocketCount: number
  readonly spring: 'none' | 'spring' | 'anti'
  readonly table: readonly Play[]
  readonly turnSeat: Seat
  readonly leadSeat: Seat
  readonly laiZiRanks: readonly string[]
}

export interface LegalCombo {
  readonly type: Exclude<HandType, 'pass'>
  readonly cards: readonly CardId[]
}

export interface PlayerView {
  readonly room: RoomView
  readonly you: {
    readonly playerId: PlayerId
    readonly seat: Seat | null
    readonly spectator: boolean
    readonly cards: CardId[]
  }
  readonly publicHands: readonly number[]
  readonly lastPlays: readonly Play[]
  readonly bottom: readonly CardId[] | null
  readonly laiZiRanks: readonly string[]
  readonly bid: BidScore
  readonly turnSeat: Seat | null
  readonly leadSeat: Seat | null
  readonly deadlineAt: string | null
  readonly yourAvailableAtoms: TokenAtomString
  readonly yourEscrowAtoms: TokenAtomString
  readonly legal: { readonly canPass: boolean; readonly combos: readonly LegalCombo[] }
  readonly remainingRanks: Readonly<Record<string, number>> | null
  readonly chat: readonly ChatLine[]
}

export interface ChatLine {
  readonly playerId: PlayerId
  readonly displayName: string
  readonly text: string
  readonly ts: string
}

export interface Settlement {
  readonly settlementId: SettlementId
  readonly handId: HandId
  readonly winner: 'landlord' | 'farmers'
  readonly unitAtoms: TokenAtomString
  readonly deltas: readonly { seat: Seat; playerId: PlayerId; atoms: TokenAtomString }[]
  readonly rakeAtoms: TokenAtomString
  readonly formula: string
}

export interface PublicSettlement {
  readonly settlementId: SettlementId
  readonly handId: HandId
  readonly winner: 'landlord' | 'farmers'
  readonly unitAtoms: TokenAtomString
  readonly deltas: Settlement['deltas']
  readonly rakeAtoms: TokenAtomString
  readonly formula: string
  readonly trustNote: string
}

export interface TokenGrant {
  readonly grantId: GrantId
  readonly playerId: PlayerId
  readonly roomId: RoomId
  readonly maxExposureAtoms: TokenAtomString
  readonly issuedAt: string
  readonly expiresAt: string
  readonly source: 'host-welcome'
  readonly issuedBy: 'room-host'
}

export type ClientCommand =
  | { type: 'sit'; seat: Seat; displayName: string }
  | { type: 'stand' }
  | { type: 'ready'; ready: boolean }
  | { type: 'bid'; score: BidScore }
  | { type: 'double'; action: 'pass' | 'double' | 'reDouble' }
  | { type: 'rename'; title: string }
  | { type: 'play'; cards: CardId[]; nonce: string }
  | { type: 'pass'; nonce: string }
  | { type: 'chat'; text: string }
  | { type: 'rematch' }
  | { type: 'hostKick'; playerId: PlayerId }
  | { type: 'hostClose' }
  | { type: 'ping' }

export type ServerEvent =
  | { type: 'snapshot'; seq: number; view: PlayerView }
  | { type: 'reject'; nonce?: string; code: RejectCode; reason: string }
  | { type: 'settled'; seq: number; settlement: PublicSettlement }
  | { type: 'pong'; ts: number }

export class CommandError extends Error {
  readonly code: RejectCode
  constructor(code: RejectCode, reason: string) {
    super(reason)
    this.code = code
    this.name = 'CommandError'
  }
}

export function asTokenAtomString(value: bigint | number | string): TokenAtomString {
  return String(value) as TokenAtomString
}

export function parseAtoms(value: string): bigint {
  if (!/^-?\d+$/.test(value)) throw new Error(`invalid atom string: ${value}`)
  return BigInt(value)
}

export function asCardId(value: string): CardId {
  return value as CardId
}

export function asPlayerId(value: string): PlayerId {
  return value as PlayerId
}

export function asRoomId(value: string): RoomId {
  return value as RoomId
}

export function asHandId(value: string): HandId {
  return value as HandId
}

export function asGrantId(value: string): GrantId {
  return value as GrantId
}

export function asSettlementId(value: string): SettlementId {
  return value as SettlementId
}

export function asEntryId(value: string): EntryId {
  return value as EntryId
}

export function nextSeat(seat: Seat, count: number = 3): Seat {
  return ((seat + 1) % count) as Seat
}

export function prevSeat(seat: Seat, count: number = 3): Seat {
  return ((seat + count - 1) % count) as Seat
}

export function isSeat(value: unknown, count: number = 4): value is Seat {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < count
}

export function allSeats(count: SeatCount): Seat[] {
  return Array.from({ length: count }, (_, index) => index as Seat)
}

export function decksFor(count: SeatCount): 1 | 2 {
  return count === 3 ? 1 : 2
}

export function holeCount(count: SeatCount): number {
  return count === 3 ? 3 : 8
}

export function dealtHandSize(count: SeatCount): number {
  return count === 3 ? 17 : 25
}

export function landlordHandSize(count: SeatCount): number {
  return dealtHandSize(count) + holeCount(count)
}
