import { formatM } from '../settle/math.ts'
import type { PlayerView, PublicSettlement, Seat } from '../types.ts'
import { parseAtoms } from '../types.ts'
import { ROLE_ICONS } from './SeatAvatar.tsx'
import css from './styles.module.css'

export function SettlementView({
  settlement, view, onRematch, onClose,
}: {
  settlement: PublicSettlement
  view: PlayerView
  onRematch: () => void
  onClose: () => void
}) {
  const isHost = view.you.playerId === view.room.hostPlayerId
  const landlordSeat = landlordSeatOf(settlement)
  return (
    <div className={css.settlement} data-settlement="">
      <div className={css.card}>
        <div className={css.roleHero}>
          {settlement.winner === 'landlord'
            ? <img className={css.roleHeroImg} src={ROLE_ICONS.landlord} alt="地主" />
            : (
              <>
                <img className={css.roleHeroImg} src={ROLE_ICONS.farmer} alt="农民" />
                <img className={css.roleHeroImg} src={ROLE_ICONS.farmerB} alt="农民" />
              </>
            )}
        </div>
        <h2>{settlement.winner === 'landlord' ? '地主胜' : '农民胜'}</h2>
        <p className={css.hint}>{settlement.formula}</p>
        <ul className={css.settlementList}>
          {settlement.deltas.map((delta) => {
            const atoms = parseAtoms(delta.atoms)
            const name = view.room.seats.find((seat) => seat.seat === delta.seat)?.displayName
              ?? `座 ${delta.seat}`
            const self = delta.playerId === view.you.playerId
            return (
              <li
                key={delta.seat}
                className={atoms < 0n ? css.settlementLose : atoms > 0n ? css.settlementWin : undefined}
              >
                {name}
                {delta.seat === landlordSeat ? <span className={`${css.badge} ${css.badgeLandlord}`}>地主</span> : null}
                {self ? <span className={css.badge}>我</span> : null}
                <span>{signedM(atoms)}</span>
              </li>
            )
          })}
        </ul>
        <p className={css.hint}>你的余额 {formatM(parseAtoms(view.yourAvailableAtoms))}</p>
        <p className={`${css.hint} ${css.warn}`}>{settlement.trustNote}</p>
        <p className={css.hint}>积分 ≠ 平台余额，也不是 API key。</p>
        {isHost
          ? (
            <div className={css.settlementActions}>
              <button type="button" className={css.primary} data-rematch="" onClick={onRematch}>
                再来一局
              </button>
              <button type="button" className={css.danger} data-close-room="" onClick={onClose}>
                解散房间
              </button>
            </div>
          )
          : <p className={css.hint}>等待房主再开一局或解散房间</p>}
      </div>
    </div>
  )
}

function signedM(atoms: bigint): string {
  const text = formatM(atoms)
  return atoms > 0n ? `+${text}` : text
}

function landlordSeatOf(settlement: PublicSettlement): Seat | null {
  const wantPositive = settlement.winner === 'landlord'
  return settlement.deltas.find((delta) => {
    const atoms = parseAtoms(delta.atoms)
    return wantPositive ? atoms > 0n : atoms < 0n
  })?.seat ?? null
}
