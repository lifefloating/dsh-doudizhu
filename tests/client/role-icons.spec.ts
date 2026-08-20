import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROLE_ICONS, roleIconSrc } from '../../src/client/SeatAvatar.tsx'
import { joinAsset } from '../../src/net/join-page.ts'

describe('role icons', () => {
  it('maps landlord and farmer seats onto whale stickers', () => {
    expect(roleIconSrc('landlord', 0)).toBe(ROLE_ICONS.landlord)
    expect(roleIconSrc('landlord', 1)).toBe(ROLE_ICONS.landlord)
    expect(roleIconSrc('farmer', 0)).toBe(ROLE_ICONS.farmer)
    expect(roleIconSrc('farmer', 1)).toBe(ROLE_ICONS.farmerB)
    expect(roleIconSrc('farmer', 2)).toBe(ROLE_ICONS.farmerC)
    expect(roleIconSrc('empty', 3)).toBe(ROLE_ICONS.farmer)
    expect(ROLE_ICONS.spectator).toBe('/doudizhu/assets/role-spectator.png')
    for (const name of [
      'role-landlord.png', 'role-landlord-b.png',
      'role-farmer.png', 'role-farmer-b.png', 'role-farmer-c.png',
      'role-spectator.png', 'card-back.png', 'card-back-landlord.png',
    ]) {
      expect(joinAsset(name)?.type).toBe('image/png')
    }
  })

  it('keeps the spectator sprite on a transparent cutout like seated farmers', () => {
    const file = readFileSync(join(process.cwd(), 'src/client/assets/role-spectator.png'))
    expect(file[25]).toBe(6)
    const served = joinAsset('role-spectator.png')
    expect(served?.body[25]).toBe(6)
  })
})
