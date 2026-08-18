import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('client factory bundle', () => {
  it('declares required cordis injects before touching ctx.settingsScope', () => {
    const source = readFileSync(join(process.cwd(), 'src/client/index.tsx'), 'utf8')
    expect(source).toMatch(/export const inject = \[[^\]]*settingsScope/)
    expect(source).toContain("'slots'")
    expect(source).toContain("'connection'")
    expect(source).toContain("'remote'")
  })

  it('lib/client.js calls __ModuleLoader__.load', () => {
    const source = readFileSync(join(process.cwd(), 'lib/client.js'), 'utf8')
    expect(source).toContain('__ModuleLoader__.load')
    expect(source).toContain('id: "dsh-doudizhu"')
    expect(source).toMatch(/const inject = \[[\s\S]*settingsScope/)
  })

  it('list slots register with id, settings card with key', () => {
    const source = readFileSync(join(process.cwd(), 'src/client/slots.tsx'), 'utf8')
    expect(source).toContain("name: 'sidebar.footer.action'")
    expect(source).toContain("id: 'doudizhu'")
    expect(source).not.toMatch(/name: 'sidebar\.footer\.action'[\s\S]{0,80}key:/)
    expect(source).toContain("name: 'shell.overlay'")
    expect(source).toContain("name: 'settings.plugin.item'")
    expect(source).toContain("key: 'doudizhu'")
    expect(source).toContain('ctx.settingsScope.bind')
    expect(source).not.toContain('settingsScope?')
  })
})
