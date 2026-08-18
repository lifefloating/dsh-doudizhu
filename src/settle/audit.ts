export interface HealthCounters {
  roomsActive: number
  handsStarted: number
  handsVoided: number
  wsConnected: number
  cmdRejected: number
  settlementsCommitted: number
  needsAudit: boolean
  uptimeMs: number
}

export function createCounters(startedAt = Date.now()): HealthCounters & {
  startedAt: number
  bump(key: Exclude<keyof HealthCounters, 'needsAudit' | 'uptimeMs' | 'roomsActive' | 'wsConnected'>): void
} {
  return {
    startedAt,
    roomsActive: 0,
    handsStarted: 0,
    handsVoided: 0,
    wsConnected: 0,
    cmdRejected: 0,
    settlementsCommitted: 0,
    needsAudit: false,
    get uptimeMs() {
      return Date.now() - startedAt
    },
    bump(key) {
      this[key] += 1
    },
  }
}
