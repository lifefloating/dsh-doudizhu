import { describe, expect, it } from 'vitest'
import { joinAsset } from '../../src/net/join-page.ts'

const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'] as const

describe('card art', () => {
  it('maps every rank onto a whale-maid face sticker', () => {
    for (const rank of RANKS) {
      const name = `face-${rank.toLowerCase()}.png`
      const asset = joinAsset(name)
      expect(asset, name).not.toBeNull()
      expect(asset?.type).toBe('image/png')
      expect((asset?.body.length ?? 0) > 1000).toBe(true)
    }
  })
})
