export interface DoudizhuHash {
  open: boolean
  roomId: string | null
  code: string
  invite: string
  role: 'sit' | 'watch'
}

export interface DoudizhuHashInput {
  roomId?: string
  code?: string
  invite?: string
  role?: 'sit' | 'watch'
}

/** Parse `#/doudizhu…` including query string that lives inside the hash. */
export function parseDoudizhuHash(hash = ''): DoudizhuHash {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const empty: DoudizhuHash = { open: false, roomId: null, code: '', invite: '', role: 'sit' }
  if (!raw.startsWith('/doudizhu')) return empty
  const q = raw.indexOf('?')
  const path = q >= 0 ? raw.slice(0, q) : raw
  const params = new URLSearchParams(q >= 0 ? raw.slice(q + 1) : '')
  const room = /^\/doudizhu\/room\/([^/]+)/.exec(path)
  return {
    open: true,
    roomId: room?.[1] ?? null,
    code: params.get('code') ?? '',
    invite: params.get('invite') ?? '',
    role: params.get('role') === 'watch' ? 'watch' : 'sit',
  }
}

export function doudizhuTabHash(input: DoudizhuHashInput = {}): string {
  if (input.roomId) return `#/doudizhu/room/${input.roomId}`
  const params = new URLSearchParams()
  if (input.code) params.set('code', input.code)
  if (input.invite) params.set('invite', input.invite)
  if (input.role === 'watch') params.set('role', 'watch')
  const query = params.toString()
  return query ? `#/doudizhu?${query}` : '#/doudizhu'
}

/** Absolute path that loads the DSH SPA, then the 斗地主 tab. */
export function doudizhuSpaPath(input: DoudizhuHashInput = {}): string {
  return `/${doudizhuTabHash(input)}`
}
