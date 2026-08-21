import type { CardId, SeatState } from '../types.ts'
import { CardBack } from './CardBack.tsx'
import { FlipCard } from './FlipCard.tsx'
import { SeatAvatar } from './SeatAvatar.tsx'
import { SeatTags } from './SeatTags.tsx'
import css from './styles.module.css'

export function SeatRow({
  seat, align = 'left', revealed, mingPai = false, laiZiRanks = [], waiting = false, host = false,
  canKick = false, playing = false, onKick,
}: {
  seat: SeatState
  align?: 'left' | 'right' | 'center'
  revealed?: readonly CardId[]
  mingPai?: boolean
  laiZiRanks?: readonly string[]
  waiting?: boolean
  host?: boolean
  canKick?: boolean
  playing?: boolean
  onKick?: () => void
}) {
  const alignClass = align === 'right' ? css.seatRight : align === 'center' ? css.seatCenter : ''
  return (
    <div className={`${css.seat} ${alignClass}`}>
      <div className={css.seatHead}>
        <div className={css.seatAvatarWrap}>
          {playing
            ? (
              <div className={css.turnCue} data-turn-cue="">
                <span className={css.turnCueText}>出牌中…</span>
                <span className={css.turnArrow} aria-hidden="true" />
              </div>
            )
            : null}
          <SeatAvatar
            avatarUrl={seat.avatarUrl}
            role={seat.role}
            seat={seat.seat}
            occupied={Boolean(seat.playerId)}
          />
        </div>
        <div className={css.seatMeta}>
          <div className={css.seatName}>
            {seat.displayName ?? '空座'}
            <SeatTags
              host={host}
              role={seat.role}
              mingPai={mingPai || Boolean(revealed && revealed.length > 0)}
            />
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
          <div className={css.miniHand} data-revealed-hand="" aria-label={`${seat.displayName ?? '玩家'}的明牌`}>
            {revealed.map((card, index) => (
              <FlipCard key={card} card={card} faceUp laiZiRanks={laiZiRanks} delay={index * 0.04} />
            ))}
          </div>
        )
        : seat.playerId && seat.cardsLeft > 0
          ? (
            <div
              className={css.concealedHand}
              data-concealed-hand=""
              aria-label={`${seat.displayName ?? '玩家'}有 ${seat.cardsLeft} 张牌，未明牌`}
            >
              <span className={css.cardsLeft} aria-hidden="true">{seat.cardsLeft}</span>
              <div className={css.miniHand} aria-hidden="true">
                {Array.from({ length: seat.cardsLeft }, (_, index) => (
                  <CardBack key={index} landlord={seat.role === 'landlord'} />
                ))}
              </div>
            </div>
          )
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
