import { describe, expect, it } from 'vitest'
import { assetCacheControl, joinAsset } from '../../src/net/join-page.ts'

const ART = [
  'card-back.webp', 'card-back-landlord.webp',
  'joker-red.webp', 'joker-black.webp',
  'face-j.webp', 'face-q.webp', 'face-k.webp', 'face-a.webp',
  'role-landlord.webp', 'role-landlord-b.webp',
  'role-farmer.webp', 'role-farmer-b.webp', 'role-farmer-c.webp',
  'role-spectator.webp',
] as const

describe('join assets', () => {
  it('serves whale maid card and role art as webp', () => {
    for (const name of ART) {
      const asset = joinAsset(name)
      expect(asset).not.toBeNull()
      expect(asset?.type).toBe('image/webp')
      expect(asset?.body.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(asset?.body.subarray(8, 12).toString('ascii')).toBe('WEBP')
      expect((asset?.body.length ?? 0) > 8_000).toBe(true)
      expect((asset?.body.length ?? 0) < 80_000).toBe(true)
    }
  })

  it('long-caches images and keeps html/js/css uncached', () => {
    expect(assetCacheControl('face-a.webp')).toBe('public, max-age=31536000, immutable')
    expect(assetCacheControl('role-spectator.webp')).toBe('public, max-age=31536000, immutable')
    expect(assetCacheControl('join.css')).toBe('no-store')
    expect(assetCacheControl('index.js')).toBe('no-store')
  })

  it('rejects path traversal and reuses the in-memory asset body', () => {
    expect(joinAsset('../package.json')).toBeNull()
    expect(joinAsset('foo/bar.webp')).toBeNull()
    const first = joinAsset('card-back.webp')
    const second = joinAsset('card-back.webp')
    expect(first).not.toBeNull()
    expect(second).toBe(first)
  })
})
