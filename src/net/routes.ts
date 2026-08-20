import type { IncomingMessage, ServerResponse, WebServer } from '@deepseek-ai/cordis'
import type { RoomManager } from '../room/RoomManager.ts'
import { fail } from '../room/RoomManager.ts'
import type { ClientCommand, RejectCode } from '../types.ts'
import {
  assertMutatingHeaders, assertOrigin, cookieHeader, header, isLoopbackHost, parseCookies,
} from './auth.ts'
import { encodeJson } from './json.ts'
import { joinAsset, joinPageHtml } from './join-page.ts'

export function registerDouDizhuHttp(server: WebServer, manager: RoomManager): Array<() => void> {
  const prefix = manager.getConfig().routePrefix
  return [
    server.register({
      kind: 'prefix',
      path: prefix,
      handler: (req, res) => handle(req as IncomingMessage, res as ServerResponse, manager, prefix),
    }),
  ]
}

async function handle(req: IncomingMessage, res: ServerResponse, manager: RoomManager, prefix: string): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const path = url.pathname
    if (req.method === 'GET' && (path === prefix || path === `${prefix}/` || path === `${prefix}/join`)) {
      html(res, joinPageHtml())
      return
    }
    if (req.method === 'GET' && path.startsWith(`${prefix}/assets/`)) {
      const name = path.slice(`${prefix}/assets/`.length)
      const asset = joinAsset(name)
      if (!asset) {
        send(res, 404, '')
        return
      }
      send(res, 200, asset.body, { 'content-type': asset.type, 'cache-control': 'no-store' })
      return
    }
    if (req.method === 'GET' && (path === `${prefix}/join.js` || path === `${prefix}/index.js`)) {
      const asset = joinAsset('index.js')
      if (!asset) {
        send(res, 404, '')
        return
      }
      send(res, 200, asset.body, { 'content-type': asset.type, 'cache-control': 'no-store' })
      return
    }
    if (path.startsWith(`${prefix}/api/`)) {
      await handleApi(req, res, manager, prefix, url)
      return
    }
    send(res, 404, encodeJson({ error: 'expired', message: 'not found' }), {
      'content-type': 'application/json',
    })
  } catch (error) {
    writeError(res, error)
  }
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  manager: RoomManager,
  prefix: string,
  url: URL,
): Promise<void> {
  const config = manager.getConfig()
  const path = url.pathname.slice(prefix.length)
  const cookies = parseCookies(req)
  const secure = config.publicBaseUrl.startsWith('https://')

  if (req.method === 'POST' && path === '/api/join') {
    assertOrigin(req, config.publicBaseUrl)
    assertMutatingHeaders(req)
    const body = await readJson<{ roomCode: string; invite: string; displayName: string; role: 'sit' | 'watch' }>(req)
    const loopback = isLoopbackHost(header(req, 'host'), req.socket.remoteAddress)
    const result = await manager.join({
      roomCode: String(body.roomCode ?? ''),
      invite: String(body.invite ?? ''),
      displayName: String(body.displayName ?? ''),
      role: body.role === 'watch' ? 'watch' : 'sit',
      local: loopback,
    })
    json(res, 200, {
      playerId: result.playerId,
      roomId: result.roomId,
      seat: result.seat,
      wsTicket: result.wsTicket,
      view: result.view,
    }, [cookieHeader('ddz_seat', result.cookie, { secure, sameSite: 'Lax' })])
    return
  }

  if (req.method === 'POST' && path === '/api/rooms') {
    assertOrigin(req, config.publicBaseUrl)
    assertMutatingHeaders(req)
    const loopback = isLoopbackHost(header(req, 'host'), req.socket.remoteAddress)
    if (!loopback && !manager.isHostCookie(cookies.ddz_host)) {
      throw Object.assign(new Error('createRoom requires loopback or host cookie'), { status: 403, code: 'auth' })
    }
    const body = await readJson<{
      stakeM?: number
      maxMultiplier?: number
      seatCount?: 3 | 4
      laiZi?: boolean
      hostDisplayName?: string
      title?: string
    }>(req)
    try {
      const created = await manager.createRoom({
        stakeM: Number(body.stakeM ?? config.defaultStakeM),
        maxMultiplier: Number(body.maxMultiplier ?? config.defaultMaxMultiplier),
        seatCount: body.seatCount === 4 ? 4 : 3,
        laiZi: body.laiZi === true,
        ...(body.hostDisplayName ? { hostDisplayName: body.hostDisplayName } : {}),
        ...(body.title ? { title: body.title } : {}),
      }, cookies.ddz_host)
      json(res, 200, {
        roomId: created.roomId,
        roomCode: created.roomCode,
        sitUrl: created.sitUrl,
        watchUrl: created.watchUrl,
        seatCapAtoms: created.seatCapAtoms,
        shareable: created.shareable,
        hostPlayerId: created.hostPlayerId,
        view: created.view,
        wsTicket: manager.issueTicket(created.hostPlayerId, created.roomId),
      }, [
        cookieHeader('ddz_host', created.hostCookie, { secure, sameSite: 'Strict' }),
        cookieHeader('ddz_seat', created.hostCookie, { secure, sameSite: 'Lax' }),
      ])
    } catch (error) {
      if (error instanceof Error && error.name === 'welcome-below-seatcap') {
        throw Object.assign(error, { status: 409, code: 'insufficient' })
      }
      throw error
    }
    return
  }

  if (req.method === 'GET' && path === '/api/preview') {
    const loopback = isLoopbackHost(header(req, 'host'), req.socket.remoteAddress)
    const preview = await manager.peek({
      roomCode: String(url.searchParams.get('code') ?? ''),
      invite: String(url.searchParams.get('invite') ?? ''),
      local: loopback,
    })
    json(res, 200, preview)
    return
  }

  if (req.method === 'GET' && path === '/api/health') {
    if (!manager.isHostCookie(cookies.ddz_host)) throw Object.assign(new Error('host only'), { status: 403, code: 'auth' })
    json(res, 200, manager.health())
    return
  }

  if (req.method === 'GET' && path === '/api/me/ledger') {
    const session = manager.sessionByCookie(cookies.ddz_seat)
    if (!session) throw Object.assign(new Error('not joined'), { status: 403, code: 'auth' })
    json(res, 200, manager.ledgerFor(session.playerId))
    return
  }

  const roomMatch = /^\/api\/rooms\/([^/]+)(?:\/(since|command))?$/.exec(path)
  if (!roomMatch) {
    send(res, 404, encodeJson({ error: 'expired', message: 'not found' }), {
      'content-type': 'application/json',
    })
    return
  }
  const roomId = roomMatch[1]!
  const tail = roomMatch[2]
  const session = manager.sessionByCookie(cookies.ddz_seat)
  if (!session || session.roomId !== roomId) {
    throw Object.assign(new Error('not in this room'), { status: 403, code: 'auth' })
  }

  if (req.method === 'GET' && !tail) {
    json(res, 200, manager.view(session.roomId, session.playerId))
    return
  }
  if (req.method === 'GET' && tail === 'since') {
    manager.markConnected(session.playerId, session.roomId, true)
    const seq = Number(url.searchParams.get('seq') ?? '0')
    json(res, 200, manager.eventsSince(session.roomId, session.playerId, Number.isFinite(seq) ? seq : 0))
    return
  }
  if (req.method === 'POST' && tail === 'command') {
    assertOrigin(req, config.publicBaseUrl)
    assertMutatingHeaders(req)
    const command = await readJson<ClientCommand>(req)
    try {
      manager.markConnected(session.playerId, session.roomId, command.type === 'ping')
      const result = await manager.command(session.roomId, session.playerId, command, manager.isHostCookie(cookies.ddz_host))
      json(res, 200, result)
    } catch (error) {
      const code = (error as { code?: RejectCode }).code ?? 'illegal'
      send(res, 409, encodeJson({ error: code, message: error instanceof Error ? error.message : 'conflict' }), {
        'content-type': 'application/json',
      })
    }
    return
  }
  send(res, 404, '')
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  let size = 0
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buf.length
      if (size > 64 * 1024) {
        reject(Object.assign(new Error('payload too large'), { status: 400, code: 'illegal' }))
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => { resolve() })
    req.on('error', reject)
  })
  if (chunks.length === 0) return {} as T
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
  } catch {
    throw Object.assign(new Error('invalid json'), { status: 400, code: 'illegal' })
  }
}

function json(res: ServerResponse, status: number, body: unknown, cookies?: string[]): void {
  const headers: Record<string, string | string[]> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  }
  if (cookies && cookies.length > 0) headers['set-cookie'] = cookies
  send(res, status, encodeJson(body), headers)
}

function html(res: ServerResponse, body: string): void {
  send(res, 200, body, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
}

function send(
  res: ServerResponse,
  status: number,
  body: string | Buffer,
  headers: Record<string, string | string[]> = {},
): void {
  if (res.headersSent) return
  res.writeHead(status, headers)
  res.end(body)
}

function writeError(res: ServerResponse, error: unknown): void {
  const status = (error as { status?: number }).status
    ?? ((error as { code?: string }).code === 'auth' ? 403 : 400)
  const code = (error as { code?: string }).code ?? 'illegal'
  if (error instanceof Error && error.message === 'welcome-below-seatcap') {
    send(res, 409, encodeJson({ error: 'insufficient', message: 'welcome-below-seatcap' }), {
      'content-type': 'application/json',
    })
    return
  }
  const coded = error as { code?: RejectCode }
  if (error instanceof Error && coded.code) {
    send(res, statusFrom(coded), encodeJson({ error: coded.code, message: error.message }), {
      'content-type': 'application/json',
    })
    return
  }
  void fail
  send(res, status, encodeJson({ error: code, message: error instanceof Error ? error.message : 'error' }), {
    'content-type': 'application/json',
  })
}

function statusFrom(error: { code?: RejectCode }): number {
  if (error.code === 'auth') return 403
  if (error.code === 'expired') return 404
  if (error.code === 'room-full' || error.code === 'insufficient' || error.code === 'phase' || error.code === 'duplicate-nonce') return 409
  return 400
}
