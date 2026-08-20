import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DSH_HOME, PLUGIN_INSTALL_CMD, PLUGIN_REPO } from '../../src/client/links.ts'
import { htmlLooksLikeDsh, pluginDocumentPresent, probeInviteEnv } from '../../src/join/detect.ts'

describe('invite gate detection', () => {
  it('recognizes the DSH SPA markers', () => {
    expect(htmlLooksLikeDsh('<script>window.__DSH_BOOT__={}</script>')).toBe(true)
    expect(htmlLooksLikeDsh('window.__ModuleLoader__.load')).toBe(true)
    expect(htmlLooksLikeDsh('<p>加入斗地主</p>')).toBe(false)
  })

  it('reports missing DSH and plugin separately', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url === '/') return new Response('<html>not dsh</html>', { status: 200 })
      if (url === '/doudizhu/api/ready') return new Response('not found', { status: 404 })
      return new Response('', { status: 500 })
    }
    await expect(probeInviteEnv(fetchImpl)).resolves.toEqual({ dsh: false, plugin: false })
  })

  it('treats the invite document as proof the plugin is installed', () => {
    expect(pluginDocumentPresent('/doudizhu/join')).toBe(true)
    expect(pluginDocumentPresent('/doudizhu')).toBe(true)
    expect(pluginDocumentPresent('/')).toBe(false)
  })

  it('can see DSH without the plugin', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url === '/') return new Response('<script>window.__DSH_BOOT__=1</script>', { status: 200 })
      if (url === '/doudizhu/api/ready') return new Response('{}', { status: 404 })
      return new Response('', { status: 500 })
    }
    await expect(probeInviteEnv(fetchImpl, '/')).resolves.toEqual({ dsh: true, plugin: false })
    await expect(probeInviteEnv(fetchImpl, '/doudizhu/join')).resolves.toEqual({ dsh: true, plugin: true })
  })

  it('reports both ready when SPA and plugin probe succeed', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url === '/') return new Response('<script>window.__DSH_BOOT__=1</script>', { status: 200 })
      if (url === '/doudizhu/api/ready') {
        return new Response(JSON.stringify({ ok: true, plugin: 'dsh-poker' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('', { status: 500 })
    }
    await expect(probeInviteEnv(fetchImpl)).resolves.toEqual({ dsh: true, plugin: true })
  })
})

describe('invite gate copy', () => {
  it('points at the official DSH site and this plugin repo', () => {
    expect(DSH_HOME).toBe('https://www.deepseek.com/harness')
    expect(PLUGIN_REPO).toBe('https://github.com/lifefloating/dsh-doudizhu')
    expect(PLUGIN_INSTALL_CMD).toBe('dsh plugin --profile web add dsh-poker')
    const gate = readFileSync(join(process.cwd(), 'src/join/GateApp.tsx'), 'utf8')
    expect(gate).toContain('DSH_HOME')
    expect(gate).toContain('PLUGIN_REPO')
    expect(gate).toContain('PLUGIN_INSTALL_CMD')
    expect(gate).toContain('onClick={enterTab}')
    expect(gate).toContain('加入房间需安装 DeepSeek Harness 和本插件。')
    expect(gate).toContain('已就绪，请点击进入。')
    expect(gate).not.toContain('来玩')
    expect(gate).not.toContain('不会单独开游戏页')
    expect(gate).not.toContain('window.setTimeout')
    expect(gate).not.toMatch(/if \(env\.dsh && env\.plugin\)/)
    const html = readFileSync(join(process.cwd(), 'src/join/join.html'), 'utf8')
    expect(html).toContain(DSH_HOME)
    expect(html).toContain(PLUGIN_REPO)
    expect(html).not.toContain('JoinApp')
    const main = readFileSync(join(process.cwd(), 'src/join/main.tsx'), 'utf8')
    expect(main).toContain('GateApp')
    expect(main).not.toContain('JoinApp')
  })
})
