import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

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

export function joinAsset(name: string): { body: Buffer; type: string } | null {
  const candidates = [
    join(here, 'join', name),
    join(here, '../join', name),
    join(process.cwd(), 'lib/join', name),
    join(process.cwd(), 'src/client/assets', name),
  ]
  for (const path of candidates) {
    try {
      const body = readFileSync(path)
      return { body, type: typeOf(name) }
    } catch {
      // try next
    }
  }
  return null
}

function typeOf(name: string): string {
  if (name.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (name.endsWith('.css')) return 'text/css; charset=utf-8'
  if (name.endsWith('.svg')) return 'image/svg+xml'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.map')) return 'application/json'
  return 'application/octet-stream'
}
