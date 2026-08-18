import { seatCapAtoms } from './math.ts'

export { seatCapAtoms }

export function canReady(available: bigint, stakeAtoms: bigint, maxMultiplier: number): boolean {
  return available >= seatCapAtoms(stakeAtoms, maxMultiplier)
}
