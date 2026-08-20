import { describe, expect, it } from 'vitest'
import { AUTO_PLAY_MS } from '../../src/invariant.ts'
import { RoomManager } from '../../src/room/RoomManager.ts'
import { seatCapAtoms } from '../../src/settle/math.ts'
import { parseAtoms, type ServerEvent } from '../../src/types.ts'

describe('RoomManager', () => {
  it('rejects create when welcome < seatCap', async () => {
    const manager = new RoomManager(null, { welcomeAtoms: '1000', defaultStakeM: 1, defaultMaxMultiplier: 8 }, null)
    await expect(manager.createRoom({ stakeM: 1, maxMultiplier: 8 })).rejects.toThrow(/welcome-below-seatcap|seatcap/)
    await manager.dispose()
  })

  it('creates a 3-seat waiting room and sits the host', async () => {
    const manager = new RoomManager(null, {}, null)
    const created = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '房主', title: '周五局' })
    expect(created.roomCode).toMatch(/^\d{6}$/)
    expect(created.shareable).toBe(false)
    expect(created.view.you.seat).toBe(0)
    expect(created.view.room.phase).toBe('waiting')
    expect(created.view.room.title).toBe('周五局')
    await manager.command(created.roomId, created.hostPlayerId, { type: 'rename', title: '通宵场' }, true)
    expect(manager.view(created.roomId, created.hostPlayerId).room.title).toBe('通宵场')
    await manager.dispose()
  })

  it('applies publicBaseUrl to later rooms after replaceConfig', async () => {
    const manager = new RoomManager(null, {}, null)
    const before = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '旧房' })
    expect(before.shareable).toBe(false)
    expect(before.sitUrl.startsWith('http://127.0.0.1:')).toBe(true)
    manager.replaceConfig({ publicBaseUrl: 'https://example.ngrok-free.dev' })
    expect(before.shareable).toBe(false)
    const after = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '新房' })
    expect(after.shareable).toBe(true)
    expect(after.sitUrl.startsWith('https://example.ngrok-free.dev/doudizhu/join?')).toBe(true)
    await manager.dispose()
  })

  it('freezes turn timeout on the room so later settings do not move it', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0, turnTimeoutMs: 2_000 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    manager.replaceConfig({ dealAnimMs: 0, turnTimeoutMs: 8_000 })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    const started = manager.view(host.roomId, host.hostPlayerId)
    expect(started.room.phase).toBe('bidding')
    const remain = Date.parse(started.deadlineAt!) - Date.now()
    expect(remain).toBeGreaterThan(1_500)
    expect(remain).toBeLessThanOrEqual(2_000)

    const later = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '新房' })
    const laterInvite = new URL(later.sitUrl).searchParams.get('invite') ?? ''
    const c = await manager.join({ roomCode: later.roomCode, invite: laterInvite, displayName: '南', role: 'sit' })
    const d = await manager.join({ roomCode: later.roomCode, invite: laterInvite, displayName: '西', role: 'sit' })
    await manager.command(c.roomId, c.playerId, { type: 'ready', ready: true })
    await manager.command(d.roomId, d.playerId, { type: 'ready', ready: true })
    await manager.command(later.roomId, later.hostPlayerId, { type: 'start' }, true)
    const next = manager.view(later.roomId, later.hostPlayerId)
    const nextRemain = Date.parse(next.deadlineAt!) - Date.now()
    expect(nextRemain).toBeGreaterThan(7_500)
    expect(nextRemain).toBeLessThanOrEqual(8_000)
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

  it('same invite seats early arrivals; later players watch until host starts', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const preview = await manager.peek({ roomCode: host.roomCode, invite })
    expect(preview.title).toBe('好友局')
    expect(preview.canSit).toBe(true)
    expect(preview.seated).toBe(1)
    expect(preview.alreadyInRoom).toBe(false)
    await expect(manager.peek({ roomCode: host.roomCode, invite: 'nope' })).rejects.toThrow(/auth|invite/)
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    expect(a.seat).toBe(1)
    expect(a.view.room.seats[1]?.ready).toBe(false)
    expect(manager.view(host.roomId, host.hostPlayerId).room.phase).toBe('waiting')
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    expect(b.seat).toBe(2)
    const full = manager.view(host.roomId, host.hostPlayerId)
    expect(full.room.phase).toBe('waiting')
    await expect(manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true))
      .rejects.toThrow(/ready/)
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    expect(manager.view(host.roomId, host.hostPlayerId).room.seats[1]?.ready).toBe(true)
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: false })
    expect(manager.view(host.roomId, host.hostPlayerId).room.seats[1]?.ready).toBe(false)
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
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

  it('lets the host kick a guest during waiting', async () => {
    const manager = new RoomManager(null, {}, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const guest = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    expect(guest.seat).toBe(1)
    await manager.command(host.roomId, host.hostPlayerId, { type: 'hostKick', playerId: guest.playerId }, true)
    const view = manager.view(host.roomId, host.hostPlayerId)
    expect(view.room.seats[1]?.playerId).toBeNull()
    await expect(manager.command(host.roomId, guest.playerId, { type: 'ready', ready: true }))
      .rejects.toThrow(/not seated|not found/)
    await manager.dispose()
  })

  it('lets a loopback client sit with only the room code', async () => {
    const manager = new RoomManager(null, {}, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    await expect(manager.join({ roomCode: host.roomCode, invite: '', displayName: '南', role: 'sit' }))
      .rejects.toThrow(/auth|invite|not found/)
    const guest = await manager.join({
      roomCode: host.roomCode, invite: '', displayName: '南', role: 'sit', local: true,
    })
    expect(guest.seat).toBe(1)
    await manager.dispose()
  })

  it('advances bidding turn after a call so the next seat can rob', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)

    const players = [
      { playerId: host.hostPlayerId, seat: 0 as const },
      { playerId: a.playerId, seat: a.seat! },
      { playerId: b.playerId, seat: b.seat! },
    ]
    const firstView = manager.view(host.roomId, host.hostPlayerId)
    expect(firstView.room.phase).toBe('bidding')
    expect(firstView.auction?.kind).toBe('call')
    const firstSeat = firstView.turnSeat
    expect(firstSeat).not.toBeNull()
    const caller = players.find((player) => player.seat === firstSeat)
    expect(caller).toBeDefined()
    await manager.command(host.roomId, caller!.playerId, { type: 'bid', action: 'call' })

    const afterCall = manager.view(host.roomId, caller!.playerId)
    expect(afterCall.auction?.kind).toBe('rob')
    expect(afterCall.turnSeat).not.toBe(firstSeat)
    expect(afterCall.turnSeat).toBe(((firstSeat! + 1) % 3))
    await expect(manager.command(host.roomId, caller!.playerId, { type: 'bid', action: 'rob' }))
      .rejects.toThrow(/not your bid/)

    const nextPlayer = players.find((player) => player.seat === afterCall.turnSeat)
    expect(nextPlayer).toBeDefined()
    const nextView = manager.view(host.roomId, nextPlayer!.playerId)
    expect(nextView.turnSeat).toBe(nextPlayer!.seat)
    expect(nextView.auction?.kind).toBe('rob')
    await manager.command(host.roomId, nextPlayer!.playerId, { type: 'bid', action: 'rob' })
    const afterRob = manager.view(host.roomId, nextPlayer!.playerId)
    expect(afterRob.turnSeat).not.toBe(nextPlayer!.seat)
    expect(afterRob.auction?.kind).toBe('rob')
    await manager.dispose()
  })

  it('auto-plays the current seat on turn timeout instead of closing the room', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0, turnTimeoutMs: 1_000 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    const started = manager.view(host.roomId, host.hostPlayerId)
    expect(started.room.phase).toBe('bidding')
    const firstTurn = started.turnSeat
    manager.tickForTest(Date.parse(started.deadlineAt!) + 1)
    const after = manager.view(host.roomId, host.hostPlayerId)
    expect(after.room.phase).not.toBe('closed')
    expect(after.room.phase).not.toBe('waiting')
    expect(after.turnSeat).not.toBe(firstTurn)
    expect(after.room.seats.every((seat) => seat.playerId)).toBe(true)
    expect(after.room.seats.every((seat) => seat.connected)).toBe(true)
    expect(after.room.seats.find((seat) => seat.seat === firstTurn)?.autoPlay).toBe(true)
    expect(after.room.seats.filter((seat) => seat.autoPlay)).toHaveLength(1)
    manager.tickForTest(Date.parse(after.deadlineAt!) + 1)
    const hosted = manager.view(host.roomId, host.hostPlayerId)
    expect(hosted.room.seats.filter((seat) => seat.autoPlay).length).toBeGreaterThanOrEqual(2)
    expect(hosted.room.seats.every((seat) => seat.connected)).toBe(true)
    await manager.dispose()
  })

  it('auto-plays a card when the playing deadline expires', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0, turnTimeoutMs: 1_000 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    const players = [
      { playerId: host.hostPlayerId, seat: 0 as const },
      { playerId: a.playerId, seat: a.seat! },
      { playerId: b.playerId, seat: b.seat! },
    ]
    const first = manager.view(host.roomId, host.hostPlayerId)
    const caller = players.find((player) => player.seat === first.turnSeat)
    await manager.command(host.roomId, caller!.playerId, { type: 'bid', action: 'call' })
    for (let i = 0; i < 4; i += 1) {
      const view = manager.view(host.roomId, host.hostPlayerId)
      if (view.room.phase !== 'bidding') break
      const next = players.find((player) => player.seat === view.turnSeat)
      await manager.command(host.roomId, next!.playerId, { type: 'bid', action: 'pass' })
    }
    const doubling = manager.view(host.roomId, host.hostPlayerId)
    expect(doubling.room.phase).toBe('doubling')
    manager.tickForTest(Date.parse(doubling.deadlineAt!) + 1)
    const playing = manager.view(host.roomId, host.hostPlayerId)
    expect(playing.room.phase).toBe('playing')
    expect(playing.lastPlays).toHaveLength(0)
    const leadSeat = playing.turnSeat
    manager.tickForTest(Date.parse(playing.deadlineAt!) + 1)
    const after = manager.view(host.roomId, host.hostPlayerId)
    expect(after.room.phase).toBe('playing')
    expect(after.lastPlays.length).toBeGreaterThan(0)
    expect(after.lastPlays.at(-1)?.seat).toBe(leadSeat)
    expect(after.lastPlays.at(-1)?.type).not.toBe('pass')
    expect(after.turnSeat).not.toBe(leadSeat)
    expect(after.room.seats.every((seat) => seat.playerId)).toBe(true)
    expect(after.room.seats.find((seat) => seat.seat === leadSeat)?.autoPlay).toBe(true)
    expect(after.room.seats.every((seat) => seat.connected)).toBe(true)
    await manager.dispose()
  })

  it('marks a dropped socket as 托管 and keeps the others online', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0, turnTimeoutMs: 120_000 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    const before = manager.view(host.roomId, host.hostPlayerId)
    const players = [
      { playerId: host.hostPlayerId, seat: 0 as const },
      { playerId: a.playerId, seat: a.seat! },
      { playerId: b.playerId, seat: b.seat! },
    ]
    const current = players.find((player) => player.seat === before.turnSeat)!
    const other = players.find((player) => player.seat !== current.seat)!
    const t0 = Date.now()
    manager.markDisconnected(current.playerId, host.roomId)
    const view = manager.view(host.roomId, host.hostPlayerId)
    expect(view.room.seats[current.seat]?.connected).toBe(false)
    expect(view.room.seats[current.seat]?.autoPlay).toBe(true)
    expect(view.room.seats[other.seat]?.connected).toBe(true)
    expect(view.room.seats[other.seat]?.autoPlay).toBe(false)
    const remain = Date.parse(view.deadlineAt!) - t0
    expect(remain).toBeGreaterThan(AUTO_PLAY_MS - 50)
    expect(remain).toBeLessThanOrEqual(AUTO_PLAY_MS + 50)
    manager.markConnected(current.playerId, host.roomId, true)
    const resumed = manager.view(host.roomId, host.hostPlayerId)
    expect(resumed.room.seats[current.seat]?.connected).toBe(true)
    expect(resumed.room.seats[current.seat]?.autoPlay).toBe(true)
    await manager.command(host.roomId, current.playerId, { type: 'chat', text: '我回来了' })
    expect(manager.view(host.roomId, host.hostPlayerId).room.seats[current.seat]?.autoPlay).toBe(true)
    await manager.dispose()
  })

  it('holds cards during the dealing phase until the animation window ends', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 30_000 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    const dealing = manager.view(host.roomId, host.hostPlayerId)
    expect(dealing.room.phase).toBe('dealing')
    expect(dealing.you.cards).toEqual([])
    expect(dealing.publicHands).toEqual([0, 0, 0])
    await manager.dispose()
  })

  it('happy-call last robber becomes landlord; caller cannot rob back', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    const players = [
      { playerId: host.hostPlayerId, seat: 0 as const },
      { playerId: a.playerId, seat: a.seat! },
      { playerId: b.playerId, seat: b.seat! },
    ]
    const first = manager.view(host.roomId, host.hostPlayerId)
    const caller = players.find((player) => player.seat === first.turnSeat)!
    await manager.command(host.roomId, caller.playerId, { type: 'bid', action: 'call' })
    const afterCall = manager.view(host.roomId, host.hostPlayerId)
    const second = players.find((player) => player.seat === afterCall.turnSeat)!
    await manager.command(host.roomId, second.playerId, { type: 'bid', action: 'rob' })
    const afterRob = manager.view(host.roomId, host.hostPlayerId)
    const third = players.find((player) => player.seat === afterRob.turnSeat)!
    await manager.command(host.roomId, third.playerId, { type: 'bid', action: 'rob' })
    const locked = manager.view(host.roomId, host.hostPlayerId)
    expect(locked.room.phase).toBe('doubling')
    expect(locked.room.seats[third.seat]?.role).toBe('landlord')
    expect(locked.bid).toBe(4)
    await expect(manager.command(host.roomId, caller.playerId, { type: 'bid', action: 'rob' }))
      .rejects.toThrow(/expected bidding|already acted|not your bid/)
    await manager.dispose()
  })

  it('reports the local double answer without waiting for the rest of the table', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    const players = [
      { playerId: host.hostPlayerId, seat: 0 as const },
      { playerId: a.playerId, seat: a.seat! },
      { playerId: b.playerId, seat: b.seat! },
    ]
    const first = manager.view(host.roomId, host.hostPlayerId)
    const caller = players.find((player) => player.seat === first.turnSeat)!
    await manager.command(host.roomId, caller.playerId, { type: 'bid', action: 'call' })
    for (let i = 0; i < 4; i += 1) {
      const view = manager.view(host.roomId, host.hostPlayerId)
      if (view.room.phase !== 'bidding') break
      const next = players.find((player) => player.seat === view.turnSeat)
      await manager.command(host.roomId, next!.playerId, { type: 'bid', action: 'pass' })
    }
    const before = manager.view(host.roomId, a.playerId)
    expect(before.room.phase).toBe('doubling')
    expect(before.yourDouble).toBeNull()
    await manager.command(a.roomId, a.playerId, { type: 'double', action: 'double' })
    const answered = manager.view(host.roomId, a.playerId)
    const waiting = manager.view(host.roomId, b.playerId)
    expect(answered.room.phase).toBe('doubling')
    expect(answered.yourDouble).toBe('double')
    expect(waiting.yourDouble).toBeNull()
    await manager.dispose()
  })

  it('records pre-deal ming pai as ×5 and gives that seat first call', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'mingPai' })
    expect(manager.view(host.roomId, a.playerId).mingPaiBySeat[a.seat!]).toBe(true)
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    const view = manager.view(host.roomId, a.playerId)
    expect(view.room.phase).toBe('bidding')
    expect(view.turnSeat).toBe(a.seat)
    expect(view.mingPaiBySeat[a.seat!]).toBe(true)
    await manager.dispose()
  })

  it('lets a seated player ming pai while cards are still flying', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 30_000 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    expect(manager.view(host.roomId, host.hostPlayerId).room.phase).toBe('dealing')
    await manager.command(host.roomId, a.playerId, { type: 'mingPai' })
    expect(manager.view(host.roomId, a.playerId).mingPaiBySeat[a.seat!]).toBe(true)
    await manager.dispose()
  })

  it('frees a waiting seat when a guest disconnects, ready or not', async () => {
    const manager = new RoomManager(null, { leaveWaitingMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    expect(a.seat).toBe(1)
    manager.markDisconnected(a.playerId, host.roomId)
    expect(manager.view(host.roomId, host.hostPlayerId).room.seats[1]?.playerId).toBeNull()

    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    expect(b.seat).toBe(1)
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    expect(manager.view(host.roomId, host.hostPlayerId).room.seats[1]?.ready).toBe(true)
    manager.markDisconnected(b.playerId, host.roomId)
    const after = manager.view(host.roomId, host.hostPlayerId)
    expect(after.room.seats[1]?.playerId).toBeNull()
    expect(after.room.seats[1]?.ready).toBe(false)
    await manager.dispose()
  })

  it('keeps a disconnected guest through the grace window if they reconnect', async () => {
    const manager = new RoomManager(null, { leaveWaitingMs: 5_000 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const t0 = Date.now()
    manager.markDisconnected(a.playerId, host.roomId)
    expect(manager.view(host.roomId, host.hostPlayerId).room.seats[1]?.playerId).toBe(a.playerId)
    manager.markConnected(a.playerId, host.roomId, true)
    manager.tickForTest(t0 + 6_000)
    expect(manager.view(host.roomId, host.hostPlayerId).room.seats[1]?.playerId).toBe(a.playerId)
    await manager.dispose()
  })

  it('does not free the host seat or an in-hand seat on disconnect', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0, leaveWaitingMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    manager.markDisconnected(host.hostPlayerId, host.roomId)
    expect(manager.view(host.roomId, host.hostPlayerId).room.seats[0]?.playerId).toBe(host.hostPlayerId)

    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    manager.markDisconnected(a.playerId, host.roomId)
    const view = manager.view(host.roomId, host.hostPlayerId)
    expect(view.room.phase).toBe('bidding')
    expect(view.room.seats[a.seat!]?.playerId).toBe(a.playerId)
    expect(view.room.seats[a.seat!]?.connected).toBe(false)
    await manager.dispose()
  })

  it('drops a waiting spectator after disconnect', async () => {
    const manager = new RoomManager(null, { leaveWaitingMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const watcher = await manager.join({
      roomCode: host.roomCode, invite, displayName: '北', role: 'watch',
    })
    expect(watcher.seat).toBeNull()
    expect(manager.view(host.roomId, host.hostPlayerId).room.spectatorIds).toContain(watcher.playerId)
    manager.markDisconnected(watcher.playerId, host.roomId)
    expect(manager.view(host.roomId, host.hostPlayerId).room.spectatorIds).not.toContain(watcher.playerId)
    await manager.dispose()
  })

  it('treats the same browser id as one person already in the room', async () => {
    const manager = new RoomManager(null, {}, null)
    const host = await manager.createRoom({
      stakeM: 1, maxMultiplier: 8, hostDisplayName: '东', browserId: 'hostxxxx1',
    })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    await expect(manager.join({
      roomCode: host.roomCode, invite, displayName: '冒牌房主', role: 'sit', browserId: 'hostxxxx1',
    })).rejects.toThrow(/already in this room/)

    const a = await manager.join({
      roomCode: host.roomCode, invite, displayName: '南', role: 'sit', browserId: 'guestxxx1',
    })
    expect(a.seat).toBe(1)
    await expect(manager.join({
      roomCode: host.roomCode, invite, displayName: '南2', role: 'sit', browserId: 'guestxxx1',
    })).rejects.toThrow(/already in this room/)
    await expect(manager.join({
      roomCode: host.roomCode, invite, displayName: '南3', role: 'sit', cookie: a.cookie,
    })).rejects.toThrow(/already in this room/)

    const preview = await manager.peek({ roomCode: host.roomCode, invite, browserId: 'guestxxx1' })
    expect(preview.alreadyInRoom).toBe(true)
    expect(preview.canSit).toBe(false)

    const other = await manager.join({
      roomCode: host.roomCode, invite, displayName: '西', role: 'sit', browserId: 'guestxxx2',
    })
    expect(other.seat).toBe(2)
    expect(other.playerId).not.toBe(a.playerId)
    await manager.dispose()
  })

  it('allows the same browser to sit again after leaving', async () => {
    const manager = new RoomManager(null, { leaveWaitingMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({
      roomCode: host.roomCode, invite, displayName: '南', role: 'sit', browserId: 'guestxxx1',
    })
    manager.leave(a.playerId, host.roomId)
    expect(manager.view(host.roomId, host.hostPlayerId).room.seats[1]?.playerId).toBeNull()
    const again = await manager.join({
      roomCode: host.roomCode, invite, displayName: '南', role: 'sit', browserId: 'guestxxx1',
    })
    expect(again.seat).toBe(1)
    expect(again.playerId).not.toBe(a.playerId)
    await manager.dispose()
  })

  it('rejects a second in-flight join from the same browser', async () => {
    const manager = new RoomManager(null, {}, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const first = manager.join({
      roomCode: host.roomCode, invite, displayName: '南', role: 'sit', browserId: 'racexxxx1',
    })
    const second = manager.join({
      roomCode: host.roomCode, invite, displayName: '南2', role: 'sit', browserId: 'racexxxx1',
    })
    const settled = await Promise.allSettled([first, second])
    const ok = settled.filter((item) => item.status === 'fulfilled')
    const bad = settled.filter((item) => item.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(bad).toHaveLength(1)
    expect((bad[0] as PromiseRejectedResult).reason).toMatchObject({ message: expect.stringMatching(/already in this room/) })
    const view = manager.view(host.roomId, host.hostPlayerId)
    expect(view.room.seats.filter((seat) => seat.playerId).length).toBe(2)
    await manager.dispose()
  })

  it('settles when a seat empties, shows the ledger, and lets the host rematch', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)

    const last = manager.armLastCardForTest(host.roomId, 0, 0)
    await manager.command(host.roomId, host.hostPlayerId, { type: 'play', cards: [last], nonce: 'end-1' })
    const settled = manager.view(host.roomId, host.hostPlayerId)
    expect(settled.room.phase).toBe('waiting')
    expect(settled.settlement?.winner).toBe('landlord')
    expect(settled.settlement?.deltas).toHaveLength(3)
    const deltaSum = settled.settlement!.deltas.reduce((sum, delta) => sum + parseAtoms(delta.atoms), 0n)
    expect(deltaSum).toBe(0n)
    const guestView = manager.view(host.roomId, a.playerId)
    expect(guestView.settlement?.settlementId).toBe(settled.settlement?.settlementId)
    expect(guestView.room.seats.every((seat) => !seat.ready)).toBe(true)

    await expect(manager.command(host.roomId, a.playerId, { type: 'rematch' }))
      .rejects.toMatchObject({ message: 'host only' })

    await manager.command(host.roomId, host.hostPlayerId, { type: 'rematch' }, true)
    const lobby = manager.view(host.roomId, a.playerId)
    expect(lobby.settlement).toBeNull()
    expect(lobby.room.phase).toBe('waiting')
    expect(lobby.room.seats.every((seat) => !seat.ready)).toBe(true)

    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    const again = manager.view(host.roomId, host.hostPlayerId)
    expect(again.room.phase).toBe('bidding')
    expect(again.settlement).toBeNull()
    const cap = seatCapAtoms(1_000_000n, 8, 3)
    expect(parseAtoms(manager.ledgerFor(host.hostPlayerId).escrowAtoms)).toBe(cap)
    await manager.dispose()
  })

  it('host close after a hand sends everyone back out of the room', async () => {
    const manager = new RoomManager(null, { dealAnimMs: 0 }, null)
    const host = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '东' })
    const invite = new URL(host.sitUrl).searchParams.get('invite') ?? ''
    const a = await manager.join({ roomCode: host.roomCode, invite, displayName: '南', role: 'sit' })
    const b = await manager.join({ roomCode: host.roomCode, invite, displayName: '西', role: 'sit' })
    await manager.command(a.roomId, a.playerId, { type: 'ready', ready: true })
    await manager.command(b.roomId, b.playerId, { type: 'ready', ready: true })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'start' }, true)
    const last = manager.armLastCardForTest(host.roomId, a.seat!, 0)
    await manager.command(host.roomId, a.playerId, { type: 'play', cards: [last], nonce: 'end-2' })
    expect(manager.view(host.roomId, a.playerId).settlement?.winner).toBe('farmers')

    const left: string[] = []
    manager.onEvent((playerId, event: ServerEvent) => {
      if (event.type === 'left') left.push(playerId)
    })
    await manager.command(host.roomId, host.hostPlayerId, { type: 'hostClose' }, true)
    expect(manager.view(host.roomId, host.hostPlayerId).room.phase).toBe('closed')
    expect(left).toEqual(expect.arrayContaining([host.hostPlayerId, a.playerId, b.playerId]))
    await expect(manager.join({
      roomCode: host.roomCode, invite, displayName: '晚到', role: 'sit',
    })).rejects.toMatchObject({ message: 'room not found' })
    await manager.dispose()
  })
})
