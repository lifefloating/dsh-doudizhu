import { addHours, cookieValue, inviteHash, nowIso, randomId, randomRoomCode, randomToken, sha256Hex } from '../crypto.ts'
import {
  applyBid, applyDouble, applyMingPai, applyPass, applyPlay, autoTimeout, createHand, expireDoubling,
  legalFor, snapshotHand, type EngineState,
} from '../engine/play.ts'
import { scoreHand } from '../engine/score.ts'
import { rankOf } from '../engine/cards.ts'
import { newPlayerId, sanitizeAvatarUrl, sanitizeDisplayName, sanitizeRoomTitle } from '../identity/player.ts'
import { MAX_CHAT, MAX_SPECTATORS } from '../invariant.ts'
import { createMemoryDomain, openDoudizhuDomain, type DomainLike } from '../persist/domain.ts'
import { createCounters, type HealthCounters } from '../settle/audit.ts'
import { issueHostGrant, persistGrant } from '../settle/grant.ts'
import { Ledger } from '../settle/ledger.ts'
import { seatCapAtoms } from '../settle/math.ts'
import {
  asRoomId, asTokenAtomString, dealtHandSize, decksFor, landlordHandSize, nextSeat, parseAtoms, prevSeat,
  type BidAction, type CardId, type ClientCommand, type DoubleAction, type PlayerId, type PlayerView,
  type PublicSettlement, type RejectCode, type Room, type RoomId, type Seat, type SeatCount, type SeatState,
  type ServerEvent,
} from '../types.ts'
import { assertCreateEconomy, resolveConfig, validatePublicBaseUrl, type PluginConfig, type ResolvedConfig } from '../config.ts'

export interface JoinRequest {
  roomCode: string
  invite: string
  displayName: string
  role: 'sit' | 'watch'
  local?: boolean
}

export interface JoinResult {
  playerId: PlayerId
  roomId: RoomId
  seat: Seat | null
  wsTicket: string
  cookie: string
  view: PlayerView
}

export interface CreateRoomRequest {
  stakeM: number
  maxMultiplier: number
  seatCount?: SeatCount
  laiZi?: boolean
  hostDisplayName?: string
  title?: string
}

export interface CreateRoomResult {
  roomId: RoomId
  roomCode: string
  sitUrl: string
  watchUrl: string
  seatCapAtoms: string
  shareable: boolean
  hostCookie: string
  hostPlayerId: PlayerId
  view: PlayerView
}

export interface Session {
  cookie: string
  playerId: PlayerId
  roomId: RoomId
  kind: 'seat' | 'watch' | 'host'
  expiresAt: number
}

interface Ticket {
  playerId: PlayerId
  roomId: RoomId
  expiresAt: number
}

interface LiveRoom {
  room: Room
  secret: string
  sitInviteHash: string
  sitToken: string
  watchInviteHash: string
  watchToken: string
  sitConsumed: boolean
  lastLandlordSeat: Seat | null
  engine: EngineState | null
  deadlineAt: number | null
  seq: number
  events: ServerEvent[]
  chat: PlayerView['chat'][number][]
  nonces: Set<string>
  disconnectedAt: Map<PlayerId, number>
  autoPlay: Set<Seat>
  lastSettlement: PublicSettlement | null
  needsAudit: boolean
}

export type ViewListener = (playerId: PlayerId, event: ServerEvent) => void

export class RoomManager {
  private config: ResolvedConfig
  private domain: DomainLike
  private ledger: Ledger
  private readonly rooms = new Map<RoomId, LiveRoom>()
  private readonly roomsByCode = new Map<string, RoomId>()
  private readonly sessions = new Map<string, Session>()
  private readonly tickets = new Map<string, Ticket>()
  private readonly hostCookies = new Set<string>()
  private readonly listeners = new Set<ViewListener>()
  private readonly timers = new Set<ReturnType<typeof setInterval>>()
  readonly counters = createCounters()
  private persistReady: Promise<void>

  constructor(
    private readonly ctx: { logger?: { warn(message: unknown): void; info(message: unknown): void }; webServer?: { port?: number } } | null,
    config: PluginConfig,
    storage: unknown,
  ) {
    this.config = resolveConfig(config)
    this.domain = createMemoryDomain()
    this.ledger = new Ledger(this.domain, this.config.welcomeAtoms)
    this.persistReady = this.hydrate(storage)
    const tick = setInterval(() => { this.onTick(Date.now()) }, 250)
    this.timers.add(tick)
    if (typeof tick === 'object' && 'unref' in tick) tick.unref()
  }

  async ready(): Promise<void> {
    await this.persistReady
  }

  replaceConfig(config: PluginConfig): void {
    this.config = resolveConfig(config)
    this.ledger.replaceWelcome(this.config.welcomeAtoms)
  }

  getConfig(): ResolvedConfig {
    return this.config
  }

  onEvent(listener: ViewListener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async dispose(): Promise<void> {
    for (const timer of this.timers) clearInterval(timer)
    this.timers.clear()
    await this.domain.close()
  }

  health(): HealthCounters {
    return {
      roomsActive: [...this.rooms.values()].filter((room) => room.room.phase !== 'closed').length,
      handsStarted: this.counters.handsStarted,
      handsVoided: this.counters.handsVoided,
      wsConnected: this.counters.wsConnected,
      cmdRejected: this.counters.cmdRejected,
      settlementsCommitted: this.counters.settlementsCommitted,
      needsAudit: [...this.rooms.values()].some((room) => room.needsAudit) || this.counters.needsAudit,
      uptimeMs: this.counters.uptimeMs,
    }
  }

  async createRoom(req: CreateRoomRequest, hostCookie?: string): Promise<CreateRoomResult> {
    await this.ready()
    if (!this.config.enabled) throw fail('phase', 'plugin disabled')
    if (this.rooms.size >= this.config.maxRooms) throw fail('room-full', 'too many rooms')
    const seatCount: SeatCount = req.seatCount === 4 ? 4 : 3
    const laiZi = req.laiZi === true
    assertCreateEconomy(this.config.welcomeAtoms, req.stakeM, req.maxMultiplier, seatCount)
    const publicBase = this.config.publicBaseUrl ? validatePublicBaseUrl(this.config.publicBaseUrl) : ''
    const roomId = asRoomId(randomId('rm'))
    const roomCode = this.uniqueCode()
    const secret = randomToken()
    const sitToken = randomToken()
    const watchToken = randomToken()
    const hostPlayerId = newPlayerId()
    const displayName = sanitizeDisplayName(req.hostDisplayName ?? '房主')
    const title = sanitizeRoomTitle(req.title ?? '好友局')
    await this.ledger.ensurePlayer(hostPlayerId, displayName, null)
    const stakeAtoms = BigInt(req.stakeM) * 1_000_000n
    const now = nowIso()
    const room: Room = {
      roomId,
      roomCode,
      title,
      hostPlayerId,
      phase: 'waiting',
      stakeAtoms,
      maxMultiplier: req.maxMultiplier,
      seatCount,
      laiZi,
      seats: Array.from({ length: seatCount }, (_, index) => emptySeat(index as Seat)),
      spectatorIds: [],
      currentHandId: null,
      createdAt: now,
      inviteExpiresAt: addHours(this.config.inviteTtlHours),
      shareable: publicBase !== '',
    }
    const live: LiveRoom = {
      room,
      secret,
      sitInviteHash: inviteHash(secret, 'sit', sitToken),
      sitToken,
      watchInviteHash: inviteHash(secret, 'watch', watchToken),
      watchToken,
      sitConsumed: false,
      lastLandlordSeat: null,
      engine: null,
      deadlineAt: null,
      seq: 0,
      events: [],
      chat: [],
      nonces: new Set(),
      disconnectedAt: new Map(),
      autoPlay: new Set(),
      lastSettlement: null,
      needsAudit: false,
    }
    this.rooms.set(roomId, live)
    this.roomsByCode.set(roomCode, roomId)
    await this.persistRoom(live)
    const cookie = hostCookie ?? cookieValue()
    this.hostCookies.add(cookie)
    this.sessions.set(cookie, {
      cookie,
      playerId: hostPlayerId,
      roomId,
      kind: 'host',
      expiresAt: Date.now() + 86_400_000,
    })
    await this.sitInternal(live, hostPlayerId, 0, displayName, true)
    const origin = publicBase || `http://127.0.0.1:${this.listenPort()}`
    return {
      roomId,
      roomCode,
      sitUrl: `${origin}${this.config.routePrefix}/join?code=${roomCode}&invite=${sitToken}`,
      watchUrl: `${origin}${this.config.routePrefix}/join?code=${roomCode}&invite=${watchToken}&role=watch`,
      seatCapAtoms: seatCapAtoms(stakeAtoms, req.maxMultiplier, seatCount).toString(),
      shareable: room.shareable,
      hostCookie: cookie,
      hostPlayerId,
      view: this.viewFor(live, hostPlayerId),
    }
  }

  async join(req: JoinRequest): Promise<JoinResult> {
    await this.ready()
    const live = this.roomByCode(req.roomCode)
    if (!live || live.room.phase === 'closed') throw fail('expired', 'room not found')
    if (Date.parse(live.room.inviteExpiresAt) < Date.now()) throw fail('expired', 'invite expired')
    const displayName = sanitizeDisplayName(req.displayName)
    const playerId = newPlayerId()
    await this.ledger.ensurePlayer(playerId, displayName, sanitizeAvatarUrl(null, this.config.routePrefix))
    const invite = req.invite.trim()
    const sitOk = invite
      ? sha256Hex(`${live.secret}|sit|${invite}`) === live.sitInviteHash
      : Boolean(req.local)
    const watchOk = invite
      ? sha256Hex(`${live.secret}|watch|${invite}`) === live.watchInviteHash
      : false
    if (!sitOk && !watchOk) throw fail('auth', invite ? 'invalid invite' : 'room not found')
    const empty = this.firstEmptySeat(live)
    const canSit = live.room.phase === 'waiting' && empty !== null && req.role !== 'watch'
    let seat: Seat | null = null
    if (canSit) {
      await this.sitInternal(live, playerId, empty, displayName, true)
      seat = empty
      if (this.firstEmptySeat(live) === null) live.sitConsumed = true
      await this.maybeDeal(live)
    } else {
      if (!this.config.allowSpectators) throw fail('auth', 'spectators disabled')
      live.sitConsumed = live.sitConsumed || empty === null || live.room.phase !== 'waiting'
      this.addSpectator(live, playerId)
    }
    const cookie = cookieValue()
    this.sessions.set(cookie, {
      cookie,
      playerId,
      roomId: live.room.roomId,
      kind: seat === null ? 'watch' : 'seat',
      expiresAt: Date.now() + 86_400_000,
    })
    this.broadcast(live)
    return {
      playerId,
      roomId: live.room.roomId,
      seat,
      wsTicket: this.issueTicket(playerId, live.room.roomId),
      cookie,
      view: this.viewFor(live, playerId),
    }
  }

  sessionByCookie(cookie: string | undefined): Session | undefined {
    if (!cookie) return undefined
    const session = this.sessions.get(cookie)
    if (!session || session.expiresAt < Date.now()) return undefined
    return session
  }

  isHostCookie(cookie: string | undefined): boolean {
    return Boolean(cookie && this.hostCookies.has(cookie) && this.sessionByCookie(cookie))
  }

  consumeTicket(ticket: string): Ticket | undefined {
    const found = this.tickets.get(ticket)
    this.tickets.delete(ticket)
    if (!found || found.expiresAt < Date.now()) return undefined
    return found
  }

  issueTicket(playerId: PlayerId, roomId: RoomId): string {
    const ticket = randomToken()
    this.tickets.set(ticket, { playerId, roomId, expiresAt: Date.now() + 60_000 })
    return ticket
  }

  view(roomId: RoomId, playerId: PlayerId): PlayerView {
    return this.viewFor(this.requireRoom(roomId), playerId)
  }

  eventsSince(roomId: RoomId, playerId: PlayerId, seq: number): { events: ServerEvent[]; untilSeq: number } {
    const live = this.requireRoom(roomId)
    const events: ServerEvent[] = []
    if (live.seq > seq) events.push({ type: 'snapshot', seq: live.seq, view: this.viewFor(live, playerId) })
    if (live.lastSettlement) events.push({ type: 'settled', seq: live.seq, settlement: live.lastSettlement })
    if (events.length === 0) events.push({ type: 'snapshot', seq: live.seq, view: this.viewFor(live, playerId) })
    return { events, untilSeq: live.seq }
  }

  ledgerFor(playerId: PlayerId) {
    return this.ledger.snapshot(playerId)
  }

  async command(roomId: RoomId, playerId: PlayerId, command: ClientCommand, isHost = false): Promise<{ seq: number }> {
    const live = this.requireRoom(roomId)
    try {
      if ('nonce' in command && command.nonce) {
        if (live.nonces.has(command.nonce)) throw fail('duplicate-nonce', 'duplicate play nonce')
        live.nonces.add(command.nonce)
      }
      switch (command.type) {
        case 'sit':
          await this.sitInternal(live, playerId, command.seat, sanitizeDisplayName(command.displayName), false)
          break
        case 'stand':
          this.stand(live, playerId)
          break
        case 'ready':
          await this.setReady(live, playerId, command.ready)
          break
        case 'bid':
          this.bid(live, playerId, command.action)
          break
        case 'double':
          this.double(live, playerId, command.action)
          break
        case 'mingPai':
          this.mingPai(live, playerId)
          break
        case 'rename':
          this.rename(live, playerId, command.title, isHost)
          break
        case 'play':
          this.play(live, playerId, command.cards)
          break
        case 'pass':
          this.pass(live, playerId)
          break
        case 'chat':
          this.chat(live, playerId, command.text)
          break
        case 'rematch':
          await this.rematch(live, playerId)
          break
        case 'hostKick':
          if (!isHost && live.room.hostPlayerId !== playerId) throw fail('auth', 'host only')
          this.kick(live, command.playerId)
          break
        case 'hostClose':
          if (!isHost && live.room.hostPlayerId !== playerId) throw fail('auth', 'host only')
          await this.closeRoom(live)
          break
        case 'ping':
          this.emit(live, { type: 'pong', ts: Date.now() }, playerId)
          return { seq: live.seq }
        default:
          throw fail('illegal', 'unknown command')
      }
      this.broadcast(live)
      return { seq: live.seq }
    } catch (error) {
      this.counters.bump('cmdRejected')
      throw error
    }
  }

  markConnected(playerId: PlayerId, roomId: RoomId): void {
    const live = this.rooms.get(roomId)
    if (!live) return
    live.disconnectedAt.delete(playerId)
    live.autoPlay.delete(this.seatOf(live, playerId) ?? 0)
    this.setConnected(live, playerId, true)
    this.broadcast(live)
  }

  markDisconnected(playerId: PlayerId, roomId: RoomId): void {
    const live = this.rooms.get(roomId)
    if (!live) return
    live.disconnectedAt.set(playerId, Date.now())
    this.setConnected(live, playerId, false)
    this.broadcast(live)
  }

  listenPort = (): number => this.ctx?.webServer?.port ?? 3080

  private async hydrate(storage: unknown): Promise<void> {
    const opened = await openDoudizhuDomain(storage)
    if (!opened) return
    this.domain = opened
    this.ledger = new Ledger(this.domain, this.config.welcomeAtoms)
  }

  private uniqueCode(): string {
    for (let i = 0; i < 20; i += 1) {
      const code = randomRoomCode()
      if (!this.roomsByCode.has(code)) return code
    }
    throw new Error('could not allocate room code')
  }

  private roomByCode(code: string): LiveRoom | undefined {
    const id = this.roomsByCode.get(code)
    return id ? this.rooms.get(id) : undefined
  }

  private requireRoom(roomId: RoomId): LiveRoom {
    const live = this.rooms.get(roomId)
    if (!live) throw fail('expired', 'room not found')
    return live
  }

  private firstEmptySeat(live: LiveRoom): Seat | null {
    const empty = live.room.seats.find((seat) => seat.playerId === null)
    return empty ? empty.seat : null
  }

  private addSpectator(live: LiveRoom, playerId: PlayerId): void {
    if (live.room.spectatorIds.includes(playerId)) return
    if (live.room.spectatorIds.length >= MAX_SPECTATORS) throw fail('room-full', 'too many spectators')
    live.room = { ...live.room, spectatorIds: [...live.room.spectatorIds, playerId] }
  }

  private async sitInternal(live: LiveRoom, playerId: PlayerId, seat: Seat, displayName: string, isHost: boolean): Promise<void> {
    if (live.room.phase !== 'waiting') throw fail('phase', 'cannot sit now')
    const target = live.room.seats[seat]
    if (!target) throw fail('illegal', 'no such seat')
    if (target.playerId && target.playerId !== playerId) throw fail('room-full', 'seat taken')
    this.stand(live, playerId, false)
    const cap = seatCapAtoms(live.room.stakeAtoms, live.room.maxMultiplier, live.room.seatCount)
    const grant = issueHostGrant(playerId, live.room.roomId, cap)
    await persistGrant(this.domain, grant)
    const ready = isHost || live.room.phase === 'waiting'
    if (ready && this.ledger.getEscrow(playerId) < cap) {
      if (this.ledger.getAvailable(playerId) < cap) throw fail('insufficient', 'need more welcome atoms')
      await this.ledger.freeze(playerId, cap, live.room.roomId)
    }
    const seats = live.room.seats.map((item) => item.seat === seat
      ? {
          ...item,
          playerId,
          displayName,
          avatarUrl: null,
          ready,
          connected: true,
          role: 'empty' as const,
          grantId: grant.grantId,
          cardsLeft: 0,
        }
      : item)
    live.room = {
      ...live.room,
      seats,
      spectatorIds: live.room.spectatorIds.filter((id) => id !== playerId),
    }
  }

  private stand(live: LiveRoom, playerId: PlayerId, persist = true): void {
    if (live.room.phase !== 'waiting' && persist) throw fail('phase', 'cannot stand now')
    const seats = live.room.seats.map((item) => item.playerId === playerId ? emptySeat(item.seat) : item)
    live.room = { ...live.room, seats }
    live.sitConsumed = live.room.phase !== 'waiting' || this.firstEmptySeat(live) === null
    if (persist && this.ledger.getEscrow(playerId) > 0n) {
      void this.ledger.unfreeze(playerId, this.ledger.getEscrow(playerId), live.room.roomId)
    }
  }

  private async setReady(live: LiveRoom, playerId: PlayerId, ready: boolean): Promise<void> {
    if (live.room.phase !== 'waiting') throw fail('phase', 'not waiting')
    const seat = this.seatOf(live, playerId)
    if (seat === null) throw fail('illegal', 'not seated')
    if (ready) {
      const cap = seatCapAtoms(live.room.stakeAtoms, live.room.maxMultiplier, live.room.seatCount)
      if (this.ledger.getAvailable(playerId) < cap) throw fail('insufficient', 'need more welcome atoms')
      if (this.ledger.getEscrow(playerId) < cap) await this.ledger.freeze(playerId, cap, live.room.roomId)
    } else if (this.ledger.getEscrow(playerId) > 0n) {
      await this.ledger.unfreeze(playerId, this.ledger.getEscrow(playerId), live.room.roomId)
    }
    this.patchSeat(live, seat, { ready })
    await this.maybeDeal(live)
  }

  private async maybeDeal(live: LiveRoom): Promise<void> {
    const seated = live.room.seats
    if (!seated.every((seat) => seat.playerId && seat.ready && seat.grantId)) return
    const dealer = live.lastLandlordSeat === null ? null : nextSeat(live.lastLandlordSeat, live.room.seatCount)
    live.engine = createHand(live.room.roomId, dealer, this.counters.handsStarted + 1, {
      seatCount: live.room.seatCount,
      laiZi: live.room.laiZi,
    })
    this.counters.bump('handsStarted')
    live.room = {
      ...live.room,
      phase: 'bidding',
      currentHandId: live.engine.hand.handId,
      seats: seated.map((seat) => ({
        ...seat,
        role: 'farmer' as const,
        cardsLeft: dealtHandSize(live.room.seatCount),
      })),
    }
    live.deadlineAt = Date.now() + this.config.turnTimeoutMs
  }

  private bid(live: LiveRoom, playerId: PlayerId, action: BidAction): void {
    const engine = this.requireEngine(live, 'bidding')
    const seat = this.requireSeat(live, playerId)
    const result = applyBid(engine, seat, action)
    if (!result.ok) throw fail(result.code, result.reason)
    if (engine.phase === 'redeal') {
      const dealer = engine.hand.dealerSeat
      live.engine = createHand(live.room.roomId, dealer, this.counters.handsStarted + 1, {
        seatCount: live.room.seatCount,
        laiZi: live.room.laiZi,
      })
      this.counters.bump('handsStarted')
      live.room = { ...live.room, currentHandId: live.engine.hand.handId, phase: 'bidding' }
      live.deadlineAt = Date.now() + this.config.turnTimeoutMs
      return
    }
    if (engine.phase === 'doubling' && engine.hand.landlordSeat !== null) {
      this.patchSeat(live, engine.hand.landlordSeat, {
        role: 'landlord',
        cardsLeft: landlordHandSize(live.room.seatCount),
      })
      live.room = { ...live.room, phase: 'doubling' }
      live.deadlineAt = engine.doubleDeadlineAt
    }
  }

  private mingPai(live: LiveRoom, playerId: PlayerId): void {
    if (!live.engine) throw fail('phase', 'no hand')
    const seat = this.requireSeat(live, playerId)
    const result = applyMingPai(live.engine, seat)
    if (!result.ok) throw fail(result.code, result.reason)
  }

  private rename(live: LiveRoom, playerId: PlayerId, title: string, isHost: boolean): void {
    if (!isHost && live.room.hostPlayerId !== playerId) throw fail('auth', 'host only')
    live.room = { ...live.room, title: sanitizeRoomTitle(title, live.room.title) }
    void this.persistRoom(live)
  }

  private double(live: LiveRoom, playerId: PlayerId, action: DoubleAction): void {
    const engine = this.requireEngine(live, 'doubling')
    const seat = this.requireSeat(live, playerId)
    const result = applyDouble(engine, seat, action)
    if (!result.ok) throw fail(result.code, result.reason)
    if (engine.phase === 'playing') {
      live.room = { ...live.room, phase: 'playing' }
      live.deadlineAt = Date.now() + this.config.turnTimeoutMs
    }
  }

  private play(live: LiveRoom, playerId: PlayerId, cards: CardId[]): void {
    const engine = this.requireEngine(live, 'playing')
    const seat = this.requireSeat(live, playerId)
    const result = applyPlay(engine, seat, cards, live.seq + 1, nowIso())
    if (!result.ok) throw fail(result.code, result.reason)
    this.patchSeat(live, seat, { cardsLeft: engine.hand.hands[seat]?.length ?? 0 })
    if (engine.phase === 'settled') void this.settle(live)
    else live.deadlineAt = Date.now() + this.config.turnTimeoutMs
  }

  private pass(live: LiveRoom, playerId: PlayerId): void {
    const engine = this.requireEngine(live, 'playing')
    const seat = this.requireSeat(live, playerId)
    const result = applyPass(engine, seat, live.seq + 1, nowIso())
    if (!result.ok) throw fail(result.code, result.reason)
    live.deadlineAt = Date.now() + this.config.turnTimeoutMs
  }

  private chat(live: LiveRoom, playerId: PlayerId, text: string): void {
    const cleaned = text.replace(/[\u0000-\u001f]/g, '').slice(0, MAX_CHAT)
    if (!cleaned) return
    const name = this.displayNameOf(live, playerId)
    live.chat.push({ playerId, displayName: name, text: cleaned, ts: nowIso() })
    live.chat = live.chat.slice(-50)
  }

  private async rematch(live: LiveRoom, playerId: PlayerId): Promise<void> {
    if (live.room.phase !== 'waiting') throw fail('phase', 'not waiting')
    const seated = this.seatOf(live, playerId) !== null || live.room.hostPlayerId === playerId
    if (!seated) throw fail('illegal', 'not seated')
    for (const seat of live.room.seats) {
      if (seat.playerId) await this.setReady(live, seat.playerId, true)
    }
  }

  private kick(live: LiveRoom, playerId: PlayerId): void {
    if (live.room.phase !== 'waiting') throw fail('phase', 'cannot kick now')
    this.stand(live, playerId)
    live.room = { ...live.room, spectatorIds: live.room.spectatorIds.filter((id) => id !== playerId) }
    void this.persistRoom(live)
  }

  private async closeRoom(live: LiveRoom): Promise<void> {
    if (live.engine && (live.room.phase === 'playing' || live.room.phase === 'bidding' || live.room.phase === 'doubling')) {
      await this.voidHand(live)
    }
    for (const seat of live.room.seats) {
      if (seat.playerId && this.ledger.getEscrow(seat.playerId) > 0n) {
        await this.ledger.unfreeze(seat.playerId, this.ledger.getEscrow(seat.playerId), live.room.roomId)
      }
    }
    live.room = { ...live.room, phase: 'closed' }
  }

  private async settle(live: LiveRoom): Promise<void> {
    const engine = live.engine
    if (!engine || engine.hand.landlordSeat === null) return
    live.room = { ...live.room, phase: 'settling' }
    const playerIds = live.room.seats.map((seat) => seat.playerId) as PlayerId[]
    if (playerIds.some((id) => !id)) return
    const landlord = engine.hand.landlordSeat
    const winner = (engine.hand.hands[landlord] ?? []).length === 0 ? 'landlord' : 'farmers'
    const settlement = scoreHand({
      hand: snapshotHand(engine),
      stakeAtoms: live.room.stakeAtoms,
      maxMultiplier: live.room.maxMultiplier,
      winner,
      playerIds,
    })
    try {
      const landlordId = playerIds[landlord]
      if (!landlordId) throw fail('illegal', 'missing landlord')
      if (winner === 'landlord') {
        for (const delta of settlement.deltas) {
          const atoms = parseAtoms(delta.atoms)
          if (atoms < 0n) {
            await this.ledger.settleTransfer(delta.playerId, landlordId, -atoms, {
              roomId: live.room.roomId,
              handId: settlement.handId,
              settlementId: settlement.settlementId,
            })
          }
        }
      } else {
        for (const delta of settlement.deltas) {
          const atoms = parseAtoms(delta.atoms)
          if (atoms > 0n) {
            await this.ledger.settleTransfer(landlordId, delta.playerId, atoms, {
              roomId: live.room.roomId,
              handId: settlement.handId,
              settlementId: settlement.settlementId,
            })
          }
        }
      }
      for (const seat of live.room.seats) {
        if (seat.playerId) await this.ledger.unfreeze(seat.playerId, this.ledger.getEscrow(seat.playerId), live.room.roomId)
      }
    } catch (error) {
      live.needsAudit = true
      this.counters.needsAudit = true
      this.ctx?.logger?.warn(error)
      throw fail('illegal', 'settlement failed')
    }
    const publicSettlement: PublicSettlement = {
      ...settlement,
      trustNote: '好友局信任房主机器上的账本。积分 ≠ DeepSeek 平台余额。',
    }
    live.lastSettlement = publicSettlement
    live.lastLandlordSeat = landlord
    this.counters.bump('settlementsCommitted')
    live.engine = null
    live.room = {
      ...live.room,
      phase: 'waiting',
      currentHandId: null,
      seats: live.room.seats.map((seat) => ({
        ...seat,
        ready: false,
        role: 'empty' as const,
        cardsLeft: 0,
      })),
    }
    live.deadlineAt = null
    this.push(live, { type: 'settled', seq: ++live.seq, settlement: publicSettlement })
  }

  private async voidHand(live: LiveRoom): Promise<void> {
    for (const seat of live.room.seats) {
      if (seat.playerId) await this.ledger.unfreeze(seat.playerId, this.ledger.getEscrow(seat.playerId), live.room.roomId, 'void')
    }
    live.engine = null
    live.room = {
      ...live.room,
      phase: 'waiting',
      currentHandId: null,
      seats: live.room.seats.map((seat) => ({ ...seat, ready: false, role: 'empty' as const, cardsLeft: 0 })),
    }
    this.counters.bump('handsVoided')
  }

  private onTick(now: number): void {
    for (const live of this.rooms.values()) {
      if (live.room.phase === 'doubling' && live.engine) {
        expireDoubling(live.engine, now)
        if (live.engine.phase === 'playing') {
          live.room = { ...live.room, phase: 'playing' }
          live.deadlineAt = now + this.config.turnTimeoutMs
          this.broadcast(live)
        }
      }
      if (live.deadlineAt && now >= live.deadlineAt && live.engine && live.room.phase === 'playing') {
        const result = autoTimeout(live.engine, live.seq + 1, nowIso())
        if (result) {
          const seat = live.engine.hand.turnSeat
          const previous = prevSeat(seat, live.room.seatCount)
          this.patchSeat(live, previous, { cardsLeft: live.engine.hand.hands[previous]!.length })
          if (live.engine.phase === 'settled') void this.settle(live)
          else live.deadlineAt = now + this.config.turnTimeoutMs
          this.broadcast(live)
        }
      }
      for (const [playerId, at] of live.disconnectedAt) {
        if (now - at < this.config.reconnectWindowMs) continue
        const seat = this.seatOf(live, playerId)
        if (seat !== null && (live.room.phase === 'playing' || live.room.phase === 'bidding' || live.room.phase === 'doubling')) {
          live.autoPlay.add(seat)
        }
      }
      const seated = live.room.seats.filter((seat) => seat.playerId)
      if (seated.length > 0 && seated.every((seat) => !seat.connected) && live.disconnectedAt.size === live.room.seatCount) {
        const oldest = Math.min(...live.disconnectedAt.values())
        if (now - oldest > this.config.reconnectWindowMs && live.engine) {
          void this.voidHand(live)
          this.broadcast(live)
        }
      }
    }
  }

  private requireEngine(live: LiveRoom, phase: EngineState['phase']): EngineState {
    if (!live.engine || live.engine.phase !== phase) throw fail('phase', `expected ${phase}`)
    return live.engine
  }

  private requireSeat(live: LiveRoom, playerId: PlayerId): Seat {
    const seat = this.seatOf(live, playerId)
    if (seat === null) throw fail('illegal', 'not seated')
    return seat
  }

  private seatOf(live: LiveRoom, playerId: PlayerId): Seat | null {
    return live.room.seats.find((seat) => seat.playerId === playerId)?.seat ?? null
  }

  private displayNameOf(live: LiveRoom, playerId: PlayerId): string {
    return live.room.seats.find((seat) => seat.playerId === playerId)?.displayName
      ?? '玩家'
  }

  private patchSeat(live: LiveRoom, seat: Seat, patch: Partial<SeatState>): void {
    live.room = {
      ...live.room,
      seats: live.room.seats.map((item) => item.seat === seat ? { ...item, ...patch } : item),
    }
  }

  private setConnected(live: LiveRoom, playerId: PlayerId, connected: boolean): void {
    const seat = this.seatOf(live, playerId)
    if (seat !== null) this.patchSeat(live, seat, { connected })
  }

  private viewFor(live: LiveRoom, playerId: PlayerId): PlayerView {
    const seat = this.seatOf(live, playerId)
    const spectator = seat === null
    const engine = live.engine
    const cards = seat !== null && engine ? [...(engine.hand.hands[seat] ?? [])] : []
    const legal = seat !== null && engine ? legalFor(engine, seat) : { canPass: false, combos: [] }
    const bottomRevealed = Boolean(engine && engine.hand.landlordSeat !== null)
    const remainingRanks = spectator && this.config.spectatorCardCounter
      ? this.remainingRanks(live)
      : null
    return {
      room: {
        ...live.room,
        stakeAtoms: asTokenAtomString(live.room.stakeAtoms),
        seats: live.room.seats.map((item) => ({
          ...item,
          cardsLeft: engine ? (engine.hand.hands[item.seat]?.length ?? 0) : item.cardsLeft,
          role: engine?.hand.landlordSeat === item.seat
            ? 'landlord'
            : item.playerId
              ? (engine ? 'farmer' : item.role)
              : 'empty',
        })),
      },
      you: { playerId, seat, spectator, cards },
      publicHands: live.room.seats.map((item, index) => (
        engine ? (engine.hand.hands[index]?.length ?? 0) : item.cardsLeft
      )),
      lastPlays: engine ? engine.hand.table.slice(-6) : [],
      bottom: bottomRevealed && engine ? [...engine.hand.bottom] : null,
      laiZiRanks: engine?.hand.laiZiRanks ?? [],
      bid: engine?.hand.bid ?? 0,
      auction: engine && engine.phase === 'bidding'
        ? { kind: engine.called ? 'rob' : 'call', multiplier: Math.max(1, engine.hand.bid) }
        : null,
      revealedBySeat: this.revealedHands(live),
      mingPaiBySeat: engine ? { ...engine.hand.mingPaiBySeat } : {},
      turnSeat: engine?.hand.turnSeat ?? null,
      leadSeat: engine?.hand.leadSeat ?? null,
      deadlineAt: live.deadlineAt ? new Date(live.deadlineAt).toISOString() : null,
      yourAvailableAtoms: asTokenAtomString(this.ledger.getAvailable(playerId)),
      yourEscrowAtoms: asTokenAtomString(this.ledger.getEscrow(playerId)),
      legal,
      remainingRanks,
      chat: live.chat.slice(-20),
    }
  }

  private revealedHands(live: LiveRoom): Partial<Record<Seat, CardId[]>> {
    const engine = live.engine
    if (!engine) return {}
    const out: Partial<Record<Seat, CardId[]>> = {}
    for (const [raw, shown] of Object.entries(engine.hand.mingPaiBySeat)) {
      if (!shown) continue
      const seat = Number(raw) as Seat
      out[seat] = [...(engine.hand.hands[seat] ?? [])]
    }
    return out
  }

  private remainingRanks(live: LiveRoom): Record<string, number> | null {
    if (!live.engine) return null
    const seen = new Map<string, number>()
    const bump = (card: CardId): void => {
      const rank = rankOf(card)
      seen.set(rank, (seen.get(rank) ?? 0) + 1)
    }
    for (const play of live.engine.hand.table) {
      for (const card of play.cards) bump(card)
    }
    if (live.engine.hand.landlordSeat !== null) {
      for (const card of live.engine.hand.bottom) bump(card)
    }
    const decks = decksFor(live.room.seatCount)
    const totals: Record<string, number> = {
      '3': 4 * decks, '4': 4 * decks, '5': 4 * decks, '6': 4 * decks, '7': 4 * decks,
      '8': 4 * decks, '9': 4 * decks, '10': 4 * decks, J: 4 * decks, Q: 4 * decks,
      K: 4 * decks, A: 4 * decks, '2': 4 * decks, BJ: decks, RJ: decks,
    }
    const remaining: Record<string, number> = {}
    for (const [rank, total] of Object.entries(totals)) {
      remaining[rank] = total - (seen.get(rank) ?? 0)
    }
    return remaining
  }

  private async persistRoom(live: LiveRoom): Promise<void> {
    await this.domain.tables.rooms.put(live.room.roomId, {
      roomId: live.room.roomId,
      roomCode: live.room.roomCode,
      title: live.room.title,
      hostPlayerId: live.room.hostPlayerId,
      phase: live.room.phase,
      stakeAtoms: live.room.stakeAtoms.toString(),
      maxMultiplier: live.room.maxMultiplier,
      seatCount: live.room.seatCount,
      laiZi: live.room.laiZi,
      inviteExpiresAt: live.room.inviteExpiresAt,
      createdAt: live.room.createdAt,
      shareable: live.room.shareable,
      roomSecret: live.secret,
      sitInviteHash: live.sitInviteHash,
      watchInviteHash: live.watchInviteHash,
      lastLandlordSeat: live.lastLandlordSeat,
    })
  }

  private broadcast(live: LiveRoom): void {
    live.seq += 1
    const ids = new Set<PlayerId>([
      ...live.room.seats.map((seat) => seat.playerId).filter((id): id is PlayerId => Boolean(id)),
      ...live.room.spectatorIds,
    ])
    for (const playerId of ids) {
      this.emit(live, { type: 'snapshot', seq: live.seq, view: this.viewFor(live, playerId) }, playerId)
    }
  }

  private push(live: LiveRoom, event: ServerEvent): void {
    live.events.push(event)
    live.events = live.events.slice(-200)
    const ids = new Set<PlayerId>([
      ...live.room.seats.map((seat) => seat.playerId).filter((id): id is PlayerId => Boolean(id)),
      ...live.room.spectatorIds,
    ])
    for (const playerId of ids) this.emit(live, event, playerId)
  }

  private emit(_live: LiveRoom, event: ServerEvent, playerId: PlayerId): void {
    for (const listener of this.listeners) listener(playerId, event)
  }
}

function emptySeat(seat: Seat): SeatState {
  return {
    seat,
    playerId: null,
    displayName: null,
    avatarUrl: null,
    ready: false,
    connected: false,
    role: 'empty',
    grantId: null,
    cardsLeft: 0,
  }
}

export function fail(code: RejectCode, reason: string): Error & { code: RejectCode } {
  return Object.assign(new Error(reason), { code })
}
