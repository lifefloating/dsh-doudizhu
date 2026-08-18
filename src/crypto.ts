import { createHash, randomBytes } from 'node:crypto'

export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(10).toString('hex')}`
}

export function randomRoomCode(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000
  return n.toString().padStart(6, '0')
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url').replace(/=+$/, '')
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function inviteHash(roomSecret: string, domain: 'sit' | 'watch', token: string): string {
  return sha256Hex(`${roomSecret}|${domain}|${token}`)
}

export function cookieValue(): string {
  return randomBytes(24).toString('base64url')
}

export function nowIso(date = new Date()): string {
  return date.toISOString()
}

export function addHours(hours: number, date = new Date()): string {
  return new Date(date.getTime() + hours * 3600_000).toISOString()
}
