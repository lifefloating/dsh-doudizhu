import { describe, expect, it } from 'vitest'
import { isLoopbackHost, isLoopbackOrigin, originAllowed } from '../../src/net/auth.ts'

describe('origin allowlist', () => {
  it('allows loopback and configured publicBaseUrl', () => {
    expect(originAllowed('http://127.0.0.1:3080', '', true)).toBe(true)
    expect(originAllowed('http://localhost:3080', '', true)).toBe(true)
    expect(originAllowed('https://tunnel.example', 'https://tunnel.example', true)).toBe(true)
    expect(originAllowed('https://evil.example', 'https://tunnel.example', true)).toBe(false)
    expect(isLoopbackOrigin('http://[::1]:3080')).toBe(true)
    expect(isLoopbackHost('127.0.0.1:3080', '127.0.0.1')).toBe(true)
  })
})
