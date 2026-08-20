import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { phaseLabel, tableBalance, tableMeta } from '../../src/client/table-chrome.ts'
import type { PlayerId, PlayerView, TokenAtomString } from '../../src/types.ts'

function view(input: Partial<PlayerView['room']> & { bid?: number; available?: string; escrow?: string } = {}): PlayerView {
  return {
    room: {
      roomId: 'rm' as PlayerView['room']['roomId'],
      roomCode: '813965',
      title: '好友局',
      hostPlayerId: 'host' as PlayerId,
      phase: input.phase ?? 'playing',
      stakeAtoms: '1000000' as TokenAtomString,
      maxMultiplier: 8,
      seatCount: input.seatCount ?? 3,
      laiZi: input.laiZi ?? false,
      seats: [],
      spectatorIds: [],
      currentHandId: null,
      createdAt: '',
      inviteExpiresAt: '',
      shareable: false,
    },
    you: { playerId: 'you' as PlayerId, seat: 0, spectator: false, cards: [] },
    publicHands: [],
    lastPlays: [],
    bottom: null,
    laiZiRanks: [],
    bid: input.bid ?? 2,
    auction: null,
    revealedBySeat: {},
    mingPaiBySeat: {},
    turnSeat: 0,
    leadSeat: null,
    deadlineAt: '2026-01-01T00:02:00.000Z',
    yourAvailableAtoms: (input.available ?? '104000000') as TokenAtomString,
    yourEscrowAtoms: (input.escrow ?? '96000000') as TokenAtomString,
    yourDouble: null,
    legal: { canPass: false, combos: [] },
    remainingRanks: null,
    chat: [],
  }
}

describe('table chrome', () => {
  it('puts 斗地主, room title and github on the topbar, not a second row', () => {
    const host = readFileSync(join(process.cwd(), 'src/client/HostApp.tsx'), 'utf8')
    const bar = readFileSync(join(process.cwd(), 'src/client/InviteDialog.tsx'), 'utf8')
    const table = readFileSync(join(process.cwd(), 'src/client/TableView.tsx'), 'utf8')
    const styles = readFileSync(join(process.cwd(), 'src/client/styles.module.css'), 'utf8')
    const topbar = host.slice(host.indexOf('className={css.topbar}'), host.indexOf('state.error ?'))
    const actions = host.slice(host.indexOf('data-topbar-actions'), host.indexOf('state.error ?'))
    expect(topbar).toContain('RoomCodeBar')
    expect(topbar).toContain('brand="斗地主"')
    expect(bar).toContain('brandTitle')
    expect(bar).toContain('brandDash')
    expect(bar).toContain('房号')
    expect(bar.slice(bar.indexOf('function RoomCodeBar'), bar.indexOf('function GithubLink'))).not.toContain('githubLink')
    expect(actions).toContain('GithubLink')
    expect(actions).toContain('css.close')
    expect(actions.indexOf('GithubLink')).toBeLessThan(actions.indexOf('css.close'))
    expect(table).not.toContain('RoomCodeBar')
    expect(table).not.toContain('css.tableBar')
    expect(styles).toMatch(/\.codeBar \{[^}]*min-width: 0/)
    expect(styles).toMatch(/\.topbarActions \{[^}]*margin-left: auto/)
    expect(styles).not.toMatch(/\.githubLink \{[^}]*margin-left: auto/)
  })

  it('formats stake, bid, phase timer and balance on one meta line', () => {
    expect(tableMeta(view(), 28)).toBe('3人经典 · 底注 1M · 2倍 · 出牌 28秒')
    expect(tableMeta(view({ phase: 'bidding', bid: 0 }), 60)).toBe('3人经典 · 底注 1M · 未叫 · 叫抢 60秒')
    expect(tableBalance(view())).toBe('余额 104M · 冻结 96M')
    expect(phaseLabel('dealing')).toBe('发牌')
  })
})
