import { addHours, nowIso, randomId } from '../crypto.ts'
import type { DomainLike } from '../persist/domain.ts'
import type { GrantRecord } from '../persist/schemas.ts'
import { asGrantId, asTokenAtomString, type GrantId, type PlayerId, type RoomId, type TokenGrant } from '../types.ts'

export function issueHostGrant(
  playerId: PlayerId,
  roomId: RoomId,
  maxExposureAtoms: bigint,
  ttlHours = 24,
): TokenGrant {
  const issuedAt = nowIso()
  return {
    grantId: asGrantId(randomId('gr')),
    playerId,
    roomId,
    maxExposureAtoms: asTokenAtomString(maxExposureAtoms),
    issuedAt,
    expiresAt: addHours(ttlHours),
    source: 'host-welcome',
    issuedBy: 'room-host',
  }
}

export async function persistGrant(domain: DomainLike, grant: TokenGrant): Promise<void> {
  const record: GrantRecord = { ...grant }
  await domain.tables.grants.put(grant.grantId, record)
}

export function grantRecord(domain: DomainLike, grantId: GrantId): GrantRecord | undefined {
  return domain.tables.grants.get(grantId)
}
