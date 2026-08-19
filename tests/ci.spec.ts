import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('CI', () => {
  it('runs release:check on main and pull requests without publishing npm', () => {
    const workflow = readFileSync(
      join(process.cwd(), '.github/workflows/ci.yml'),
      'utf8',
    )
    expect(workflow).toContain('pnpm install --frozen-lockfile')
    expect(workflow).toContain('pnpm release:check')
    expect(workflow).toContain('git diff --exit-code')
    expect(workflow).toContain('pull_request')
    expect(workflow).not.toContain('npm publish')
    expect(workflow).not.toContain('id-token: write')
  })
})
