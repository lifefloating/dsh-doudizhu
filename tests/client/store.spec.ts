import { describe, expect, it } from 'vitest'
import { asCardId } from '../../src/types.ts'
import { retainSelected, toggleCard } from '../../src/client/store.ts'

describe('client selection', () => {
  it('keeps the same array when cards are still in hand', () => {
    const selected = [asCardId('S3'), asCardId('H4')]
    expect(retainSelected(selected, [asCardId('S3'), asCardId('H4'), asCardId('C5')])).toBe(selected)
  })

  it('drops cards that left the hand', () => {
    const selected = [asCardId('S3'), asCardId('H4')]
    expect(retainSelected(selected, [asCardId('H4'), asCardId('C5')])).toEqual([asCardId('H4')])
  })

  it('toggles membership', () => {
    expect(toggleCard([asCardId('S3')], asCardId('H4'))).toEqual([asCardId('S3'), asCardId('H4')])
    expect(toggleCard([asCardId('S3')], asCardId('S3'))).toEqual([])
  })
})
