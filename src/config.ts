import z from '@deepseek-ai/schemastery'
import { seatCapAtoms, STAKE_LADDER_M } from './settle/math.ts'

export const STAKE_LADDER = STAKE_LADDER_M
export const DEFAULT_STAKE_M = 1
export const DEFAULT_MAX_MULTIPLIER = 8
export const DEFAULT_WELCOME_ATOMS = '200000000'
export const DEFAULT_SEAT_COUNT = 3
export const DEFAULT_TURN_TIMEOUT_MS = 120_000
export const MAX_MULTIPLIER_OPTIONS = [8, 16, 32, 64] as const
export const SEAT_COUNT_OPTIONS = [3, 4] as const

export interface PluginConfig {
  enabled?: boolean
  welcomeAtoms?: string
  defaultStakeM?: number
  defaultMaxMultiplier?: number
  defaultSeatCount?: 3 | 4
  defaultLaiZi?: boolean
  publicBaseUrl?: string
  maxRooms?: number
  allowSpectators?: boolean
  spectatorCardCounter?: boolean
  houseEnabled?: boolean
  reconnectWindowMs?: number
  turnTimeoutMs?: number
  doubleWindowMs?: number
  heartbeatMs?: number
  disconnectAfterMs?: number
  retainClosedRoomsHours?: number
  inviteTtlHours?: number
  routePrefix?: string
}

export const Config = z.object({
  enabled: z.boolean().default(true),
  welcomeAtoms: z.string().default(DEFAULT_WELCOME_ATOMS),
  defaultStakeM: z.number().default(DEFAULT_STAKE_M),
  defaultMaxMultiplier: z.number().default(DEFAULT_MAX_MULTIPLIER),
  defaultSeatCount: z.union([z.const(3), z.const(4)]).default(DEFAULT_SEAT_COUNT),
  defaultLaiZi: z.boolean().default(false),
  publicBaseUrl: z.string().default(''),
  maxRooms: z.number().default(32),
  allowSpectators: z.boolean().default(true),
  spectatorCardCounter: z.boolean().default(false),
  houseEnabled: z.boolean().default(false),
  reconnectWindowMs: z.number().default(120_000),
  turnTimeoutMs: z.number().default(DEFAULT_TURN_TIMEOUT_MS),
  doubleWindowMs: z.number().default(8_000),
  heartbeatMs: z.number().default(15_000),
  disconnectAfterMs: z.number().default(60_000),
  retainClosedRoomsHours: z.number().default(24),
  inviteTtlHours: z.number().default(24),
  routePrefix: z.string().default('/doudizhu'),
})

export interface ResolvedConfig {
  enabled: boolean
  welcomeAtoms: bigint
  defaultStakeM: number
  defaultMaxMultiplier: number
  defaultSeatCount: 3 | 4
  defaultLaiZi: boolean
  publicBaseUrl: string
  maxRooms: number
  allowSpectators: boolean
  spectatorCardCounter: boolean
  houseEnabled: boolean
  reconnectWindowMs: number
  turnTimeoutMs: number
  doubleWindowMs: number
  heartbeatMs: number
  disconnectAfterMs: number
  retainClosedRoomsHours: number
  inviteTtlHours: number
  routePrefix: string
}

export function resolveConfig(config: PluginConfig): ResolvedConfig {
  const welcomeAtoms = parseWelcome(config.welcomeAtoms ?? DEFAULT_WELCOME_ATOMS)
  const defaultStakeM = config.defaultStakeM ?? DEFAULT_STAKE_M
  const defaultMaxMultiplier = config.defaultMaxMultiplier ?? DEFAULT_MAX_MULTIPLIER
  return {
    enabled: config.enabled !== false,
    welcomeAtoms,
    defaultStakeM,
    defaultMaxMultiplier,
    defaultSeatCount: config.defaultSeatCount === 4 ? 4 : 3,
    defaultLaiZi: config.defaultLaiZi === true,
    publicBaseUrl: (config.publicBaseUrl ?? '').replace(/\/+$/, ''),
    maxRooms: config.maxRooms ?? 32,
    allowSpectators: config.allowSpectators !== false,
    spectatorCardCounter: config.spectatorCardCounter === true,
    houseEnabled: false,
    reconnectWindowMs: config.reconnectWindowMs ?? 120_000,
    turnTimeoutMs: config.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS,
    doubleWindowMs: config.doubleWindowMs ?? 8_000,
    heartbeatMs: config.heartbeatMs ?? 15_000,
    disconnectAfterMs: config.disconnectAfterMs ?? 60_000,
    retainClosedRoomsHours: config.retainClosedRoomsHours ?? 24,
    inviteTtlHours: config.inviteTtlHours ?? 24,
    routePrefix: normalizePrefix(config.routePrefix ?? '/doudizhu'),
  }
}

export function parseWelcome(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error('welcomeAtoms must be a non-negative decimal string')
  return BigInt(value)
}

export function validatePublicBaseUrl(value: string): string {
  if (value === '') return ''
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('publicBaseUrl must be an absolute http(s) origin')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('publicBaseUrl must be http or https')
  }
  if (parsed.origin !== value.replace(/\/+$/, '')) {
    throw new Error('publicBaseUrl must be an origin with no path, query, or trailing slash')
  }
  return parsed.origin
}

export function assertCreateEconomy(
  welcomeAtoms: bigint,
  stakeM: number,
  maxMultiplier: number,
  seatCount: 3 | 4 = 3,
): void {
  if (!STAKE_LADDER_M.includes(stakeM as typeof STAKE_LADDER_M[number])) {
    throw new Error(`stakeM must be one of ${STAKE_LADDER_M.join(',')}`)
  }
  if (!(MAX_MULTIPLIER_OPTIONS as readonly number[]).includes(maxMultiplier)) {
    throw new Error(`maxMultiplier must be one of ${MAX_MULTIPLIER_OPTIONS.join(',')}`)
  }
  if (seatCount !== 3 && seatCount !== 4) {
    throw new Error('seatCount must be 3 or 4')
  }
  const cap = seatCapAtoms(BigInt(stakeM) * 1_000_000n, maxMultiplier, seatCount)
  if (welcomeAtoms < cap) {
    throw failWelcome()
  }
}

function failWelcome(): Error {
  return Object.assign(new Error('welcome-below-seatcap'), { name: 'welcome-below-seatcap', code: 'insufficient' })
}

function normalizePrefix(prefix: string): string {
  if (!prefix.startsWith('/')) return `/${prefix.replace(/\/+$/, '')}`
  return prefix.replace(/\/+$/, '') || '/doudizhu'
}
