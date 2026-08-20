export const BROWSER_ID_KEY = 'dsh-poker.browser-id'

const BROWSER_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/

let cached = ''

function memoryStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** Stable id for this origin + browser profile. Shared across tabs; not across browsers. */
export function browserInstanceId(storage: Storage | undefined = memoryStorage()): string {
  if (cached) return cached
  if (!storage) return ''
  try {
    const existing = storage.getItem(BROWSER_ID_KEY)
    if (existing && BROWSER_ID_RE.test(existing)) {
      cached = existing
      return cached
    }
    const next = (globalThis.crypto?.randomUUID?.() ?? `b${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`)
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64)
    if (!BROWSER_ID_RE.test(next)) return ''
    storage.setItem(BROWSER_ID_KEY, next)
    cached = next
    return cached
  } catch {
    return ''
  }
}

/** Test hook. */
export function resetBrowserIdCache(): void {
  cached = ''
}
