import type { CardId } from '../types.ts'
import css from './styles.module.css'

const SUIT_GLYPH: Record<string, string> = { S: '♠', H: '♥', C: '♣', D: '♦' }

function cardBase(card: CardId | string): string {
  return String(card).split('~')[0] ?? String(card)
}

function rankOf(card: CardId): string {
  const raw = cardBase(card)
  if (raw === 'BJ' || raw === 'RJ') return raw
  return raw.slice(1)
}

function isWildCard(card: CardId, wildRanks: readonly string[]): boolean {
  const rank = rankOf(card)
  return wildRanks.length > 0 && rank !== 'BJ' && rank !== 'RJ' && wildRanks.includes(rank)
}

export function CardFace({
  card, selected = false, laiZiRanks = [],
}: {
  card: CardId
  selected?: boolean
  laiZiRanks?: readonly string[]
}) {
  const raw = cardBase(card)
  const wild = isWildCard(card, laiZiRanks)
  if (raw === 'BJ' || raw === 'RJ' || rankOf(card) === 'BJ' || rankOf(card) === 'RJ') {
    const red = rankOf(card) === 'RJ'
    return (
      <div className={`${css.cardFace} ${red ? css.red : ''} ${selected ? css.selected : ''}`}>
        <span className={css.rank}>{red ? '大王' : '小王'}</span>
        <span className={css.suit}>{red ? '★' : '☆'}</span>
      </div>
    )
  }
  const suit = raw[0] ?? 'S'
  const rank = raw.slice(1)
  const red = suit === 'H' || suit === 'D'
  return (
    <div className={`${css.cardFace} ${red ? css.red : ''} ${selected ? css.selected : ''} ${wild ? css.wild : ''}`}>
      <span className={css.rank}>{rank}{wild ? '*' : ''}</span>
      <span className={css.suit}>{SUIT_GLYPH[suit] ?? suit}</span>
    </div>
  )
}
