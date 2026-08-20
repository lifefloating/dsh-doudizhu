import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROLE_ICONS, roleIconSrc } from '../../src/client/SeatAvatar.tsx'
import { joinAsset } from '../../src/net/join-page.ts'

function webpHasAlpha(body: Buffer): boolean {
  if (body.toString('ascii', 0, 4) !== 'RIFF' || body.toString('ascii', 8, 12) !== 'WEBP') return false
  if (body.toString('ascii', 12, 16) !== 'VP8X') return false
  return (body[20]! & 0x10) !== 0
}

describe('role icons', () => {
  it('maps landlord and farmer seats onto whale stickers', () => {
    expect(roleIconSrc('landlord', 0)).toBe(ROLE_ICONS.landlord)
    expect(roleIconSrc('landlord', 1)).toBe(ROLE_ICONS.landlord)
    expect(roleIconSrc('farmer', 0)).toBe(ROLE_ICONS.farmer)
    expect(roleIconSrc('farmer', 1)).toBe(ROLE_ICONS.farmerB)
    expect(roleIconSrc('farmer', 2)).toBe(ROLE_ICONS.farmerC)
    expect(roleIconSrc('empty', 3)).toBe(ROLE_ICONS.farmer)
    expect(ROLE_ICONS.spectator).toBe('/doudizhu/assets/role-spectator.webp')
    for (const name of [
      'role-landlord.webp', 'role-landlord-b.webp',
      'role-farmer.webp', 'role-farmer-b.webp', 'role-farmer-c.webp',
      'role-spectator.webp', 'card-back.webp', 'card-back-landlord.webp',
    ]) {
      expect(joinAsset(name)?.type).toBe('image/webp')
    }
  })

  it('keeps the spectator sprite on a transparent cutout like seated farmers', () => {
    const file = readFileSync(join(process.cwd(), 'src/client/assets/role-spectator.webp'))
    expect(webpHasAlpha(file)).toBe(true)
    const served = joinAsset('role-spectator.webp')
    expect(served).not.toBeNull()
    expect(webpHasAlpha(served!.body)).toBe(true)
  })
})
