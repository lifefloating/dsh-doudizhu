import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('settlement screen', () => {
  const host = readFileSync(join(process.cwd(), 'src/client/HostApp.tsx'), 'utf8')
  const view = readFileSync(join(process.cwd(), 'src/client/SettlementView.tsx'), 'utf8')

  it('shows the hand ledger as soon as settlement is on the view, not only after a waiting snapshot', () => {
    expect(host).toContain('const showSettlement = Boolean(state.settlement)')
    expect(host).toContain('settlement: view.settlement')
    expect(host).not.toContain("state.settlement && view?.room.phase === 'waiting'")
  })

  it('lets only the host rematch or close; guests wait, then rematch returns everyone to ready', () => {
    expect(view).toContain('再来一局')
    expect(view).toContain('解散房间')
    expect(view).toContain('等待房主再开一局或解散房间')
    expect(view).toContain('data-rematch')
    expect(view).toContain('data-close-room')
    expect(host).toContain("command({ type: 'rematch' })")
    expect(host).toContain("command({ type: 'hostClose' })")
    expect(host).not.toContain("setState((prev) => ({ ...prev, settlement: null }))")
  })

  it('lists named seat deltas and the post-hand balance', () => {
    expect(view).toContain('你的余额')
    expect(view).toContain('signedM')
    expect(view).toContain('displayName')
  })
})
