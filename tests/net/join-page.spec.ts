import { describe, expect, it } from 'vitest'
import { joinAsset } from '../../src/net/join-page.ts'

describe('join assets', () => {
  it('serves whale face-card art as jpeg', () => {
    for (const name of [
      'joker-red.png', 'joker-black.png', 'face-j.png', 'face-q.png', 'face-k.png', 'face-a.png',
      'role-landlord.png', 'role-landlord-b.png', 'role-farmer.png', 'role-farmer-b.png',
    ]) {
      const asset = joinAsset(name)
      expect(asset).not.toBeNull()
      expect(asset?.type).toBe('image/png')
      expect((asset?.body.length ?? 0) > 1000).toBe(true)
    }
  })
})
