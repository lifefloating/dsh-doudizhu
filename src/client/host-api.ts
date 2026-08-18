import type { ClientCommand, PlayerView, PublicSettlement, ServerEvent } from '../types.ts'

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
    throw new Error((body as { message?: string }).message ?? (body as { error?: string }).error ?? response.statusText)
  }
  return body
}

export function createRoom(input: {
  stakeM: number
  maxMultiplier: number
  seatCount?: 3 | 4
  laiZi?: boolean
  hostDisplayName?: string
}) {
  return request<CreateRoomResponse>('/api/rooms', { method: 'POST', body: JSON.stringify(input) })
}

export function joinRoom(input: { roomCode: string; invite: string; displayName: string; role: 'sit' | 'watch' }) {
  return request<JoinResponse>('/api/join', { method: 'POST', body: JSON.stringify(input) })
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
  try {
    ws = new WebSocket(`${proto}://${location.host}${PREFIX}/ws?ticket=${encodeURIComponent(ticket)}`, 'doudizhu.v1')
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
    poll = setInterval(() => {
      void fetchSince(fallback.roomId, fallback.seq()).then((body) => {
        for (const event of body.events) onEvent(event)
      }).catch(() => { /* keep polling */ })
    }, 800)
  }
  return () => {
    closed = true
    ws?.close()
    if (poll) clearInterval(poll)
  }
}

export type { PlayerView, PublicSettlement, ServerEvent }
