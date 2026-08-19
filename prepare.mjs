import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
if (!existsSync(join(root, 'src/index.ts')) || !existsSync(join(root, 'tsdown.config.ts'))) {
  process.exit(0)
}

const result = spawnSync('pnpm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(result.status ?? 1)
