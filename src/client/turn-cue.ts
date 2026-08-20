import type { PlayerView, Seat } from '../types.ts'

/** Arrow +「出牌中…」on someone else's avatar during the play phase. */
export function opponentTurnCue(view: PlayerView, seat: Seat): boolean {
  if (view.room.phase !== 'playing') return false
  if (view.turnSeat !== seat) return false
  return view.you.seat !== seat
}

/** Stable per-turn key so the self toast fires once when it becomes your play. */
export function yourTurnToastKey(view: PlayerView): string | null {
  if (view.room.phase !== 'playing') return null
  if (view.you.spectator || view.you.seat === null) return null
  if (view.turnSeat !== view.you.seat) return null
  return `${view.you.seat}:${view.deadlineAt ?? ''}`
}
