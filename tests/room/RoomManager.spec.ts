import { describe, expect, it } from 'vitest'
import { RoomManager } from '../../src/room/RoomManager.ts'

describe('RoomManager', () => {
  it('rejects create when welcome < seatCap', async () => {
    const manager = new RoomManager(null, { welcomeAtoms: '1000', defaultStakeM: 1, defaultMaxMultiplier: 8 }, null)
    await expect(manager.createRoom({ stakeM: 1, maxMultiplier: 8 })).rejects.toThrow(/welcome-below-seatcap|seatcap/)
    await manager.dispose()
  })

  it('creates a 3-seat waiting room and sits the host', async () => {
    const manager = new RoomManager(null, {}, null)
    const created = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '房主' })
    expect(created.roomCode).toMatch(/^\d{6}$/)
    expect(created.shareable).toBe(false)
    expect(created.view.you.seat).toBe(0)
    expect(created.view.room.phase).toBe('waiting')
    await manager.dispose()
  })

  it('does not fill empty seats with bots', async () => {
    const manager = new RoomManager(null, {}, null)
    const created = await manager.createRoom({ stakeM: 1, maxMultiplier: 8 })
    const empty = created.view.room.seats.filter((seat) => seat.playerId === null)
    expect(empty).toHaveLength(2)
    await manager.dispose()
  })

  it('creates a 4-seat laizi room', async () => {
    const manager = new RoomManager(null, {}, null)
    const created = await manager.createRoom({
      stakeM: 1, maxMultiplier: 8, seatCount: 4, laiZi: true, hostDisplayName: '房主',
    })
    expect(created.view.room.seatCount).toBe(4)
    expect(created.view.room.laiZi).toBe(true)
    expect(created.view.room.seats).toHaveLength(4)
    expect(created.view.room.seats.filter((seat) => seat.playerId === null)).toHaveLength(3)
    await manager.dispose()
  })

  it('same invite seats early arrivals and starts when full; later players watch', async () => {
    const manager = new RoomManager(null, {}, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    expect(a.seat).toBe(1)
    expect(manager.view(host.roomId, host.hostPlayerId).room.phase).toBe('waiting')
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    expect(b.seat).toBe(2)
    const started = manager.view(host.roomId, host.hostPlayerId)
    expect(started.room.phase).toBe('bidding')
    expect(started.deadlineAt).not.toBeNull()
    const remainMs = Date.parse(started.deadlineAt!) - Date.now()
    expect(remainMs).toBeGreaterThan(110_000)
    expect(remainMs).toBeLessThanOrEqual(120_000)
    const watcher = await manager.join({ roomCode: host.roomCode, invite, displayName: '北', role: 'sit' })
    expect(watcher.seat).toBeNull()
    expect(watcher.view.you.spectator).toBe(true)
    await manager.dispose()
  })
})
