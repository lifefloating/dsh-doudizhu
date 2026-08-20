import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('DSH 插件清单', () => {
  it('导出 Host、Client、加入页和 bundle patch', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      name: string
      version: string
      private?: boolean
      author: string
      exports: Record<string, unknown>
      files: string[]
      repository: { url: string }
      publishConfig: { access: string; registry: string }
      scripts: Record<string, string>
      license: string
      peerDependencies: Record<string, string>
      peerDependenciesMeta: Record<string, { optional?: boolean }>
      dsh: { bundle: { patch: string }; client: { inject: string[]; platform: string } }
    }

    expect(packageJson.name).toBe('dsh-poker')
    expect(packageJson.private).toBeUndefined()
    expect(packageJson.author).toBe('lifefloating')
    expect(packageJson.publishConfig).toEqual({
      access: 'public',
      registry: 'https://registry.npmjs.org/',
    })
    expect(packageJson.exports).toHaveProperty('.')
    expect(packageJson.exports).toHaveProperty('./client')
    expect(packageJson.exports).toHaveProperty('./invariant')
    expect(packageJson.files).toContain('lib')
    expect(packageJson.files).toContain('cordis.patch.yml')
    expect(packageJson.files).toContain('README.md')
    expect(packageJson.files).toContain('CHANGELOG.md')
    expect(packageJson.files).toContain('LICENSE')
    expect(packageJson.files).toContain('prepare.mjs')
    expect(packageJson.files).not.toContain('src/client/assets/**')
    expect(packageJson.repository.url).toBe('git+https://github.com/lifefloating/dsh-doudizhu.git')
    expect(packageJson.scripts.verify).toContain('pnpm typecheck')
    expect(packageJson.scripts.prepack).toBe('pnpm run build')
    expect(packageJson.scripts['release:check']).toContain('scripts/check-package.mjs')
    expect(packageJson.license).toBe('MIT')
    expect(packageJson.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(packageJson.dsh.client.platform).toBe('web')
    const peers = Object.keys(packageJson.peerDependencies ?? {})
    expect(peers).toContain('@deepseek-ai/cordis')
    for (const name of peers) {
      expect(packageJson.peerDependenciesMeta?.[name]).toEqual({ optional: true })
    }
    const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
    const escapedVersion = packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    expect(changelog).toMatch(new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'))
  })

  it('不依赖本机 DSH checkout 就能安装开发依赖', async () => {
    const packageJson = await readFile(new URL('../package.json', import.meta.url), 'utf8')
    expect(packageJson).not.toContain('link:../')
    expect(packageJson).not.toContain('file:/Users/')
  })

  it('bundle patch 使用 DSH 所需的 insert 数组格式', async () => {
    const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    expect(patch).toMatch(/- insert:\n\s+- id: dsh-poker\n\s+name: dsh-poker/)
  })
})
