import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

await rm(join(root, 'lib'), { force: true, recursive: true })

const shimDir = join(root, 'types/shims')
for (const name of await readdir(shimDir)) {
  if (name.endsWith('.d.ts') || name.endsWith('.js') || name.endsWith('.map')) {
    await rm(join(shimDir, name), { force: true })
  }
}
