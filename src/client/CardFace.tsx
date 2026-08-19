import type { CardId } from '../types.ts'
import css from './styles.module.css'

const SUIT_GLYPH: Record<string, string> = { S: '♠', H: '♥', C: '♣', D: '♦' }
const ASSET = '/doudizhu/assets'
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'] as const
const FACE_ART: Record<string, string> = Object.fromEntries(
  RANKS.map((rank) => [rank, `${ASSET}/face-${rank.toLowerCase()}.png`]),
)

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
      <div className={`${css.cardFace} ${css.jokerFace} ${red ? css.red : ''} ${selected ? css.selected : ''}`}>
        <img
          className={css.jokerArt}
          src={red ? `${ASSET}/joker-red.png` : `${ASSET}/joker-black.png`}
          alt=""
        />
      </div>
    )
  }
  const suit = raw[0] ?? 'S'
  const rank = raw.slice(1)
  const red = suit === 'H' || suit === 'D'
  const art = FACE_ART[rank]
  return (
    <div className={`${css.cardFace} ${red ? css.red : ''} ${selected ? css.selected : ''} ${wild ? css.wild : ''}`}>
      <span className={css.rank}>{rank}{wild ? '*' : ''}</span>
      {art ? <img className={css.faceArt} src={art} alt="" /> : null}
      <span className={css.suit}>{SUIT_GLYPH[suit] ?? suit}</span>
    </div>
  )
}
