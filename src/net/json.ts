/** JSON wire encoding: bigint atoms become decimal strings. */
export function encodeJson(body: unknown): string {
  return JSON.stringify(body, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
}
