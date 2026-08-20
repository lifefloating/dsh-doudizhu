import { addHours, cookieValue, inviteHash, nowIso, randomId, randomRoomCode, randomToken, sha256Hex } from '../crypto.ts'
import {
  applyBid, applyDouble, applyMingPai, applyPass, applyPlay, autoTimeout, createHand, doubleAnswerOf,
  expireDoubling, legalFor, snapshotHand, type EngineState,
} from '../engine/play.ts'
import { scoreHand } from '../engine/score.ts'
import { rankOf } from '../engine/cards.ts'
import { newPlayerId, sanitizeAvatarUrl, sanitizeBrowserId, sanitizeDisplayName, sanitizeRoomTitle } from '../identity/player.ts'
import { AUTO_PLAY_MS, dealAnimationMs, MAX_CHAT, MAX_SPECTATORS } from '../invariant.ts'
import { createMemoryDomain, openDoudizhuDomain, type DomainLike } from '../persist/domain.ts'
import { createCounters, type HealthCounters } from '../settle/audit.ts'
import { issueHostGrant, persistGrant } from '../settle/grant.ts'
import { Ledger } from '../settle/ledger.ts'
import { seatCapAtoms } from '../settle/math.ts'
import {
  asRoomId, asTokenAtomString, dealtHandSize, decksFor, landlordHandSize, nextSeat, parseAtoms,
  type BidAction, type CardId, type ClientCommand, type DoubleAction, type PlayerId, type PlayerView,
  type PublicSettlement, type RejectCode, type Room, type RoomId, type RoomPreview, type Seat, type SeatCount,
  type SeatState, type ServerEvent,
} from '../types.ts'
import { assertCreateEconomy, resolveConfig, validatePublicBaseUrl, type PluginConfig, type ResolvedConfig } from '../config.ts'

export interface JoinRequest {
  roomCode: string
  invite: string
  displayName: string
  role: 'sit' | 'watch'
  local?: boolean
  browserId?: string
  cookie?: string
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
  browserId?: string
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
  preDealMing: Set<Seat>
  engine: EngineState | null
  deadlineAt: number | null
  /** Frozen at create so later settings changes do not move this room. */
  turnTimeoutMs: number
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
  /** browserId + room → player currently occupying that room from this browser. */
  private readonly browserRooms = new Map<string, PlayerId>()
  /** In-flight joins so two tabs of the same browser cannot race into two seats. */
  private readonly joiningBrowsers = new Set<string>()
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
      preDealMing: new Set(),
      engine: null,
      deadlineAt: null,
      turnTimeoutMs: this.config.turnTimeoutMs,
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
    await this.sitInternal(live, hostPlayerId, 0, displayName)
    this.claimBrowser(req.browserId, roomId, hostPlayerId)
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
    const invite = req.invite.trim()
    const sitOk = invite
      ? sha256Hex(`${live.secret}|sit|${invite}`) === live.sitInviteHash
      : Boolean(req.local)
    const watchOk = invite
      ? sha256Hex(`${live.secret}|watch|${invite}`) === live.watchInviteHash
      : false
    if (!sitOk && !watchOk) throw fail('auth', invite ? 'invalid invite' : 'room not found')
    if (this.alreadyInRoom(live, req.browserId, req.cookie)) {
      throw fail('already-in-room', 'already in this room')
    }
    const browserId = sanitizeBrowserId(req.browserId)
    const lockKey = browserId ? this.browserKey(browserId, live.room.roomId) : null
    if (lockKey) {
      if (this.joiningBrowsers.has(lockKey)) throw fail('already-in-room', 'already in this room')
      this.joiningBrowsers.add(lockKey)
    }
    try {
      const displayName = sanitizeDisplayName(req.displayName)
      const playerId = newPlayerId()
      await this.ledger.ensurePlayer(playerId, displayName, sanitizeAvatarUrl(null, this.config.routePrefix))
      if (this.alreadyInRoom(live, req.browserId, req.cookie)) {
        throw fail('already-in-room', 'already in this room')
      }
      const empty = this.firstEmptySeat(live)
      const canSit = live.room.phase === 'waiting' && empty !== null && req.role !== 'watch'
      let seat: Seat | null = null
      if (canSit) {
        await this.sitInternal(live, playerId, empty, displayName)
        seat = empty
        if (this.firstEmptySeat(live) === null) live.sitConsumed = true
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
      this.claimBrowser(browserId, live.room.roomId, playerId)
      this.broadcast(live)
      return {
        playerId,
        roomId: live.room.roomId,
        seat,
        wsTicket: this.issueTicket(playerId, live.room.roomId),
        cookie,
        view: this.viewFor(live, playerId),
      }
    } finally {
      if (lockKey) this.joiningBrowsers.delete(lockKey)
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

  async peek(req: {
    roomCode: string
    invite: string
    local?: boolean
    browserId?: string
    cookie?: string
  }): Promise<RoomPreview> {
    await this.ready()
    const live = this.roomByCode(req.roomCode)
    if (!live || live.room.phase === 'closed') throw fail('expired', 'room not found')
    if (Date.parse(live.room.inviteExpiresAt) < Date.now()) throw fail('expired', 'invite expired')
    const invite = req.invite.trim()
    const sitOk = invite
      ? sha256Hex(`${live.secret}|sit|${invite}`) === live.sitInviteHash
      : Boolean(req.local)
    const watchOk = invite
      ? sha256Hex(`${live.secret}|watch|${invite}`) === live.watchInviteHash
      : false
    if (!sitOk && !watchOk) throw fail('auth', invite ? 'invalid invite' : 'room not found')
    return this.previewOf(live, sitOk, this.alreadyInRoom(live, req.browserId, req.cookie))
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
      if (live.room.phase === 'dealing' && command.type !== 'chat' && command.type !== 'ping' && command.type !== 'mingPai') {
        throw fail('phase', 'dealing')
      }
      switch (command.type) {
        case 'sit':
          await this.sitInternal(live, playerId, command.seat, sanitizeDisplayName(command.displayName))
          break
        case 'stand':
          this.stand(live, playerId)
          break
        case 'ready':
          await this.setReady(live, playerId, command.ready)
          break
        case 'start':
          await this.startHand(live, playerId, isHost)
          break
        case 'bid':
          this.clearAutoPlay(live, playerId)
          this.bid(live, playerId, command.action)
          break
        case 'double':
          this.clearAutoPlay(live, playerId)
          this.double(live, playerId, command.action)
          break
        case 'mingPai':
          this.mingPai(live, playerId)
          break
        case 'rename':
          this.rename(live, playerId, command.title, isHost)
          break
        case 'play':
          this.clearAutoPlay(live, playerId)
          await this.play(live, playerId, command.cards)
          break
        case 'pass':
          this.clearAutoPlay(live, playerId)
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
          return { seq: live.seq }
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

  markConnected(playerId: PlayerId, roomId: RoomId, resume = false): void {
    const live = this.rooms.get(roomId)
    if (!live) return
    const seat = this.seatOf(live, playerId)
    const wasOffline = live.disconnectedAt.has(playerId) || (seat !== null && live.room.seats[seat]?.connected === false)
    live.disconnectedAt.delete(playerId)
    if (!resume && seat !== null) {
      live.autoPlay.delete(seat)
      this.patchSeat(live, seat, { autoPlay: false })
    }
    this.setConnected(live, playerId, true)
    if (wasOffline) this.broadcast(live)
  }

  markDisconnected(playerId: PlayerId, roomId: RoomId): void {
    const live = this.rooms.get(roomId)
    if (!live) return
    live.disconnectedAt.set(playerId, Date.now())
    this.setConnected(live, playerId, false)
    const seat = this.seatOf(live, playerId)
    if (seat !== null && this.inHand(live)) {
      live.autoPlay.add(seat)
      if (this.isTurnSeat(live, seat)) live.deadlineAt = Date.now() + AUTO_PLAY_MS
    }
    this.broadcast(live)
    this.sweepWaitingLeaves(live, Date.now())
  }

  /** Guest (not host) leaves a waiting room: frees the seat / spectator slot. */
  leave(playerId: PlayerId, roomId: RoomId): void {
    const live = this.rooms.get(roomId)
    if (!live) return
    this.leaveGuest(live, playerId)
  }

  listenPort = (): number => this.ctx?.webServer?.port ?? 3080

  /** Test hook: advance room timers without waiting on the real interval. */
  tickForTest(now = Date.now()): void {
    this.onTick(now)
  }

  /** Test hook: leave one card on `winnerSeat` so the next play ends the hand. */
  armLastCardForTest(roomId: RoomId, winnerSeat: Seat, landlordSeat: Seat): CardId {
    const live = this.requireRoom(roomId)
    const engine = live.engine
    if (!engine) throw new Error('no engine')
    const winnerHand = engine.hand.hands[winnerSeat]
    const last = winnerHand?.[winnerHand.length - 1]
    if (!last) throw new Error('winner has no cards')
    engine.phase = 'playing'
    engine.hand.landlordSeat = landlordSeat
    engine.hand.bid = engine.hand.bid > 0 ? engine.hand.bid : 1
    engine.hand.hands[winnerSeat] = [last]
    engine.hand.turnSeat = winnerSeat
    engine.hand.leadSeat = winnerSeat
    engine.hand.table = []
    engine.passesInRow = 0
    engine.firstLeadSeq = 1
    engine.successfulLandlordPlaysAfterLead = winnerSeat === landlordSeat ? 0 : 1
    engine.farmerPlayed = engine.farmerPlayed.map(() => true)
    live.room = { ...live.room, phase: 'playing' }
    live.deadlineAt = Date.now() + this.turnMs(live)
    return last
  }

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

  private async sitInternal(live: LiveRoom, playerId: PlayerId, seat: Seat, displayName: string): Promise<void> {
    if (live.room.phase !== 'waiting') throw fail('phase', 'cannot sit now')
    const target = live.room.seats[seat]
    if (!target) throw fail('illegal', 'no such seat')
    if (target.playerId && target.playerId !== playerId) throw fail('room-full', 'seat taken')
    this.stand(live, playerId, false)
    const cap = seatCapAtoms(live.room.stakeAtoms, live.room.maxMultiplier, live.room.seatCount)
    const grant = issueHostGrant(playerId, live.room.roomId, cap)
    await persistGrant(this.domain, grant)
    const host = live.room.hostPlayerId === playerId
    await this.ensureSeatCap(live, playerId)
    const seats = live.room.seats.map((item) => item.seat === seat
      ? {
          ...item,
          playerId,
          displayName,
          avatarUrl: null,
          ready: host,
          connected: true,
          autoPlay: false,
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
    const seated = live.room.seats.find((item) => item.playerId === playerId)
    if (seated) live.preDealMing.delete(seated.seat)
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
    if (live.room.hostPlayerId === playerId) throw fail('illegal', 'host starts the hand')
    if (ready) await this.ensureSeatCap(live, playerId)
    this.patchSeat(live, seat, { ready })
  }

  private async startHand(live: LiveRoom, playerId: PlayerId, isHost: boolean): Promise<void> {
    if (!isHost && live.room.hostPlayerId !== playerId) throw fail('auth', 'host only')
    if (live.room.phase !== 'waiting') throw fail('phase', 'not waiting')
    const seated = live.room.seats
    if (!seated.every((seat) => seat.playerId && seat.grantId)) throw fail('phase', 'need a full table')
    if (!seated.every((seat) => seat.playerId === live.room.hostPlayerId || seat.ready)) {
      throw fail('phase', 'guests are not ready')
    }
    for (const seat of seated) {
      if (seat.playerId) await this.ensureSeatCap(live, seat.playerId)
    }
    this.beginDeal(live, live.lastLandlordSeat === null ? null : nextSeat(live.lastLandlordSeat, live.room.seatCount))
  }

  private beginDeal(live: LiveRoom, dealer: Seat | null): void {
    live.lastSettlement = null
    live.engine = createHand(live.room.roomId, dealer, this.counters.handsStarted + 1, {
      seatCount: live.room.seatCount,
      laiZi: live.room.laiZi,
    })
    this.applyPreDealMing(live)
    this.counters.bump('handsStarted')
    live.room = {
      ...live.room,
      phase: 'dealing',
      currentHandId: live.engine.hand.handId,
      seats: live.room.seats.map((seat) => ({
        ...seat,
        role: 'farmer' as const,
        cardsLeft: dealtHandSize(live.room.seatCount),
      })),
    }
    const ms = this.config.dealAnimMs ?? dealAnimationMs(live.room.seatCount)
    live.deadlineAt = Date.now() + ms
    if (ms <= 0) this.finishDeal(live)
  }

  private applyPreDealMing(live: LiveRoom): void {
    const engine = live.engine
    if (!engine || live.preDealMing.size === 0) return
    let first: Seat | null = null
    for (const seat of live.preDealMing) {
      if (first === null) first = seat
      engine.hand.mingPaiBySeat[seat] = true
      engine.hand.mingPaiMult = Math.max(engine.hand.mingPaiMult, 5)
    }
    if (first !== null) engine.bidTurn = first
    live.preDealMing.clear()
  }

  private finishDeal(live: LiveRoom): void {
    if (live.room.phase !== 'dealing' || !live.engine) return
    live.room = { ...live.room, phase: 'bidding' }
    live.deadlineAt = Date.now() + this.turnMs(live)
  }

  private bid(live: LiveRoom, playerId: PlayerId, action: BidAction): void {
    const engine = this.requireEngine(live, 'bidding')
    const seat = this.requireSeat(live, playerId)
    const result = applyBid(engine, seat, action)
    if (!result.ok) throw fail(result.code, result.reason)
    if (engine.phase === 'redeal') {
      this.beginDeal(live, engine.hand.dealerSeat)
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
    const seat = this.requireSeat(live, playerId)
    if (live.room.phase === 'waiting') {
      if (live.preDealMing.has(seat)) throw fail('illegal', 'already ming pai')
      live.preDealMing.add(seat)
      return
    }
    if (!live.engine) throw fail('phase', 'no hand')
    if (live.engine.hand.mingPaiBySeat[seat]) throw fail('illegal', 'already ming pai')
    if (live.room.phase === 'dealing') {
      live.engine.hand.mingPaiBySeat[seat] = true
      live.engine.hand.mingPaiMult = Math.max(live.engine.hand.mingPaiMult, 4)
      return
    }
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
      live.deadlineAt = Date.now() + this.turnMs(live)
    }
  }

  private async play(live: LiveRoom, playerId: PlayerId, cards: CardId[]): Promise<void> {
    const engine = this.requireEngine(live, 'playing')
    const seat = this.requireSeat(live, playerId)
    const result = applyPlay(engine, seat, cards, live.seq + 1, nowIso())
    if (!result.ok) throw fail(result.code, result.reason)
    this.patchSeat(live, seat, { cardsLeft: engine.hand.hands[seat]?.length ?? 0 })
    if (engine.phase === 'settled') await this.settle(live)
    else live.deadlineAt = Date.now() + this.turnMs(live)
  }

  private pass(live: LiveRoom, playerId: PlayerId): void {
    const engine = this.requireEngine(live, 'playing')
    const seat = this.requireSeat(live, playerId)
    const result = applyPass(engine, seat, live.seq + 1, nowIso())
    if (!result.ok) throw fail(result.code, result.reason)
    live.deadlineAt = Date.now() + this.turnMs(live)
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
    if (playerId !== live.room.hostPlayerId) throw fail('auth', 'host only')
    live.lastSettlement = null
    live.preDealMing.clear()
    live.room = {
      ...live.room,
      seats: live.room.seats.map((seat) => ({
        ...seat,
        ready: false,
        role: 'empty' as const,
        cardsLeft: 0,
        autoPlay: false,
      })),
    }
  }

  private kick(live: LiveRoom, playerId: PlayerId): void {
    if (live.room.phase !== 'waiting') throw fail('phase', 'cannot kick now')
    if (playerId === live.room.hostPlayerId) throw fail('illegal', 'cannot kick host')
    const seated = this.seatOf(live, playerId) !== null || live.room.spectatorIds.includes(playerId)
    if (!seated) throw fail('illegal', 'player not in room')
    this.stand(live, playerId)
    live.room = { ...live.room, spectatorIds: live.room.spectatorIds.filter((id) => id !== playerId) }
    this.dropSession(playerId, live.room.roomId)
    this.emit(live, { type: 'kicked', seq: live.seq + 1, reason: 'host kicked' }, playerId)
    void this.persistRoom(live)
  }

  private dropSession(playerId: PlayerId, roomId: RoomId): void {
    for (const [cookie, session] of this.sessions) {
      if (session.playerId === playerId && session.roomId === roomId) this.sessions.delete(cookie)
    }
    for (const [ticket, found] of this.tickets) {
      if (found.playerId === playerId && found.roomId === roomId) this.tickets.delete(ticket)
    }
    const live = this.rooms.get(roomId)
    live?.disconnectedAt.delete(playerId)
    this.unclaimBrowser(playerId, roomId)
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
    const ids = new Set<PlayerId>([
      ...live.room.seats.map((seat) => seat.playerId).filter((id): id is PlayerId => Boolean(id)),
      ...live.room.spectatorIds,
    ])
    live.lastSettlement = null
    live.room = { ...live.room, phase: 'closed' }
    this.unclaimRoom(live.room.roomId)
    for (const playerId of ids) {
      this.emit(live, { type: 'left', seq: live.seq + 1, reason: '房间已解散' }, playerId)
      this.dropSession(playerId, live.room.roomId)
    }
  }

  private async settle(live: LiveRoom): Promise<void> {
    const engine = live.engine
    if (!engine || engine.hand.landlordSeat === null) return
    const playerIds = live.room.seats.map((seat) => seat.playerId) as PlayerId[]
    if (playerIds.some((id) => !id)) return
    live.room = { ...live.room, phase: 'settling' }
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
    live.autoPlay.clear()
    live.room = {
      ...live.room,
      phase: 'waiting',
      currentHandId: null,
      seats: live.room.seats.map((seat) => ({
        ...seat,
        ready: false,
        role: 'empty' as const,
        cardsLeft: 0,
        autoPlay: false,
      })),
    }
    live.deadlineAt = null
    this.push(live, { type: 'settled', seq: ++live.seq, settlement: publicSettlement })
  }

  private onTurnTimeout(live: LiveRoom, now: number): void {
    const engine = live.engine
    if (!engine) return
    if (live.room.phase === 'playing') {
      const timedOut = engine.hand.turnSeat
      this.enterAutoPlay(live, timedOut)
      const result = autoTimeout(engine, live.seq + 1, nowIso())
      if (!result?.ok) {
        live.deadlineAt = now + this.turnMs(live)
        return
      }
      this.patchSeat(live, timedOut, { cardsLeft: engine.hand.hands[timedOut]?.length ?? 0 })
      if (engine.phase === 'settled') {
        void this.settle(live).then(() => { this.broadcast(live) }).catch((error: unknown) => {
          this.ctx?.logger?.warn(error)
        })
        return
      }
      live.deadlineAt = now + this.turnMs(live)
      this.broadcast(live)
      return
    }
    if (live.room.phase === 'bidding') {
      const seat = engine.bidTurn
      this.enterAutoPlay(live, seat)
      const result = applyBid(engine, seat, 'pass')
      if (!result.ok) {
        live.deadlineAt = now + this.turnMs(live)
        return
      }
      if (engine.phase === 'redeal') {
        this.beginDeal(live, engine.hand.dealerSeat)
        this.broadcast(live)
        return
      }
      if (engine.phase === 'doubling' && engine.hand.landlordSeat !== null) {
        this.patchSeat(live, engine.hand.landlordSeat, {
          role: 'landlord',
          cardsLeft: landlordHandSize(live.room.seatCount),
        })
        live.room = { ...live.room, phase: 'doubling' }
        live.deadlineAt = engine.doubleDeadlineAt
        this.broadcast(live)
        return
      }
      live.deadlineAt = now + this.turnMs(live)
      this.broadcast(live)
    }
  }

  private async voidHand(live: LiveRoom): Promise<void> {
    for (const seat of live.room.seats) {
      if (seat.playerId) await this.ledger.unfreeze(seat.playerId, this.ledger.getEscrow(seat.playerId), live.room.roomId, 'void')
    }
    live.engine = null
    live.autoPlay.clear()
    live.room = {
      ...live.room,
      phase: 'waiting',
      currentHandId: null,
      seats: live.room.seats.map((seat) => ({
        ...seat,
        ready: false,
        role: 'empty' as const,
        cardsLeft: 0,
        autoPlay: false,
      })),
    }
    this.counters.bump('handsVoided')
  }

  private onTick(now: number): void {
    for (const live of this.rooms.values()) {
      this.sweepWaitingLeaves(live, now)
      if (live.room.phase === 'dealing' && live.deadlineAt && now >= live.deadlineAt) {
        this.finishDeal(live)
        this.broadcast(live)
      }
      if (live.room.phase === 'doubling' && live.engine) {
        expireDoubling(live.engine, now)
        if (live.engine.phase === 'playing') {
          live.room = { ...live.room, phase: 'playing' }
          live.deadlineAt = now + this.turnMs(live)
          this.broadcast(live)
        }
      }
      if (live.deadlineAt && now >= live.deadlineAt && live.engine) {
        this.onTurnTimeout(live, now)
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

  private clearAutoPlay(live: LiveRoom, playerId: PlayerId): void {
    const seat = this.seatOf(live, playerId)
    if (seat === null || !live.autoPlay.has(seat)) return
    live.autoPlay.delete(seat)
    this.patchSeat(live, seat, { autoPlay: false })
  }

  private enterAutoPlay(live: LiveRoom, seat: Seat): void {
    if (live.autoPlay.has(seat)) return
    live.autoPlay.add(seat)
    this.patchSeat(live, seat, { autoPlay: true })
  }

  private inHand(live: LiveRoom): boolean {
    return live.room.phase === 'playing' || live.room.phase === 'bidding' || live.room.phase === 'doubling'
  }

  private isTurnSeat(live: LiveRoom, seat: Seat): boolean {
    const engine = live.engine
    if (!engine) return false
    if (live.room.phase === 'bidding') return engine.bidTurn === seat
    if (live.room.phase === 'playing') return engine.hand.turnSeat === seat
    return false
  }

  private turnMs(live: LiveRoom): number {
    const engine = live.engine
    if (!engine) return live.turnTimeoutMs
    const seat = live.room.phase === 'bidding' ? engine.bidTurn : engine.hand.turnSeat
    return live.autoPlay.has(seat) ? AUTO_PLAY_MS : live.turnTimeoutMs
  }

  private previewOf(live: LiveRoom, sitOk: boolean, alreadyInRoom = false): RoomPreview {
    const empty = this.firstEmptySeat(live)
    const hostName = live.room.seats.find((seat) => seat.playerId === live.room.hostPlayerId)?.displayName
      ?? '房主'
    return {
      roomCode: live.room.roomCode,
      title: live.room.title,
      hostDisplayName: hostName,
      seatCount: live.room.seatCount,
      laiZi: live.room.laiZi,
      stakeAtoms: asTokenAtomString(live.room.stakeAtoms),
      maxMultiplier: live.room.maxMultiplier,
      phase: live.room.phase,
      seated: live.room.seats.filter((seat) => seat.playerId).length,
      seats: live.room.seats.map((seat) => ({
        seat: seat.seat,
        displayName: seat.displayName,
        ready: seat.ready,
        host: seat.playerId === live.room.hostPlayerId,
      })),
      canSit: sitOk && live.room.phase === 'waiting' && empty !== null && !alreadyInRoom,
      inviteExpiresAt: live.room.inviteExpiresAt,
      alreadyInRoom,
    }
  }

  private viewFor(live: LiveRoom, playerId: PlayerId): PlayerView {
    const seat = this.seatOf(live, playerId)
    const spectator = seat === null
    const engine = live.engine
    const dealing = live.room.phase === 'dealing'
    const cards = seat !== null && engine && !dealing ? [...(engine.hand.hands[seat] ?? [])] : []
    const legal = seat !== null && engine && !dealing ? legalFor(engine, seat) : { canPass: false, combos: [] }
    const bottomRevealed = Boolean(engine && engine.hand.landlordSeat !== null && !dealing)
    const remainingRanks = spectator && this.config.spectatorCardCounter && !dealing
      ? this.remainingRanks(live)
      : null
    return {
      room: {
        ...live.room,
        stakeAtoms: asTokenAtomString(live.room.stakeAtoms),
        seats: live.room.seats.map((item) => ({
          ...item,
          autoPlay: live.autoPlay.has(item.seat),
          cardsLeft: dealing
            ? 0
            : engine ? (engine.hand.hands[item.seat]?.length ?? 0) : item.cardsLeft,
          role: engine?.hand.landlordSeat === item.seat
            ? 'landlord'
            : item.playerId
              ? (engine && !dealing ? 'farmer' : item.role)
              : 'empty',
        })),
      },
      you: { playerId, seat, spectator, cards },
      publicHands: live.room.seats.map((item, index) => (
        dealing ? 0 : engine ? (engine.hand.hands[index]?.length ?? 0) : item.cardsLeft
      )),
      lastPlays: engine && !dealing ? engine.hand.table.slice(-6) : [],
      bottom: bottomRevealed && engine ? [...engine.hand.bottom] : null,
      laiZiRanks: engine && !dealing ? engine.hand.laiZiRanks : [],
      bid: engine && !dealing ? engine.hand.bid : 0,
      auction: engine && engine.phase === 'bidding' && !dealing
        ? { kind: engine.called ? 'rob' : 'call', multiplier: Math.max(1, engine.hand.bid) }
        : null,
      revealedBySeat: dealing ? {} : this.revealedHands(live),
      mingPaiBySeat: this.mingPaiView(live),
      turnSeat: dealing
        ? null
        : engine?.phase === 'bidding'
          ? engine.bidTurn
          : engine?.hand.turnSeat ?? null,
      leadSeat: dealing ? null : engine?.hand.leadSeat ?? null,
      deadlineAt: live.deadlineAt ? new Date(live.deadlineAt).toISOString() : null,
      yourAvailableAtoms: asTokenAtomString(this.ledger.getAvailable(playerId)),
      yourEscrowAtoms: asTokenAtomString(this.ledger.getEscrow(playerId)),
      yourDouble: engine && seat !== null ? doubleAnswerOf(engine, seat) : null,
      legal,
      remainingRanks,
      chat: live.chat.slice(-20),
      settlement: live.lastSettlement,
    }
  }

  private async ensureSeatCap(live: LiveRoom, playerId: PlayerId): Promise<void> {
    const cap = seatCapAtoms(live.room.stakeAtoms, live.room.maxMultiplier, live.room.seatCount)
    if (this.ledger.getEscrow(playerId) >= cap) return
    if (this.ledger.getAvailable(playerId) < cap) throw fail('insufficient', 'need more welcome atoms')
    await this.ledger.freeze(playerId, cap, live.room.roomId)
  }

  private mingPaiView(live: LiveRoom): Partial<Record<Seat, boolean>> {
    const out: Partial<Record<Seat, boolean>> = live.engine ? { ...live.engine.hand.mingPaiBySeat } : {}
    for (const seat of live.preDealMing) out[seat] = true
    return out
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

  private alreadyInRoom(live: LiveRoom, browserId: unknown, cookie: string | undefined): boolean {
    const session = this.sessionByCookie(cookie)
    if (session && session.roomId === live.room.roomId && this.playerInRoom(live, session.playerId)) {
      return true
    }
    const id = sanitizeBrowserId(browserId)
    if (!id) return false
    const claimed = this.browserRooms.get(this.browserKey(id, live.room.roomId))
    return Boolean(claimed && this.playerInRoom(live, claimed))
  }

  private playerInRoom(live: LiveRoom, playerId: PlayerId): boolean {
    return this.seatOf(live, playerId) !== null || live.room.spectatorIds.includes(playerId)
  }

  private browserKey(browserId: string, roomId: RoomId): string {
    return `${browserId}\n${roomId}`
  }

  private claimBrowser(browserId: string | null | undefined, roomId: RoomId, playerId: PlayerId): void {
    const id = sanitizeBrowserId(browserId)
    if (!id) return
    this.browserRooms.set(this.browserKey(id, roomId), playerId)
  }

  private unclaimBrowser(playerId: PlayerId, roomId: RoomId): void {
    for (const [key, claimed] of this.browserRooms) {
      if (claimed === playerId && key.endsWith(`\n${roomId}`)) this.browserRooms.delete(key)
    }
  }

  private unclaimRoom(roomId: RoomId): void {
    for (const key of this.browserRooms.keys()) {
      if (key.endsWith(`\n${roomId}`)) this.browserRooms.delete(key)
    }
  }

  private leaveGuest(live: LiveRoom, playerId: PlayerId): void {
    if (playerId === live.room.hostPlayerId) return
    if (live.room.phase !== 'waiting') return
    if (!this.playerInRoom(live, playerId)) return
    this.stand(live, playerId)
    live.room = { ...live.room, spectatorIds: live.room.spectatorIds.filter((id) => id !== playerId) }
    this.emit(live, { type: 'left', seq: live.seq + 1, reason: 'disconnected' }, playerId)
    this.dropSession(playerId, live.room.roomId)
    this.broadcast(live)
  }

  private sweepWaitingLeaves(live: LiveRoom, now: number): void {
    if (live.room.phase !== 'waiting') return
    const grace = this.config.leaveWaitingMs
    const ids = new Set<PlayerId>([
      ...live.room.seats.map((seat) => seat.playerId).filter((id): id is PlayerId => Boolean(id)),
      ...live.room.spectatorIds,
    ])
    for (const playerId of ids) {
      if (playerId === live.room.hostPlayerId) continue
      const disconnectedAt = live.disconnectedAt.get(playerId)
      if (disconnectedAt === undefined) continue
      if (now - disconnectedAt < grace) continue
      this.leaveGuest(live, playerId)
    }
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
    autoPlay: false,
    role: 'empty',
    grantId: null,
    cardsLeft: 0,
  }
}

export function fail(code: RejectCode, reason: string): Error & { code: RejectCode } {
  return Object.assign(new Error(reason), { code })
}
