import css from './styles.module.css'
import { WhaleMark } from './WhaleMark.tsx'

export function CardBack({ count = 1, useSvg = false }: { count?: number; useSvg?: boolean }) {
  const n = Math.max(0, Math.min(count, 20))
  return (
    <div className={css.backs} aria-hidden="true">
      {Array.from({ length: n }, (_, index) => (
        <div className={css.cardBack} key={index}>
          {useSvg
            ? <img src="/doudizhu/assets/card-back-whale.svg" width={28} height={21} alt="" />
            : <WhaleMark size={28} />}
        </div>
      ))}
    </div>
  )
}
