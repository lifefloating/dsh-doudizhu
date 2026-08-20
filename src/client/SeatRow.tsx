import type { CardId, SeatState } from '../types.ts'
import { CardBack } from './CardBack.tsx'
import { FlipCard } from './FlipCard.tsx'
import { SeatAvatar } from './SeatAvatar.tsx'
import css from './styles.module.css'

export function SeatRow({
  seat, align = 'left', revealed, mingPai = false, laiZiRanks = [], waiting = false, host = false, canKick = false, onKick,
}: {
  seat: SeatState
  align?: 'left' | 'right' | 'center'
  revealed?: readonly CardId[]
  mingPai?: boolean
  laiZiRanks?: readonly string[]
  waiting?: boolean
  host?: boolean
  canKick?: boolean
  onKick?: () => void
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
            {host ? <span className={css.badge}>房主</span> : null}
            {seat.role === 'landlord' ? <span className={css.badge}>地主</span> : null}
            {seat.role === 'farmer' ? <span className={css.badge}>农民</span> : null}
            {mingPai || (revealed && revealed.length > 0) ? <span className={css.badge}>明牌</span> : null}
          </div>
          {waiting && seat.playerId
            ? <div className={seat.ready ? css.ready : css.muted}>{seat.ready ? '已准备' : '未准备'}</div>
            : null}
          {presenceLabel(seat)
            ? <div className={css.muted}>{presenceLabel(seat)}</div>
            : null}
          {canKick && seat.playerId
            ? <button type="button" className={css.kick} onClick={onKick}>踢出</button>
            : null}
        </div>
      </div>
      {revealed && revealed.length > 0
        ? (
          <div className={css.miniHand}>
            {revealed.map((card, index) => (
              <FlipCard key={card} card={card} faceUp laiZiRanks={laiZiRanks} delay={index * 0.04} />
            ))}
          </div>
        )
        : seat.playerId && seat.cardsLeft > 0
          ? <CardBack count={seat.cardsLeft} compact landlord={seat.role === 'landlord'} />
          : null}
    </div>
  )
}

function presenceLabel(seat: SeatState): string {
  if (!seat.playerId) return ''
  if (seat.autoPlay) return '托管'
  if (!seat.connected) return '离线'
  return ''
}
