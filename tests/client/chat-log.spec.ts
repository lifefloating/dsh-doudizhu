import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nextChatHidden } from '../../src/client/chat-log.ts'

describe('table chat', () => {
  const table = readFileSync(join(process.cwd(), 'src/client/TableView.tsx'), 'utf8')
  const tags = readFileSync(join(process.cwd(), 'src/client/SeatTags.tsx'), 'utf8')
  const row = readFileSync(join(process.cwd(), 'src/client/SeatRow.tsx'), 'utf8')
  const log = readFileSync(join(process.cwd(), 'src/client/ChatLog.tsx'), 'utf8')
  const styles = readFileSync(join(process.cwd(), 'src/client/styles.module.css'), 'utf8')
  const playBlock = table.slice(table.indexOf('data-play-zone'), table.indexOf('css.bottom'))

  it('keeps host/landlord/farmer as outline pills on the same row', () => {
    expect(tags).toContain('css.badgeHost')
    expect(tags).toContain('css.badgeLandlord')
    expect(tags).toContain('css.badgeFarmer')
    expect(tags).toContain('房主')
    expect(tags).toContain('农民')
    expect(table).toContain('<SeatTags')
    expect(row).toContain('<SeatTags')
    expect(styles).toMatch(/\.badgeHost \{[^}]*#8a79b0/)
    expect(styles).toMatch(/\.badgeLandlord \{[^}]*#dcc45c/)
    expect(styles).toMatch(/\.badgeFarmer \{[^}]*#e86e6e/)
    expect(styles).toMatch(/\.badge \{[^}]*background: transparent/)
    expect(styles).toMatch(/\.seatName \{[^}]*flex-wrap: nowrap/)
    expect(styles).toMatch(/\.seatName \{[^}]*white-space: nowrap/)
    const form = readFileSync(join(process.cwd(), 'src/client/JoinForm.tsx'), 'utf8')
    expect(form).toContain('<SeatTags role="landlord" />')
    expect(form).toContain('<SeatTags role="farmer" />')
    expect(form).not.toMatch(/<figcaption>地主<\/figcaption>/)
  })

  it('puts the live log on the felt and the composer under the self seat', () => {
    expect(playBlock).toContain('<ChatLog')
    expect(playBlock).not.toContain('data-chat-composer')
    expect(table).toContain('data-chat-composer')
    expect(table).not.toContain('className={css.chat}')
    expect(styles).not.toMatch(/\.chat \{[^}]*max-height: 40px/)
    expect(styles).toMatch(/\.table:has\(\[data-chat-composer\]\) \{[^}]*padding-bottom: 44px/)
    expect(styles).toMatch(/\.chatComposer \{[^}]*position: absolute/)
    expect(styles).toMatch(/\.chatInput \{[^}]*height: 36px/)
  })

  it('renders a transparent live-stream log with a hover close control', () => {
    expect(log).toContain('data-chat-log')
    expect(log).toContain('隐藏聊天')
    expect(log).toContain('setHidden(true)')
    expect(log).toContain('nextChatHidden')
    expect(styles).toMatch(/\.chatLog \{[^}]*position: absolute/)
    expect(styles).toMatch(/\.chatLog \{[^}]*background: transparent/)
    expect(styles).toMatch(/\.chatLog:hover \.chatLogClose \{[^}]*opacity: 1/)
    expect(styles).toMatch(/\.chatLog:hover \{[^}]*background: rgba\(126, 200, 255, 0\.06\)/)
    expect(styles).toMatch(/\.chatLogClose \{[^}]*#5eb0ff/)
  })

  it('unhides the log when a newer line arrives after dismiss', () => {
    expect(nextChatHidden(true, 't1', 't2')).toBe(false)
    expect(nextChatHidden(true, 't1', 't1')).toBe(true)
    expect(nextChatHidden(false, 't1', 't2')).toBe(false)
    expect(nextChatHidden(true, null, 't1')).toBe(false)
    expect(nextChatHidden(false, 't1', null)).toBe(true)
  })
})
