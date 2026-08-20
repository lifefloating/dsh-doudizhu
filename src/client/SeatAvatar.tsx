import type { SeatState } from '../types.ts'
import css from './styles.module.css'

const ASSET = '/doudizhu/assets'

export const ROLE_ICONS = {
  landlord: `${ASSET}/role-landlord.png`,
  landlordB: `${ASSET}/role-landlord-b.png`,
  farmer: `${ASSET}/role-farmer.png`,
  farmerB: `${ASSET}/role-farmer-b.png`,
  farmerC: `${ASSET}/role-farmer-c.png`,
  spectator: `${ASSET}/role-spectator.png`,
} as const

const FARMER_ICONS = [ROLE_ICONS.farmer, ROLE_ICONS.farmerB, ROLE_ICONS.farmerC] as const

export function roleIconSrc(role: SeatState['role'], seat = 0): string {
  if (role === 'landlord') return ROLE_ICONS.landlord
  return FARMER_ICONS[Math.abs(seat) % FARMER_ICONS.length] ?? ROLE_ICONS.farmer
}

export function SeatAvatar({
  avatarUrl,
  role = 'empty',
  seat = 0,
  occupied = false,
  spectator = false,
  self = false,
}: {
  avatarUrl?: string | null
  role?: SeatState['role']
  seat?: number
  occupied?: boolean
  spectator?: boolean
  self?: boolean
}) {
  if (spectator) {
    return (
      <img
        className={css.avatar}
        src={ROLE_ICONS.spectator}
        alt="观战"
        onError={(event) => { event.currentTarget.remove() }}
      />
    )
  }
  const sitting = occupied || role === 'landlord' || role === 'farmer'
  const src = sitting ? roleIconSrc(role === 'empty' ? 'farmer' : role, seat) : avatarUrl
  if (!src) return null
  const landlord = role === 'landlord'
  return (
    <img
      className={`${css.avatar} ${self ? css.avatarSelf : ''}`}
      src={src}
      alt={landlord ? '地主' : sitting ? '农民' : ''}
      onError={(event) => { event.currentTarget.remove() }}
    />
  )
}
