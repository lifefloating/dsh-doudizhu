import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TURN_TIMEOUT_SEC, MAX_TURN_TIMEOUT_SEC, MIN_TURN_TIMEOUT_SEC,
  parseTurnTimeoutSec, turnTimeoutSecFromMs,
} from '../src/config.ts'

describe('turn timeout settings', () => {
  it('treats empty input as 120 seconds', () => {
    expect(parseTurnTimeoutSec('')).toBe(DEFAULT_TURN_TIMEOUT_SEC)
    expect(parseTurnTimeoutSec('  ')).toBe(DEFAULT_TURN_TIMEOUT_SEC)
  })

  it('accepts the inclusive 60–300 range', () => {
    expect(parseTurnTimeoutSec('60')).toBe(MIN_TURN_TIMEOUT_SEC)
    expect(parseTurnTimeoutSec('120')).toBe(120)
    expect(parseTurnTimeoutSec('300')).toBe(MAX_TURN_TIMEOUT_SEC)
  })

  it('rejects non-integers and out of range', () => {
    expect(() => parseTurnTimeoutSec('59')).toThrow(/60 到 300/)
    expect(() => parseTurnTimeoutSec('301')).toThrow(/60 到 300/)
    expect(() => parseTurnTimeoutSec('90.5')).toThrow(/整数秒/)
    expect(() => parseTurnTimeoutSec('-120')).toThrow(/整数秒/)
    expect(() => parseTurnTimeoutSec('abc')).toThrow(/整数秒/)
  })

  it('rounds milliseconds to seconds for the settings field', () => {
    expect(turnTimeoutSecFromMs(120_000)).toBe(120)
    expect(turnTimeoutSecFromMs(60_000)).toBe(60)
  })
})
