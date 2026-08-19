import type { SeatState } from '../types.ts'
import css from './styles.module.css'

const ASSET = '/doudizhu/assets'

export const ROLE_ICONS = {
  landlord: `${ASSET}/role-landlord.png`,
  landlordB: `${ASSET}/role-landlord-b.png`,
  farmer: `${ASSET}/role-farmer.png`,
  farmerB: `${ASSET}/role-farmer-b.png`,
} as const

export function roleIconSrc(role: SeatState['role'], seat = 0): string {
  if (role === 'landlord') return seat % 2 === 0 ? ROLE_ICONS.landlord : ROLE_ICONS.landlordB
  return seat % 2 === 0 ? ROLE_ICONS.farmer : ROLE_ICONS.farmerB
}

export function SeatAvatar({
  avatarUrl,
  role = 'empty',
  seat = 0,
  occupied = false,
}: {
  avatarUrl?: string | null
  role?: SeatState['role']
  seat?: number
  occupied?: boolean
}) {
  const sitting = occupied || role === 'landlord' || role === 'farmer'
  const src = sitting ? roleIconSrc(role === 'empty' ? 'farmer' : role, seat) : avatarUrl
  if (!src) return null
  const landlord = role === 'landlord'
  return (
    <img
      className={`${css.avatar} ${landlord ? css.avatarLandlord : ''}`}
      src={src}
      alt={landlord ? '地主' : sitting ? '农民' : ''}
      onError={(event) => { event.currentTarget.remove() }}
    />
  )
}
