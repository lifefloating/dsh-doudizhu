export const COMPACT_STACK_MAX = 5

export function visibleBackCount(remaining: number, maxVisible = COMPACT_STACK_MAX): number {
  if (remaining <= 0) return 0
  return Math.min(remaining, maxVisible)
}
