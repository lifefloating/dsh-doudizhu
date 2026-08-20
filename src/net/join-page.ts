import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const assetCache = new Map<string, { body: Buffer; type: string } | null>()

export function joinPageHtml(): string {
  const candidates = [
    join(here, 'join/index.html'),
    join(here, '../join/index.html'),
    join(process.cwd(), 'lib/join/index.html'),
    join(process.cwd(), 'src/join/join.html'),
  ]
  for (const path of candidates) {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      // try next
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>斗地主</title></head><body><p>加入页尚未构建。请运行 pnpm build。</p></body></html>`
}

export function assetCacheControl(name: string): string {
  return typeOf(name).startsWith('image/') ? IMAGE_CACHE_CONTROL : 'no-store'
}

export function joinAsset(name: string): { body: Buffer; type: string } | null {
  const safe = safeAssetName(name)
  if (!safe) return null
  if (assetCache.has(safe)) return assetCache.get(safe) ?? null
  const candidates = [
    join(here, 'join', safe),
    join(here, '../join', safe),
    join(process.cwd(), 'lib/join', safe),
    join(process.cwd(), 'src/client/assets', safe),
  ]
  for (const path of candidates) {
    try {
      const result = { body: readFileSync(path), type: typeOf(safe) }
      assetCache.set(safe, result)
      return result
    } catch {
      // try next
    }
  }
  assetCache.set(safe, null)
  return null
}

function safeAssetName(name: string): string | null {
  if (!name || name !== basename(name) || name === '.' || name === '..') return null
  return name
}

function typeOf(name: string): string {
  if (name.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (name.endsWith('.css')) return 'text/css; charset=utf-8'
  if (name.endsWith('.svg')) return 'image/svg+xml'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.map')) return 'application/json'
  return 'application/octet-stream'
}
