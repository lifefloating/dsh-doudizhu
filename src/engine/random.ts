import { randomBytes } from 'node:crypto'

export function cryptoUnit(): number {
  const buf = randomBytes(4)
  return buf.readUInt32BE(0) / 0x1_0000_0000
}
