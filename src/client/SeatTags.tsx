import type { SeatState } from '../types.ts'
import css from './styles.module.css'

export function SeatTags({
  host = false,
  role = 'empty',
  mingPai = false,
  spectator = false,
}: {
  host?: boolean
  role?: SeatState['role']
  mingPai?: boolean
  spectator?: boolean
}) {
  return (
    <>
      {host ? <span className={`${css.badge} ${css.badgeHost}`}>房主</span> : null}
      {spectator ? <span className={css.badge}>观战</span> : null}
      {role === 'landlord' ? <span className={`${css.badge} ${css.badgeLandlord}`}>地主</span> : null}
      {role === 'farmer' ? <span className={`${css.badge} ${css.badgeFarmer}`}>农民</span> : null}
      {mingPai ? <span className={css.badge}>明牌</span> : null}
    </>
  )
}
