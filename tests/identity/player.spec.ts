import { describe, expect, it } from 'vitest'
import { sanitizeBrowserId, sanitizeDisplayName } from '../../src/identity/player.ts'

describe('identity', () => {
  it('accepts a browser-profile id and rejects junk', () => {
    expect(sanitizeBrowserId('aaaaaaaa')).toBe('aaaaaaaa')
    expect(sanitizeBrowserId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    expect(sanitizeBrowserId('short')).toBeNull()
    expect(sanitizeBrowserId('has space!!')).toBeNull()
    expect(sanitizeBrowserId(1)).toBeNull()
    expect(sanitizeBrowserId('')).toBeNull()
  })

  it('still sanitizes display names', () => {
    expect(sanitizeDisplayName('  南  ')).toBe('南')
  })
})
