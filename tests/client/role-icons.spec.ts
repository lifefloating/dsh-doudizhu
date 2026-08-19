import { describe, expect, it } from 'vitest'
import { ROLE_ICONS, roleIconSrc } from '../../src/client/SeatAvatar.tsx'

describe('role icons', () => {
  it('maps landlord and farmer seats onto whale stickers', () => {
    expect(roleIconSrc('landlord', 0)).toBe(ROLE_ICONS.landlord)
    expect(roleIconSrc('landlord', 1)).toBe(ROLE_ICONS.landlordB)
    expect(roleIconSrc('farmer', 0)).toBe(ROLE_ICONS.farmer)
    expect(roleIconSrc('farmer', 2)).toBe(ROLE_ICONS.farmer)
    expect(roleIconSrc('farmer', 1)).toBe(ROLE_ICONS.farmerB)
    expect(roleIconSrc('empty', 3)).toBe(ROLE_ICONS.farmerB)
  })
})
