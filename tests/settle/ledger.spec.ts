import { describe, expect, it } from 'vitest'
import { createMemoryDomain } from '../../src/persist/domain.ts'
import { Ledger } from '../../src/settle/ledger.ts'
import { asPlayerId, parseAtoms } from '../../src/types.ts'
import { seatCapAtoms } from '../../src/settle/math.ts'

describe('welcome ledger', () => {
  it('grants welcome once and freezes seatCap', async () => {
    const domain = createMemoryDomain()
    const ledger = new Ledger(domain, 200_000_000n)
    const player = asPlayerId('pl_a')
    await ledger.ensurePlayer(player, '甲', null)
    expect(ledger.getAvailable(player)).toBe(200_000_000n)
    await ledger.ensurePlayer(player, '甲', null)
    expect(ledger.getAvailable(player)).toBe(200_000_000n)
    const cap = seatCapAtoms(1_000_000n, 8)
    await ledger.freeze(player, cap, 'rm_1')
    expect(ledger.getAvailable(player)).toBe(200_000_000n - cap)
    expect(ledger.getEscrow(player)).toBe(cap)
    await ledger.unfreeze(player, cap, 'rm_1')
    expect(ledger.getAvailable(player)).toBe(200_000_000n)
  })

  it('settle is zero-sum inside escrow', async () => {
    const domain = createMemoryDomain()
    const ledger = new Ledger(domain, 200_000_000n)
    const a = asPlayerId('pl_a')
    const b = asPlayerId('pl_b')
    await ledger.ensurePlayer(a, '甲', null)
    await ledger.ensurePlayer(b, '乙', null)
    await ledger.freeze(a, 10_000_000n, 'rm')
    await ledger.settleTransfer(a, b, 3_000_000n, { roomId: 'rm', handId: 'h', settlementId: 's' })
    expect(ledger.getEscrow(a)).toBe(7_000_000n)
    expect(parseAtoms(ledger.snapshot(b).availableAtoms)).toBe(203_000_000n)
  })
})
