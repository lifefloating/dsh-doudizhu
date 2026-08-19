import { describe, expect, it } from 'vitest'
import { formatM } from '../../src/settle/math.ts'

describe('formatM', () => {
  it('uses M for millions of tokens', () => {
    expect(formatM(0n)).toBe('0M')
    expect(formatM(1_000_000n)).toBe('1M')
    expect(formatM(96_000_000n)).toBe('96M')
    expect(formatM(104_000_000n)).toBe('104M')
    expect(formatM(200_000_000n)).toBe('200M')
  })

  it('uses B for billions of tokens', () => {
    expect(formatM(1_000_000_000n)).toBe('1B')
    expect(formatM(1_500_000_000n)).toBe('1.5B')
    expect(formatM(12_000_000_000n)).toBe('12B')
  })

  it('keeps a decimal instead of dumping raw zeros', () => {
    expect(formatM(500_000n)).toBe('0.5M')
    expect(formatM(104_500_000n)).toBe('104.5M')
    expect(formatM(1n)).toBe('0.000001M')
  })

  it('preserves sign', () => {
    expect(formatM(-3_000_000n)).toBe('-3M')
    expect(formatM(-1_500_000_000n)).toBe('-1.5B')
  })
})
