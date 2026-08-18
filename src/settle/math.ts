export const STAKE_LADDER_M = [1, 2, 5, 10, 20, 50, 100] as const
export const DEFAULT_STAKE_M = 1
export const DEFAULT_MAX_MULTIPLIER = 8
export const DEFAULT_WELCOME_ATOMS = 200_000_000n
export const ATOMS_PER_M = 1_000_000n

export function stakeAtomsFromM(stakeM: number): bigint {
  return BigInt(stakeM) * ATOMS_PER_M
}

export function perFarmerCapAtoms(stakeAtoms: bigint, maxMultiplier: number): bigint {
  return stakeAtoms * 3n * BigInt(maxMultiplier) * 2n
}

export function seatCapAtoms(stakeAtoms: bigint, maxMultiplier: number, seatCount: 3 | 4 = 3): bigint {
  const farmers = BigInt(seatCount - 1)
  return farmers * perFarmerCapAtoms(stakeAtoms, maxMultiplier)
}

export function formatM(atoms: bigint): string {
  const sign = atoms < 0n ? '-' : ''
  const abs = atoms < 0n ? -atoms : atoms
  const whole = abs / ATOMS_PER_M
  const rem = abs % ATOMS_PER_M
  if (rem === 0n) return `${sign}${whole.toString()}M`
  return `${sign}${abs.toString()}`
}
