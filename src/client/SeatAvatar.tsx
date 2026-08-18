import css from './styles.module.css'

export function SeatAvatar({ avatarUrl }: { avatarUrl: string | null }) {
  if (!avatarUrl) return null
  return (
    <img
      className={css.avatar}
      src={avatarUrl}
      alt=""
      onError={(event) => { event.currentTarget.remove() }}
    />
  )
}
