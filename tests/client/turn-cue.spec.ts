import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { opponentTurnCue, yourTurnToastKey } from '../../src/client/turn-cue.ts'
import type { PlayerId, PlayerView, Seat, TokenAtomString } from '../../src/types.ts'

function view(input: {
  phase?: PlayerView['room']['phase']
  youSeat: Seat | null
  turnSeat: Seat | null
  spectator?: boolean
  deadlineAt?: string | null
}): PlayerView {
  return {
    room: {
      roomId: 'rm' as PlayerView['room']['roomId'],
      roomCode: '123456',
      title: '好友局',
      hostPlayerId: 'host' as PlayerId,
      phase: input.phase ?? 'playing',
      stakeAtoms: '1000000' as TokenAtomString,
      maxMultiplier: 8,
      seatCount: 3,
      laiZi: false,
      seats: [],
      spectatorIds: [],
      currentHandId: null,
      createdAt: '',
      inviteExpiresAt: '',
      shareable: false,
    },
    you: {
      playerId: 'you' as PlayerId,
      seat: input.youSeat,
      spectator: input.spectator === true,
      cards: [],
    },
    publicHands: [],
    lastPlays: [],
    bottom: null,
    laiZiRanks: [],
    bid: 0,
    auction: null,
    revealedBySeat: {},
    mingPaiBySeat: {},
    turnSeat: input.turnSeat,
    leadSeat: null,
    deadlineAt: input.deadlineAt ?? '2026-01-01T00:02:00.000Z',
    yourAvailableAtoms: '0' as TokenAtomString,
    yourEscrowAtoms: '0' as TokenAtomString,
    yourDouble: null,
    legal: { canPass: false, combos: [] },
    remainingRanks: null,
    chat: [],
  }
}

describe('play-turn cues', () => {
  it('points at the current play seat for everyone else, including spectators', () => {
    const farmer = view({ youSeat: 0, turnSeat: 1 })
    expect(opponentTurnCue(farmer, 1)).toBe(true)
    expect(opponentTurnCue(farmer, 0)).toBe(false)
    expect(opponentTurnCue(farmer, 2)).toBe(false)
    const watcher = view({ youSeat: null, turnSeat: 1, spectator: true })
    expect(opponentTurnCue(watcher, 1)).toBe(true)
    expect(yourTurnToastKey(watcher)).toBeNull()
  })

  it('does not mark avatars during bidding', () => {
    const bidding = view({ phase: 'bidding', youSeat: 0, turnSeat: 1 })
    expect(opponentTurnCue(bidding, 1)).toBe(false)
    expect(yourTurnToastKey(bidding)).toBeNull()
  })

  it('gives the current player a toast key and no arrow on themselves', () => {
    const self = view({ youSeat: 2, turnSeat: 2, deadlineAt: '2026-01-01T00:03:00.000Z' })
    expect(opponentTurnCue(self, 2)).toBe(false)
    expect(yourTurnToastKey(self)).toBe('2:2026-01-01T00:03:00.000Z')
    const waiting = view({ youSeat: 2, turnSeat: 0 })
    expect(yourTurnToastKey(waiting)).toBeNull()
  })

  it('keeps the copy on the table components', () => {
    const table = readFileSync(join(process.cwd(), 'src/client/TableView.tsx'), 'utf8')
    const row = readFileSync(join(process.cwd(), 'src/client/SeatRow.tsx'), 'utf8')
    const settings = readFileSync(join(process.cwd(), 'src/client/SettingsCard.tsx'), 'utf8')
    expect(row).toContain('出牌中…')
    expect(table).toContain('轮到你出牌了~')
    expect(table).toContain('YourTurnToast')
    expect(settings).toContain('出牌计时')
    expect(settings).toContain('turnTimeoutMs')
  })
})
