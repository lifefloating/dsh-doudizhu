import { describe, expect, it } from 'vitest'
import { joinAsset } from '../../src/net/join-page.ts'

describe('join assets', () => {
  it('serves whale maid card and role art as png', () => {
    for (const name of [
      'card-back.png', 'card-back-landlord.png',
      'joker-red.png', 'joker-black.png',
      'face-2.png', 'face-3.png', 'face-4.png', 'face-5.png', 'face-6.png',
      'face-7.png', 'face-8.png', 'face-9.png', 'face-10.png',
      'face-j.png', 'face-q.png', 'face-k.png', 'face-a.png',
      'role-landlord.png', 'role-landlord-b.png', 'role-farmer.png', 'role-farmer-b.png',
      'role-spectator.png',
    ]) {
      const asset = joinAsset(name)
      expect(asset).not.toBeNull()
      expect(asset?.type).toBe('image/png')
      expect((asset?.body.length ?? 0) > 1000).toBe(true)
    }
  })
})
