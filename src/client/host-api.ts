import type { ClientCommand, PlayerView, PublicSettlement, RoomPreview, ServerEvent } from '../types.ts'
import { browserInstanceId } from './browser.ts'
import { ALREADY_IN_ROOM_MESSAGE } from './presence.ts'

const PREFIX = '/doudizhu'

export interface CreateRoomResponse {
  roomId: string
  roomCode: string
  sitUrl: string
  watchUrl: string
  seatCapAtoms: string
  shareable: boolean
  hostPlayerId: string
  view: PlayerView
  wsTicket: string
}

export interface JoinResponse {
  playerId: string
  roomId: string
  seat: 0 | 1 | 2 | 3 | null
  wsTicket: string
  view: PlayerView
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PREFIX}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'doudizhu',
      ...(init?.headers ?? {}),
    },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) as T & { error?: string; message?: string } : {} as T
  if (!response.ok) {
    const code = (body as { error?: string }).error
    if (code === 'already-in-room') throw new Error(ALREADY_IN_ROOM_MESSAGE)
    throw new Error((body as { message?: string }).message ?? code ?? response.statusText)
  }
  return body
}

function withBrowser(input: object): object {
  const browserId = browserInstanceId()
  return browserId ? { ...input, browserId } : input
}

export interface PluginReady {
  ok: boolean
  plugin: string
  turnTimeoutMs?: number
}

export function fetchPluginReady() {
  return request<PluginReady>('/api/ready')
}

export function createRoom(input: {
  stakeM: number
  maxMultiplier: number
  seatCount?: 3 | 4
  laiZi?: boolean
  hostDisplayName?: string
  title?: string
}) {
  return request<CreateRoomResponse>('/api/rooms', { method: 'POST', body: JSON.stringify(withBrowser(input)) })
}

export function peekRoom(input: { roomCode: string; invite: string }) {
  const query = new URLSearchParams({
    code: input.roomCode,
    invite: input.invite,
  })
  const browserId = browserInstanceId()
  if (browserId) query.set('browser', browserId)
  return request<RoomPreview>(`/api/preview?${query.toString()}`)
}

export function joinRoom(input: { roomCode: string; invite: string; displayName: string; role: 'sit' | 'watch' }) {
  return request<JoinResponse>('/api/join', { method: 'POST', body: JSON.stringify(withBrowser(input)) })
}

/** Fire-and-forget so tab close / overlay unmount still reaches the host. */
export function leaveHere(): void {
  try {
    void fetch(`${PREFIX}/api/leave`, {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'x-requested-with': 'doudizhu',
      },
      body: '{}',
    })
  } catch {
    /* unloading */
  }
}

export function sendCommand(roomId: string, command: ClientCommand) {
  return request<{ seq: number }>(`/api/rooms/${roomId}/command`, { method: 'POST', body: JSON.stringify(command) })
}

export function fetchSince(roomId: string, seq: number) {
  return request<{ events: ServerEvent[]; untilSeq: number }>(`/api/rooms/${roomId}/since?seq=${seq}`)
}

export function fetchLedger() {
  return request<{ availableAtoms: string; escrowAtoms: string }>(`/api/me/ledger`)
}

export function connectChannel(
  ticket: string,
  onEvent: (event: ServerEvent) => void,
  fallback: { roomId: string; seq: () => number },
): () => void {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  let closed = false
  let ws: WebSocket | null = null
  let poll: ReturnType<typeof setInterval> | undefined
  let ping: ReturnType<typeof setInterval> | undefined
  try {
    ws = new WebSocket(`${proto}://${location.host}${PREFIX}/ws?ticket=${encodeURIComponent(ticket)}`, 'doudizhu.v1')
    ws.onopen = () => {
      ping = setInterval(() => {
        if (closed || !ws || ws.readyState !== WebSocket.OPEN) return
        ws.send(JSON.stringify({ type: 'ping' }))
      }, 15_000)
    }
    ws.onmessage = (event) => {
      try { onEvent(JSON.parse(String(event.data)) as ServerEvent) } catch { /* ignore */ }
    }
    ws.onerror = () => { startPoll() }
    ws.onclose = () => { if (!closed) startPoll() }
  } catch {
    startPoll()
  }
  function startPoll(): void {
    if (poll || closed) return
    if (ping) clearInterval(ping)
    ping = undefined
    poll = setInterval(() => {
      void fetchSince(fallback.roomId, fallback.seq()).then((body) => {
        for (const event of body.events) onEvent(event)
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : ''
        if (message === 'not in this room' || message === 'not joined') {
          onEvent({ type: 'left', seq: 0, reason: 'disconnected' })
          closed = true
          if (poll) clearInterval(poll)
          poll = undefined
        }
      })
    }, 800)
  }
  return () => {
    closed = true
    ws?.close()
    if (poll) clearInterval(poll)
    if (ping) clearInterval(ping)
  }
}

export type { PlayerView, PublicSettlement, RoomPreview, ServerEvent }
