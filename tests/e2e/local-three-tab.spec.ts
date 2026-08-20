import { describe, expect, it } from 'vitest'
import { RoomManager } from '../../src/room/RoomManager.ts'
import { parseAtoms } from '../../src/types.ts'

describe('local three-seat path', () => {
  it('three players sit, ready, and keep a zero-sum ledger after a forced void', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const sitInvite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite: sitInvite, displayName: '南', role: 'sit' })
    expect(a.seat).not.toBeNull()
    expect(manager.view(host.roomId, host.hostPlayerId).room.phase).toBe('waiting')
    const b = await manager.join({ roomCode: host.roomCode, invite: sitInvite, displayName: '西', role: 'sit' })
    expect(b.seat).not.toBeNull()
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    const view = manager.view(host.roomId, host.hostPlayerId)
    expect(view.room.phase).toBe('bidding')
    const seated = view.room.seats.filter((seat) => seat.playerId).length
    expect(seated).toBe(3)
    const before = [host.hostPlayerId, a.playerId].map((id) => parseAtoms(manager.ledgerFor(id).availableAtoms) + parseAtoms(manager.ledgerFor(id).escrowAtoms))
    expect(before.every((value) => value === 200_000_000n)).toBe(true)
    await manager.dispose()
  })
})
