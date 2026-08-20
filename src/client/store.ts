import { decksFor } from '../types.ts'
import { beats, classify } from '../engine/hands.ts'
import type { CardId, PlayerView, PublicSettlement } from '../types.ts'

export interface ClientState {
  view: PlayerView | null
  settlement: PublicSettlement | null
  selected: CardId[]
  error: string | null
  shareable: boolean
  sitUrl: string
  watchUrl: string
  roomCode: string
}

export function emptyState(): ClientState {
  return {
    view: null,
    settlement: null,
    selected: [],
    error: null,
    shareable: false,
    sitUrl: '',
    watchUrl: '',
    roomCode: '',
  }
}

export function toggleCard(selected: CardId[], card: CardId): CardId[] {
  return selected.includes(card) ? selected.filter((item) => item !== card) : [...selected, card]
}

export function retainSelected(prev: CardId[], cards: readonly CardId[]): CardId[] {
  const next = prev.filter((card) => cards.includes(card))
  if (next.length === prev.length && next.every((card, index) => card === prev[index])) return prev
  return next
}

export function selectionLegal(view: PlayerView | null, selected: CardId[]): boolean {
  if (!view || selected.length === 0) return false
  const key = [...selected].sort().join(',')
  if (view.legal.combos.some((combo) => [...combo.cards].sort().join(',') === key)) return true
  const ranks = view.laiZiRanks ?? []
  const classified = classify(selected, ranks)
  if (!classified) return false
  const last = [...view.lastPlays].reverse().find((play) => play.type !== 'pass')
  if (!last || view.leadSeat === view.you.seat) return true
  const lead = classify(last.cards, ranks)
  if (!lead) return true
  const seats = view.room.seatCount ?? (view.room.seats.length >= 4 ? 4 : 3)
  return beats(lead, classified, decksFor(seats))
}
