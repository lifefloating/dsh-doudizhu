import type { IncomingMessage } from '@deepseek-ai/cordis'

export function isLoopbackHost(hostHeader: string | undefined, remoteAddress: string | undefined): boolean {
  const host = (hostHeader ?? '').split(':')[0]?.replace(/^\[|\]$/g, '').toLowerCase()
  const remote = (remoteAddress ?? '').replace(/^::ffff:/, '')
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1'])
  const loopbackRemotes = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
  return loopbackHosts.has(host ?? '') || loopbackRemotes.has(remote)
}

export function requestOrigin(req: IncomingMessage): string | null {
  const origin = header(req, 'origin')
  if (origin) {
    try { return new URL(origin).origin } catch { return null }
  }
  const referer = header(req, 'referer')
  if (referer) {
    try { return new URL(referer).origin } catch { return null }
  }
  return null
}

export function originAllowed(origin: string | null, publicBaseUrl: string, browser: boolean): boolean {
  if (!origin) return !browser
  if (isLoopbackOrigin(origin)) return true
  if (publicBaseUrl && origin === publicBaseUrl) return true
  return false
}

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1' || url.hostname === '[::1]'
  } catch {
    return false
  }
}

export function isBrowserRequest(req: IncomingMessage): boolean {
  return Boolean(header(req, 'origin') || header(req, 'sec-fetch-site'))
}

export function assertOrigin(req: IncomingMessage, publicBaseUrl: string): void {
  if (header(req, 'sec-fetch-site') === 'cross-site') {
    throw Object.assign(new Error('cross-site forbidden'), { status: 403, code: 'auth' })
  }
  if (!originAllowed(requestOrigin(req), publicBaseUrl, isBrowserRequest(req))) {
    throw Object.assign(new Error('origin not allowed'), { status: 403, code: 'auth' })
  }
}

export function assertMutatingHeaders(req: IncomingMessage): void {
  const requested = header(req, 'x-requested-with')
  const contentType = header(req, 'content-type') ?? ''
  if (requested === 'doudizhu') return
  if (contentType.includes('application/json')) return
  throw Object.assign(new Error('missing csrf header'), { status: 403, code: 'auth' })
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const raw = header(req, 'cookie') ?? ''
  const out: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

export function cookieHeader(
  name: string,
  value: string,
  opts: { secure: boolean; sameSite: 'Lax' | 'Strict'; maxAge?: number },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/doudizhu',
    'HttpOnly',
    `SameSite=${opts.sameSite}`,
    `Max-Age=${opts.maxAge ?? 86400}`,
  ]
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

export function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}
