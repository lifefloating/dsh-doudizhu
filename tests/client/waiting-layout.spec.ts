import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('waiting layout', () => {
  const table = readFileSync(join(process.cwd(), 'src/client/TableView.tsx'), 'utf8')
  const styles = readFileSync(join(process.cwd(), 'src/client/styles.module.css'), 'utf8')
  const readyBlock = table.slice(table.indexOf('data-ready-center'), table.indexOf('function ActionBar'))
  const actionBlock = table.slice(table.indexOf('function ActionBar'), table.indexOf('function MingPaiButton'))

  it('keeps pre-deal ming pai on the ready cluster, not beside waiting copy in the action bar', () => {
    expect(readyBlock).toContain('MingPaiButton')
    expect(readyBlock).toContain('等好友点准备后再开打')
    expect(readyBlock).toContain('statusCopy')
    expect(actionBlock).not.toContain('等好友点准备。')
    expect(actionBlock).not.toContain('点中间黄色按钮准备')
    expect(actionBlock).toContain("phase !== 'waiting' ? <MingPaiButton")
    expect(table).toContain('phase === \'waiting\' || phase === \'dealing\' || phase === \'bidding\'')
  })

  it('keeps dealing ming pai in the self-play dock, not in the flow between seat and chat', () => {
    const dock = table.slice(table.lastIndexOf('data-self-seat'), table.indexOf('data-chat-composer'))
    expect(dock).toContain('data-self-play')
    expect(dock.indexOf('ActionBar')).toBeGreaterThan(dock.indexOf('data-self-play'))
    expect(dock.split('<ActionBar').length - 1).toBe(1)
    expect(dock).toMatch(/phase === 'dealing'\s*\n\s*\? null/)
    expect(table).not.toContain("phase === 'dealing' && !view.you.spectator")
  })

  it('keeps bidding wait copy in the play zone so ming pai stays centered', () => {
    const playBlock = table.slice(table.indexOf('data-play-zone'), table.indexOf('function ActionBar'))
    expect(playBlock).toContain('data-bid-wait')
    expect(playBlock).toContain('bidWaitCopy')
    expect(table).toContain('function biddingWaitCopy')
    expect(table).toContain('等待下家叫地主')
    expect(table).toContain('等待下家抢地主')
    expect(actionBlock).not.toContain('等待下家叫地主')
    expect(actionBlock).not.toContain('等待下家抢地主')
    expect(actionBlock).not.toContain('data-bid-wait')
    expect(styles).toMatch(/\.tableStatus \{[^}]*position: absolute/)
    expect(styles).toMatch(/\.tableStatus \{[^}]*text-align: center/)
  })

  it('stacks ready copy under the start/ready control', () => {
    expect(styles).toMatch(/\.readyCenter \{[^}]*flex-direction: column/)
    expect(table).toContain('好友都准备好了，可以开打。')
    expect(table).toContain('点中间黄色按钮准备，再点一次取消。')
    expect(table).toContain('if (isHost) return canStart ? \'好友都准备好了，可以开打。\' : null')
  })

  it('puts self ready status beside 我, with a little air under the avatar', () => {
    const selfBlock = table.slice(table.lastIndexOf('data-self-seat'), table.indexOf('css.selfPlay'))
    const nameOpen = selfBlock.indexOf('css.seatName')
    const nameClose = selfBlock.indexOf('</div>', nameOpen)
    const nameBlock = selfBlock.slice(nameOpen, nameClose)
    expect(nameBlock).toContain('已准备')
    expect(nameBlock).toContain('未准备')
    expect(selfBlock.slice(nameClose)).not.toContain('已准备')
    expect(styles).toMatch(/\.selfSeat \{[^}]*justify-content: flex-end/)
    expect(styles).toMatch(/\.selfSeat \{[^}]*gap: 10px/)
  })

  it('does not insert a timer row that would shove the hand down', () => {
    expect(table).not.toContain('css.timer')
    expect(table).not.toContain('tableBar')
    expect(styles).not.toMatch(/\.tableBar \{/)
    expect(styles).toMatch(/\.turnCue \{[^}]*position: absolute/)
    expect(styles).toMatch(/\.selfPlay \.hand \{[^}]*height: 160px/)
    expect(styles).toMatch(/\.selfPlay \{[^}]*padding-top: 44px/)
    expect(styles).toMatch(/\.selfPlay \{[^}]*align-self: stretch/)
    expect(styles).toMatch(/\.selfPlay \.actions \{[^}]*position: absolute/)
  })

  it('lays hole backs in a row without a remaining-count label', () => {
    expect(table).toContain('data-hole')
    expect(table).toContain('Array.from({ length: holeCount(count) }')
    expect(table).not.toContain('holeCount(count)} compact')
    expect(table).not.toContain("phase !== 'waiting' && phase !== 'dealing'")
    expect(styles).toMatch(/\.bottom \.remain,\s*\.bottom \.backs \{[^}]*display: contents/)
    expect(styles).toMatch(/\.bottom \{[^}]*gap: 8px/)
  })

  it('hides double buttons as soon as this seat has answered', () => {
    expect(actionBlock).toContain('view.yourDouble')
    expect(actionBlock).toContain('setPendingDouble')
    expect(actionBlock).toContain('data-double-answered')
    expect(table).toContain('已不加倍')
    expect(table).toContain('已加倍 ×2')
    expect(table).toContain('已超级加倍 ×4')
  })
})
