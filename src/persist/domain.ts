import {
  HandCheckpointSchema, LedgerEntrySchema, PlayerRecordSchema, RoomRecordSchema, TokenGrantSchema,
  type GrantRecord, type HandCheckpoint, type LedgerRecord, type PlayerRecord, type RoomRecord,
} from './schemas.ts'

export interface KvLike<V> {
  get(key: string): V | undefined
  put(key: string, value: V): Promise<void>
  delete(key: string): Promise<boolean>
  entries(): IterableIterator<[string, V]>
}

export interface DomainLike {
  tables: {
    rooms: KvLike<RoomRecord>
    players: KvLike<PlayerRecord>
    grants: KvLike<GrantRecord>
    ledger: KvLike<LedgerRecord>
    hands: KvLike<HandCheckpoint>
  }
  close(): Promise<void>
}

export const DOUDIZHU_DOMAIN_SPEC = {
  name: 'doudizhu',
  version: 1,
  tables: {
    rooms: RoomRecordSchema,
    players: PlayerRecordSchema,
    grants: TokenGrantSchema,
    ledger: LedgerEntrySchema,
    hands: HandCheckpointSchema,
  },
} as const

export class MemoryKv<V> implements KvLike<V> {
  private readonly map = new Map<string, V>()
  get(key: string): V | undefined {
    return this.map.get(key)
  }
  async put(key: string, value: V): Promise<void> {
    this.map.set(key, value)
  }
  async delete(key: string): Promise<boolean> {
    return this.map.delete(key)
  }
  entries(): IterableIterator<[string, V]> {
    return this.map.entries()
  }
}

export function createMemoryDomain(): DomainLike {
  return {
    tables: {
      rooms: new MemoryKv(),
      players: new MemoryKv(),
      grants: new MemoryKv(),
      ledger: new MemoryKv(),
      hands: new MemoryKv(),
    },
    async close() {},
  }
}

export async function openDoudizhuDomain(storage: unknown): Promise<DomainLike | null> {
  if (!storage || typeof storage !== 'object') return null
  const facility = storage as {
    open?: (spec: unknown) => Promise<{
      table: (name: string) => KvLike<unknown>
      close: () => Promise<void>
    }>
  }
  if (typeof facility.open !== 'function') return null
  try {
    const spec = {
      name: 'doudizhu',
      version: 1,
      tables: {
        rooms: { valueSchema: RoomRecordSchema },
        players: { valueSchema: PlayerRecordSchema },
        grants: { valueSchema: TokenGrantSchema },
        ledger: { valueSchema: LedgerEntrySchema },
        hands: { valueSchema: HandCheckpointSchema },
      },
    }
    const domain = await facility.open(spec)
    return {
      tables: {
        rooms: domain.table('rooms') as KvLike<RoomRecord>,
        players: domain.table('players') as KvLike<PlayerRecord>,
        grants: domain.table('grants') as KvLike<GrantRecord>,
        ledger: domain.table('ledger') as KvLike<LedgerRecord>,
        hands: domain.table('hands') as KvLike<HandCheckpoint>,
      },
      close: () => domain.close(),
    }
  } catch {
    return null
  }
}
