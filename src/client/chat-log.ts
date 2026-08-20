import type { ChatLine } from '../types.ts'

/** Dismissed log stays hidden until a newer line arrives. */
export function nextChatHidden(hidden: boolean, prevLatest: string | null, latest: string | null): boolean {
  if (!latest) return true
  if (latest !== prevLatest) return false
  return hidden
}

export function chatLineKey(line: ChatLine, index: number): string {
  return `${line.ts}-${line.playerId}-${index}`
}
