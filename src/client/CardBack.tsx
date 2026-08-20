import { visibleBackCount } from './card-stack.ts'
import css from './styles.module.css'

const ASSET = '/doudizhu/assets'

export { COMPACT_STACK_MAX, visibleBackCount } from './card-stack.ts'

export function CardBack({
  count = 1,
  compact = false,
  landlord = false,
}: {
  count?: number
  compact?: boolean
  landlord?: boolean
}) {
  const remaining = Math.max(0, count)
  const n = compact ? visibleBackCount(remaining) : Math.min(remaining, 20)
  const src = landlord ? `${ASSET}/card-back-landlord.webp` : `${ASSET}/card-back.webp`
  return (
    <div className={`${css.remain} ${compact ? css.remainCompact : ''}`}>
      {compact && remaining > 0
        ? <span className={css.cardsLeft} aria-label={`剩余 ${remaining} 张`}>{remaining}</span>
        : null}
      <div className={`${css.backs} ${compact ? css.backsCompact : ''}`} aria-hidden="true">
        {Array.from({ length: n }, (_, index) => (
          <div
            className={`${css.cardBack} ${landlord ? css.cardBackLandlord : ''}`}
            key={index}
            style={{ zIndex: index }}
          >
            <img className={css.cardBackArt} src={src} alt="" />
          </div>
        ))}
      </div>
    </div>
  )
}
