import { describe, expect, it } from 'vitest'
import { joinAsset } from '../../src/net/join-page.ts'

describe('join assets', () => {
  it('serves whale face-card art as jpeg', () => {
    for (const name of ['joker-red.jpg', 'joker-black.jpg', 'face-j.jpg', 'face-q.jpg', 'face-k.jpg', 'face-a.jpg']) {
      const asset = joinAsset(name)
      expect(asset).not.toBeNull()
      expect(asset?.type).toBe('image/jpeg')
      expect((asset?.body.length ?? 0) > 1000).toBe(true)
    }
  })
})
