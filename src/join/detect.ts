export interface InviteEnv {
  dsh: boolean
  plugin: boolean
}

type FetchLike = typeof fetch

/** True when this origin serves the DeepSeek Harness web SPA. */
export function htmlLooksLikeDsh(html: string): boolean {
  return html.includes('__DSH_BOOT__') || html.includes('__ModuleLoader__')
}

/** The invite document itself is served by this plugin. */
export function pluginDocumentPresent(pathname: string): boolean {
  return pathname === '/doudizhu' || pathname.startsWith('/doudizhu/')
}

export async function probeDsh(fetchImpl: FetchLike = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl('/', { credentials: 'same-origin', headers: { accept: 'text/html' } })
    if (!response.ok) return false
    return htmlLooksLikeDsh(await response.text())
  } catch {
    return false
  }
}

export async function probePlugin(
  fetchImpl: FetchLike = fetch,
  pathname = typeof location === 'undefined' ? '' : location.pathname,
): Promise<boolean> {
  if (pluginDocumentPresent(pathname)) return true
  try {
    const response = await fetchImpl('/doudizhu/api/ready', { credentials: 'same-origin' })
    if (!response.ok) return false
    const body = await response.json() as { ok?: boolean; plugin?: string }
    return body.ok === true && body.plugin === 'dsh-poker'
  } catch {
    return false
  }
}

export async function probeInviteEnv(
  fetchImpl: FetchLike = fetch,
  pathname = typeof location === 'undefined' ? '' : location.pathname,
): Promise<InviteEnv> {
  const [dsh, plugin] = await Promise.all([probeDsh(fetchImpl), probePlugin(fetchImpl, pathname)])
  return { dsh, plugin }
}
