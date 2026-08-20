import { describe, expect, it } from 'vitest'
import { FACE_ART_RANKS } from '../../src/client/CardFace.tsx'
import { jokerTone } from '../../src/client/card-motion.ts'
import { joinAsset } from '../../src/net/join-page.ts'

const NUMBER_RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', '2'] as const

describe('card art', () => {
  it('keeps whale-maid stickers on face cards and jokers only', () => {
    expect([...FACE_ART_RANKS]).toEqual(['J', 'Q', 'K', 'A'])
    for (const rank of FACE_ART_RANKS) {
      const name = `face-${rank.toLowerCase()}.webp`
      const asset = joinAsset(name)
      expect(asset, name).not.toBeNull()
      expect(asset?.type).toBe('image/webp')
      expect((asset?.body.length ?? 0) > 1000).toBe(true)
    }
    for (const name of ['joker-red.webp', 'joker-black.webp']) {
      expect(joinAsset(name)?.type).toBe('image/webp')
    }
    expect(jokerTone('RJ')).toBe('red')
    expect(jokerTone('BJ')).toBe('black')
    for (const rank of NUMBER_RANKS) {
      expect(joinAsset(`face-${rank.toLowerCase()}.webp`), rank).toBeNull()
    }
  })
})
