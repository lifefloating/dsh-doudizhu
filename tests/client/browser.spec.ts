import { describe, expect, it } from 'vitest'
import { BROWSER_ID_KEY, browserInstanceId, resetBrowserIdCache } from '../../src/client/browser.ts'

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>()
  get length(): number { return this.data.size }
  clear(): void { this.data.clear() }
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null }
  removeItem(key: string): void { this.data.delete(key) }
  setItem(key: string, value: string): void { this.data.set(key, value) }
}

describe('browserInstanceId', () => {
  it('reuses the stored id across calls and storage instances of the same map', () => {
    resetBrowserIdCache()
    const storage = new MemoryStorage()
    const first = browserInstanceId(storage)
    expect(first.length).toBeGreaterThanOrEqual(8)
    expect(storage.getItem(BROWSER_ID_KEY)).toBe(first)
    resetBrowserIdCache()
    expect(browserInstanceId(storage)).toBe(first)
  })

  it('returns empty when storage is missing', () => {
    resetBrowserIdCache()
    expect(browserInstanceId(undefined)).toBe('')
  })
})
