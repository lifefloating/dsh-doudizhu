import { randomId } from '../crypto.ts'
import { asPlayerId, type PlayerId } from '../types.ts'
import { MAX_DISPLAY_NAME, MAX_ROOM_TITLE } from '../invariant.ts'

export function newPlayerId(): PlayerId {
  return asPlayerId(randomId('pl'))
}

const BROWSER_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/

/** Per-browser-profile id from the client. Empty/invalid → ignored. */
export function sanitizeBrowserId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return BROWSER_ID_RE.test(trimmed) ? trimmed : null
}

export function sanitizeDisplayName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (trimmed.length === 0) return '玩家'
  return trimmed.slice(0, MAX_DISPLAY_NAME)
}

export function sanitizeRoomTitle(raw: string, fallback = '好友局'): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (trimmed.length === 0) return fallback
  return trimmed.slice(0, MAX_ROOM_TITLE)
}

export function sanitizeAvatarUrl(raw: unknown, routePrefix: string): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  if (raw.startsWith(`${routePrefix}/api/avatars/`)) return raw
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}
