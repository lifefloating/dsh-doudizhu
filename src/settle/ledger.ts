import { createHash } from 'node:crypto'
import { randomId } from '../crypto.ts'
import type { DomainLike } from '../persist/domain.ts'
import type { LedgerRecord, PlayerRecord } from '../persist/schemas.ts'
import { asEntryId, asPlayerId, asTokenAtomString, parseAtoms, type PlayerId, type TokenAtomString } from '../types.ts'

export type LedgerReason = LedgerRecord['reason']

export interface LedgerSnapshot {
  readonly availableAtoms: TokenAtomString
  readonly escrowAtoms: TokenAtomString
  readonly entries: readonly LedgerRecord[]
}

export class Ledger {
  private tipHash = '0'.repeat(64)
  private readonly escrow = new Map<PlayerId, bigint>()

  constructor(
    private readonly domain: DomainLike,
    private welcomeAtoms: bigint,
  ) {
    for (const [, entry] of domain.tables.ledger.entries()) this.tipHash = entry.hash
  }

  getAvailable(playerId: PlayerId): bigint {
    const row = this.domain.tables.players.get(playerId)
    return row ? parseAtoms(row.availableAtoms) : 0n
  }

  getEscrow(playerId: PlayerId): bigint {
    return this.escrow.get(playerId) ?? 0n
  }

  snapshot(playerId: PlayerId): LedgerSnapshot {
    const entries = [...this.domain.tables.ledger.entries()]
      .map(([, entry]) => entry)
      .filter((entry) => entry.from === playerId || entry.to === playerId)
    return {
      availableAtoms: asTokenAtomString(this.getAvailable(playerId)),
      escrowAtoms: asTokenAtomString(this.getEscrow(playerId)),
      entries,
    }
  }

  async ensurePlayer(playerId: PlayerId, displayName: string, avatarUrl: string | null): Promise<PlayerRecord> {
    const existing = this.domain.tables.players.get(playerId)
    if (existing) {
      if (existing.displayName !== displayName) {
        const next = { ...existing, displayName }
        await this.domain.tables.players.put(playerId, next)
        return next
      }
      return existing
    }
    const created: PlayerRecord = {
      playerId,
      displayName,
      avatarUrl,
      availableAtoms: '0',
      welcomeGranted: false,
      createdAt: new Date().toISOString(),
    }
    await this.domain.tables.players.put(playerId, created)
    return this.grantWelcome(asPlayerId(playerId), created)
  }

  async grantWelcome(playerId: PlayerId, row = this.domain.tables.players.get(playerId)): Promise<PlayerRecord> {
    if (!row) throw new Error(`unknown player ${playerId}`)
    if (row.welcomeGranted) return row
    const next = await this.applyAvailable(playerId, this.welcomeAtoms, {
      reason: 'welcome',
      from: 'host',
      to: playerId,
    })
    const granted = { ...next, welcomeGranted: true }
    await this.domain.tables.players.put(playerId, granted)
    return granted
  }

  async freeze(playerId: PlayerId, atoms: bigint, roomId: string): Promise<void> {
    if (atoms <= 0n) throw new Error('freeze amount must be positive')
    if (this.getAvailable(playerId) < atoms) throw Object.assign(new Error('insufficient'), { code: 'insufficient' })
    await this.applyAvailable(playerId, -atoms, {
      reason: 'freeze',
      from: playerId,
      to: `escrow:${roomId}`,
      roomId,
    })
    this.escrow.set(playerId, this.getEscrow(playerId) + atoms)
  }

  async unfreeze(playerId: PlayerId, atoms: bigint, roomId: string, reason: 'unfreeze' | 'void' = 'unfreeze'): Promise<void> {
    const held = this.getEscrow(playerId)
    const amount = atoms < held ? atoms : held
    if (amount <= 0n) return
    this.escrow.set(playerId, held - amount)
    await this.applyAvailable(playerId, amount, {
      reason,
      from: `escrow:${roomId}`,
      to: playerId,
      roomId,
    })
  }

  async settleTransfer(
    from: PlayerId,
    to: PlayerId,
    atoms: bigint,
    meta: { roomId: string; handId: string; settlementId: string },
  ): Promise<void> {
    if (atoms <= 0n) return
    const held = this.getEscrow(from)
    if (held < atoms) {
      throw Object.assign(new Error('escrow insufficient'), { code: 'needsAudit' })
    }
    this.escrow.set(from, held - atoms)
    await this.append({
      from,
      to,
      atoms: asTokenAtomString(atoms),
      reason: 'settle',
      roomId: meta.roomId,
      handId: meta.handId,
      settlementId: meta.settlementId,
    })
    const winner = this.domain.tables.players.get(to)
    if (!winner) throw new Error(`unknown winner ${to}`)
    const next = { ...winner, availableAtoms: (parseAtoms(winner.availableAtoms) + atoms).toString() }
    await this.domain.tables.players.put(to, next)
  }

  replaceWelcome(welcomeAtoms: bigint): void {
    this.welcomeAtoms = welcomeAtoms
  }

  private async applyAvailable(
    playerId: PlayerId,
    delta: bigint,
    meta: { reason: LedgerReason; from: string; to: string; roomId?: string; handId?: string; settlementId?: string },
  ): Promise<PlayerRecord> {
    const row = this.domain.tables.players.get(playerId)
    if (!row) throw new Error(`unknown player ${playerId}`)
    const nextAvailable = parseAtoms(row.availableAtoms) + delta
    if (nextAvailable < 0n) throw Object.assign(new Error('insufficient'), { code: 'insufficient' })
    const next = { ...row, availableAtoms: nextAvailable.toString() }
    await this.domain.tables.players.put(playerId, next)
    await this.append({
      from: meta.from,
      to: meta.to,
      atoms: asTokenAtomString(delta < 0n ? -delta : delta),
      reason: meta.reason,
      roomId: meta.roomId,
      handId: meta.handId,
      settlementId: meta.settlementId,
    })
    return next
  }

  private async append(partial: Omit<LedgerRecord, 'entryId' | 'ts' | 'prevHash' | 'hash'>): Promise<LedgerRecord> {
    const entryId = asEntryId(randomId('led'))
    const ts = new Date().toISOString()
    const prevHash = this.tipHash
    const material = JSON.stringify({ ...partial, entryId, ts, prevHash })
    const hash = createHash('sha256').update(material).digest('hex')
    const entry: LedgerRecord = { ...partial, entryId, ts, prevHash, hash }
    await this.domain.tables.ledger.put(entryId, entry)
    this.tipHash = hash
    return entry
  }
}
