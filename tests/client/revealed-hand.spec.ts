import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('revealed hand layout', () => {
  const row = readFileSync(join(process.cwd(), 'src/client/SeatRow.tsx'), 'utf8')
  const styles = readFileSync(join(process.cwd(), 'src/client/styles.module.css'), 'utf8')
  const miniHand = styles.slice(styles.indexOf('.miniHand {'), styles.indexOf('.qr {'))

  it('renders every revealed card in a dedicated visible region', () => {
    expect(row).toContain('data-revealed-hand')
    expect(row).toContain('revealed.map((card, index)')
    expect(row).toContain('aria-label={`${seat.displayName ?? \'玩家\'}的明牌`}')
  })

  it('shows every concealed card as a back without exposing card ids', () => {
    expect(row).toContain('data-concealed-hand')
    expect(row).toContain('Array.from({ length: seat.cardsLeft }')
    expect(row).toContain("<CardBack key={index} landlord={seat.role === 'landlord'} />")
    expect(row).not.toContain('<CardBack count={seat.cardsLeft} compact')
  })

  it('uses controlled overlap while keeping every card value visible and unclipped', () => {
    expect(miniHand).toContain('flex-wrap: wrap')
    expect(miniHand).toContain('row-gap: 3px')
    expect(miniHand).toContain('margin-left: -16px')
    expect(miniHand).toContain('.miniHand > *:first-child')
    expect(miniHand).toContain('overflow: visible')
    expect(miniHand).not.toContain('overflow: hidden')
  })
})
