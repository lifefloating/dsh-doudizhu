import { formatM } from '../settle/math.ts'
import type { PublicSettlement } from '../types.ts'
import { parseAtoms } from '../types.ts'
import css from './styles.module.css'

export function SettlementView({
  settlement, onRematch,
}: {
  settlement: PublicSettlement
  onRematch: () => void
}) {
  return (
    <div className={css.settlement}>
      <div className={css.card}>
        <h2>{settlement.winner === 'landlord' ? '地主胜' : '农民胜'}</h2>
        <p className={css.hint}>{settlement.formula}</p>
        <ul>
          {settlement.deltas.map((delta) => (
            <li key={delta.seat}>座 {delta.seat}: {formatM(parseAtoms(delta.atoms))}</li>
          ))}
        </ul>
        <p className={`${css.hint} ${css.warn}`}>{settlement.trustNote}</p>
        <p className={css.hint}>积分 ≠ 平台余额，也不是 API key。</p>
        <button type="button" className={css.primary} onClick={onRematch}>再来一局</button>
      </div>
    </div>
  )
}
