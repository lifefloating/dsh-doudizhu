import { useEffect, useState } from 'react'
import { formatM } from '../settle/math.ts'
import { parseAtoms, type PlayerView } from '../types.ts'

export function useDeadline(deadlineAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!deadlineAt) return undefined
    const tick = setInterval(() => { setNow(Date.now()) }, 250)
    return () => { clearInterval(tick) }
  }, [deadlineAt])
  if (!deadlineAt) return null
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - now) / 1000))
}

export function phaseLabel(phase: PlayerView['room']['phase']): string {
  if (phase === 'waiting') return '准备'
  if (phase === 'dealing') return '发牌'
  if (phase === 'bidding') return '叫抢'
  if (phase === 'doubling') return '加倍'
  if (phase === 'playing') return '出牌'
  if (phase === 'settling') return '结算'
  return phase
}

export function tableMeta(view: PlayerView, seconds: number | null): string {
  const count = view.room.seatCount ?? (view.room.seats.length >= 4 ? 4 : 3)
  return `${count}人${view.room.laiZi ? '癞子' : '经典'} · 底注 ${formatM(parseAtoms(view.room.stakeAtoms))} · ${view.bid ? `${view.bid}倍` : '未叫'} · ${phaseLabel(view.room.phase)}${seconds !== null ? ` ${seconds}秒` : ''}`
}

export function tableBalance(view: PlayerView): string {
  return `余额 ${formatM(parseAtoms(view.yourAvailableAtoms))} · 冻结 ${formatM(parseAtoms(view.yourEscrowAtoms))}`
}
