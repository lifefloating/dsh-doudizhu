import { cp, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const emitDir = join(root, 'lib/types-emit')
const typesDir = join(root, 'lib/types')

const tsc = spawnSync('tsc', ['-p', 'tsconfig.dts.json'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (tsc.status !== 0) process.exit(tsc.status ?? 1)

await rm(typesDir, { force: true, recursive: true })
await cp(join(emitDir, 'src'), typesDir, { recursive: true })
await rm(emitDir, { force: true, recursive: true })
