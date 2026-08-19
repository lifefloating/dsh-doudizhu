import type { CardId, SeatState } from '../types.ts'
import { CardBack } from './CardBack.tsx'
import { CardFace } from './CardFace.tsx'
import { SeatAvatar } from './SeatAvatar.tsx'
import css from './styles.module.css'

export function SeatRow({
  seat, align = 'left', revealed, laiZiRanks = [],
}: {
  seat: SeatState
  align?: 'left' | 'right' | 'center'
  revealed?: readonly CardId[]
  laiZiRanks?: readonly string[]
}) {
  const alignClass = align === 'right' ? css.seatRight : align === 'center' ? css.seatCenter : ''
  return (
    <div className={`${css.seat} ${alignClass}`}>
      <div className={css.seatHead}>
        <SeatAvatar
          avatarUrl={seat.avatarUrl}
          role={seat.role}
          seat={seat.seat}
          occupied={Boolean(seat.playerId)}
        />
        <div className={css.seatMeta}>
          <div className={css.seatName}>
            {seat.displayName ?? '空座'}
            {seat.role === 'landlord' ? <span className={css.badge}>地主</span> : null}
            {seat.role === 'farmer' ? <span className={css.badge}>农民</span> : null}
            {revealed && revealed.length > 0 ? <span className={css.badge}>明牌</span> : null}
          </div>
          {seat.ready && seat.role === 'empty' ? <div className={css.ready}>准备</div> : null}
          <div className={css.muted}>{seat.connected ? '在线' : seat.playerId ? '离线' : ''}</div>
        </div>
      </div>
      {revealed && revealed.length > 0
        ? (
          <div className={css.miniHand}>
            {revealed.map((card) => <CardFace key={card} card={card} laiZiRanks={laiZiRanks} />)}
          </div>
        )
        : seat.playerId && seat.cardsLeft > 0
          ? <CardBack count={seat.cardsLeft} compact landlord={seat.role === 'landlord'} />
          : null}
    </div>
  )
}
