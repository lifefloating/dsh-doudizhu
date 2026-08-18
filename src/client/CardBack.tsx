import css from './styles.module.css'
import { WhaleMark } from './WhaleMark.tsx'

export function CardBack({ count = 1 }: { count?: number }) {
  const n = Math.max(0, Math.min(count, 20))
  return (
    <div className={css.backs} aria-hidden="true">
      {Array.from({ length: n }, (_, index) => (
        <div className={css.cardBack} key={index}>
          <WhaleMark size={28} />
        </div>
      ))}
    </div>
  )
}
