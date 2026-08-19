export const STAKE_LADDER_M = [1, 2, 5, 10, 20, 50, 100] as const
export const DEFAULT_STAKE_M = 1
export const DEFAULT_MAX_MULTIPLIER = 8
export const DEFAULT_WELCOME_ATOMS = 200_000_000n
export const ATOMS_PER_M = 1_000_000n
export const ATOMS_PER_B = 1_000_000_000n

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

/** Display token atoms as AI-token units: M (million) or B (billion). Never dump raw zeros. */
export function formatM(atoms: bigint): string {
  const sign = atoms < 0n ? '-' : ''
  const abs = atoms < 0n ? -atoms : atoms
  if (abs >= ATOMS_PER_B) return `${sign}${formatScaled(abs, ATOMS_PER_B)}B`
  return `${sign}${formatScaled(abs, ATOMS_PER_M)}M`
}

function formatScaled(abs: bigint, unit: bigint): string {
  const whole = abs / unit
  const rem = abs % unit
  if (rem === 0n) return whole.toString()
  const decimals = unit.toString().length - 1
  const frac = rem.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${whole.toString()}.${frac}`
}
