export const PACKAGE_NAME = 'dsh-poker'
export const CLIENT_ID = 'dsh-poker'
export const SUBPROTOCOL = 'doudizhu.v1'
export const MAX_FRAME_BYTES = 64 * 1024
export const MAX_DISPLAY_NAME = 16
export const MAX_ROOM_TITLE = 24
export const MAX_CHAT = 80
export const MAX_SPECTATORS = 16
/** After a seat times out once, later turns play this quickly (托管). */
export const AUTO_PLAY_MS = 1_500
/**
 * Waiting-phase guests who drop the socket leave after this grace.
 * Long enough for the HTTP poll fallback to resume; tab close still
 * frees the seat via `pagehide` / `/api/leave`. Tests may override
 * with `leaveWaitingMs`.
 */
export const LEAVE_WAITING_MS = 2_000
/** Shuffle-to-center before the first card flies. Must match DealAnimation. */
export const DEAL_SHUFFLE_MS = 1050
/** Stagger between consecutive flying cards. Must match DealAnimation. */
export const DEAL_PER_CARD_MS = 36
/** One card's flight duration. Must match DealAnimation. */
export const DEAL_FLY_MS = 420
/** Image-load / last-frame slack so the server does not reveal hands mid-flight. */
export const DEAL_BUFFER_MS = 350

/** Wall-clock for the dealing phase. 3-seat 51 cards; 4-seat 100 cards. */
export function dealAnimationMs(seatCount: 3 | 4): number {
  const cards = seatCount === 4 ? 100 : 51
  return DEAL_SHUFFLE_MS + Math.max(0, cards - 1) * DEAL_PER_CARD_MS + DEAL_FLY_MS + DEAL_BUFFER_MS
}

/** Default dealing window (3-seat). Tests may override with `dealAnimMs`. */
export const DEAL_ANIM_MS = dealAnimationMs(3)
