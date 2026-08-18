import { z } from 'zod'

export const TokenAtomString = z.string().regex(/^-?\d+$/)

export const RoomRecordSchema = z.object({
  roomId: z.string(),
  roomCode: z.string(),
  hostPlayerId: z.string(),
  phase: z.enum(['waiting', 'dealing', 'bidding', 'doubling', 'playing', 'settling', 'void', 'closed']),
  stakeAtoms: TokenAtomString,
  maxMultiplier: z.number().int().positive(),
  seatCount: z.union([z.literal(3), z.literal(4)]).default(3),
  laiZi: z.boolean().default(false),
  inviteExpiresAt: z.string(),
  createdAt: z.string(),
  shareable: z.boolean(),
  roomSecret: z.string(),
  sitInviteHash: z.string(),
  watchInviteHash: z.string(),
  lastLandlordSeat: z.number().int().min(0).max(3).nullable(),
})

export const PlayerRecordSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  availableAtoms: TokenAtomString,
  welcomeGranted: z.boolean(),
  createdAt: z.string(),
})

export const TokenGrantSchema = z.object({
  grantId: z.string(),
  playerId: z.string(),
  roomId: z.string(),
  maxExposureAtoms: TokenAtomString,
  issuedAt: z.string(),
  expiresAt: z.string(),
  source: z.literal('host-welcome'),
  issuedBy: z.literal('room-host'),
})

export const LedgerEntrySchema = z.object({
  entryId: z.string(),
  ts: z.string(),
  roomId: z.string().optional(),
  handId: z.string().optional(),
  settlementId: z.string().optional(),
  from: z.string(),
  to: z.string(),
  atoms: TokenAtomString,
  reason: z.enum(['welcome', 'freeze', 'unfreeze', 'settle', 'void']),
  prevHash: z.string(),
  hash: z.string(),
})

export const HandCheckpointSchema = z.object({
  handId: z.string(),
  roomId: z.string(),
  sealedHands: z.string(),
  publicJson: z.string(),
  seq: z.number().int(),
})

export type RoomRecord = z.infer<typeof RoomRecordSchema>
export type PlayerRecord = z.infer<typeof PlayerRecordSchema>
export type GrantRecord = z.infer<typeof TokenGrantSchema>
export type LedgerRecord = z.infer<typeof LedgerEntrySchema>
export type HandCheckpoint = z.infer<typeof HandCheckpointSchema>
