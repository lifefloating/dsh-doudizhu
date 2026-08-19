import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('CI', () => {
  it('runs verify on main and pull requests without publishing npm', () => {
    const workflow = readFileSync(
      join(process.cwd(), '.github/workflows/ci.yml'),
      'utf8',
    )
    expect(workflow).toContain('pnpm install --frozen-lockfile')
    expect(workflow).toContain('pnpm verify')
    expect(workflow).toContain('git diff --exit-code')
    expect(workflow).toContain('pull_request')
    expect(workflow).not.toContain('npm publish')
    expect(workflow).not.toContain('id-token: write')
    expect(workflow).not.toContain('pnpm publish')
  })

  it('publishes from main with pnpm versioning and npm OIDC', () => {
    const workflow = readFileSync(
      join(process.cwd(), '.github/workflows/release.yml'),
      'utf8',
    )
    expect(workflow).toContain('branches: [main]')
    expect(workflow).toContain('id-token: write')
    expect(workflow).toContain('pnpm version -r')
    expect(workflow).toContain('pnpm publish')
    expect(workflow).toContain('--provenance')
    expect(workflow).toContain('pnpm verify')
    expect(workflow).not.toContain('changesets/action')
    expect(workflow).not.toContain('NPM_TOKEN')
    expect(workflow).not.toContain('NODE_AUTH_TOKEN')
  })

  it('uses pnpm 11 native versioning without a publish token', () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as {
      packageManager: string
      repository: { url: string }
      scripts: Record<string, string>
    }
    expect(pkg.packageManager).toBe('pnpm@11.22.0')
    expect(pkg.repository.url).toBe(
      'git+https://github.com/lifefloating/dsh-doudizhu.git',
    )
    expect(pkg.scripts['ci:version']).toContain('pnpm version -r')
    expect(pkg.scripts['ci:publish']).toContain('pnpm publish')
    expect(pkg.scripts['ci:publish']).toContain('--provenance')
    expect(pkg.scripts['ci:publish']).not.toContain('NPM_TOKEN')
  })
})
