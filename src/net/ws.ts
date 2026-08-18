import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'
import type { WebServer } from '@deepseek-ai/cordis'
import { MAX_FRAME_BYTES, SUBPROTOCOL } from '../invariant.ts'
import type { RoomManager } from '../room/RoomManager.ts'
import type { ClientCommand, PlayerId, RoomId, ServerEvent } from '../types.ts'
import { assertOrigin, header } from './auth.ts'
import { encodeJson } from './json.ts'

interface SocketState {
  playerId: PlayerId
  roomId: RoomId
  lastSeen: number
}

export function registerDouDizhuSocket(server: WebServer, manager: RoomManager): () => void {
  const wss = new WebSocketServer({ noServer: true, handleProtocols: (protocols) => (
    protocols.has(SUBPROTOCOL) ? SUBPROTOCOL : false
  ) })
  const sockets = new Map<WebSocket, SocketState>()
  const off = manager.onEvent((playerId, event) => {
    for (const [ws, state] of sockets) {
      if (state.playerId === playerId && ws.readyState === WebSocket.OPEN) send(ws, event)
    }
  })
  const heartbeat = setInterval(() => {
    const now = Date.now()
    for (const [ws, state] of sockets) {
      if (now - state.lastSeen > manager.getConfig().disconnectAfterMs) {
        ws.close()
      }
    }
  }, manager.getConfig().heartbeatMs)
  if (typeof heartbeat === 'object' && 'unref' in heartbeat) heartbeat.unref()

  const disposeRoute = server.registerUpgrade({
    path: `${manager.getConfig().routePrefix}/ws`,
    handler: (req, socket, head) => {
      try {
        assertOrigin(req as never, manager.getConfig().publicBaseUrl)
      } catch {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const ticket = url.searchParams.get('ticket') ?? ''
      const consumed = manager.consumeTicket(ticket)
      if (!consumed) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      wss.handleUpgrade(req as never, socket as never, head, (ws) => {
        const state: SocketState = { playerId: consumed.playerId, roomId: consumed.roomId, lastSeen: Date.now() }
        sockets.set(ws, state)
        manager.counters.wsConnected += 1
        manager.markConnected(state.playerId, state.roomId)
        send(ws, { type: 'snapshot', seq: 0, view: manager.view(state.roomId, state.playerId) })
        ws.on('message', (data) => {
          if (Buffer.byteLength(data.toString()) > MAX_FRAME_BYTES) {
            ws.close()
            return
          }
          state.lastSeen = Date.now()
          void onMessage(ws, state, data.toString(), manager)
        })
        ws.on('close', () => {
          sockets.delete(ws)
          manager.counters.wsConnected = Math.max(0, manager.counters.wsConnected - 1)
          manager.markDisconnected(state.playerId, state.roomId)
        })
      })
    },
  })

  return () => {
    clearInterval(heartbeat)
    off()
    disposeRoute()
    wss.close()
  }
}

async function onMessage(ws: WebSocket, state: SocketState, raw: string, manager: RoomManager): Promise<void> {
  let command: ClientCommand
  try {
    command = JSON.parse(raw) as ClientCommand
  } catch {
    send(ws, { type: 'reject', code: 'illegal', reason: 'invalid json' })
    return
  }
  try {
    const result = await manager.command(state.roomId, state.playerId, command)
    if (command.type === 'ping') send(ws, { type: 'pong', ts: Date.now() })
    void result
  } catch (error) {
    const code = (error as { code?: ServerEvent extends { code: infer C } ? C : never }).code ?? 'illegal'
    send(ws, { type: 'reject', code: (error as { code?: 'illegal' }).code ?? 'illegal', reason: error instanceof Error ? error.message : 'rejected' })
    void code
  }
}

function send(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(encodeJson(event))
}

export function protocolOf(req: IncomingMessage): string | undefined {
  return header(req as never, 'sec-websocket-protocol')
}

export type { Duplex }
