import type { Seat } from '../types.ts'

export function opponentSeats(self: Seat, count: number): Seat[] {
  const out: Seat[] = []
  for (let step = 1; step < count; step += 1) {
    out.push(((self + step) % count) as Seat)
  }
  return out
}

export function dealSeatTargets(
  self: Seat,
  count: number,
  width: number,
  height: number,
): Record<Seat, { x: number; y: number }> {
  const targets = {} as Record<Seat, { x: number; y: number }>
  targets[self] = { x: width * 0.5, y: height * 0.86 }
  const others = opponentSeats(self, count)
  if (others.length === 1) {
    targets[others[0]!] = { x: width * 0.5, y: height * 0.16 }
  } else if (others.length === 2) {
    targets[others[0]!] = { x: width * 0.14, y: height * 0.22 }
    targets[others[1]!] = { x: width * 0.86, y: height * 0.22 }
  } else if (others.length === 3) {
    targets[others[0]!] = { x: width * 0.14, y: height * 0.28 }
    targets[others[1]!] = { x: width * 0.5, y: height * 0.14 }
    targets[others[2]!] = { x: width * 0.86, y: height * 0.28 }
  }
  return targets
}

export function dealOrder(count: number, perHand: number): Seat[] {
  const order: Seat[] = []
  for (let card = 0; card < perHand; card += 1) {
    for (let seat = 0; seat < count; seat += 1) order.push(seat as Seat)
  }
  return order
}
