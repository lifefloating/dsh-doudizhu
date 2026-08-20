import { describe, expect, it } from 'vitest'
import { COMPACT_STACK_MAX, visibleBackCount } from '../../src/client/card-stack.ts'
import { joinAsset } from '../../src/net/join-page.ts'

describe('opponent remaining stack', () => {
  it('keeps a thick pile of at most 5 backs until the hand thins', () => {
    expect(COMPACT_STACK_MAX).toBe(5)
    expect(visibleBackCount(17)).toBe(5)
    expect(visibleBackCount(20)).toBe(5)
    expect(visibleBackCount(6)).toBe(5)
    expect(visibleBackCount(5)).toBe(5)
    expect(visibleBackCount(4)).toBe(4)
    expect(visibleBackCount(1)).toBe(1)
    expect(visibleBackCount(0)).toBe(0)
  })

  it('serves a distinct landlord card back', () => {
    const farmer = joinAsset('card-back.webp')
    const landlord = joinAsset('card-back-landlord.webp')
    expect(farmer?.type).toBe('image/webp')
    expect(landlord?.type).toBe('image/webp')
    expect((landlord?.body.length ?? 0) > 1000).toBe(true)
    expect(landlord?.body.equals(farmer?.body ?? Buffer.alloc(0))).toBe(false)
  })
})
