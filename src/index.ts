import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { Config, resolveConfig, type PluginConfig } from './config.ts'
import { registerDouDizhuHttp } from './net/routes.ts'
import { registerDouDizhuSocket } from './net/ws.ts'
import { RoomManager } from './room/RoomManager.ts'

export const name = 'doudizhu'
export const inject = ['webServer', 'settings']
export { Config }
export const DOUDIZHU_NS = settingsNamespace('doudizhu')

export function apply(ctx: Context, config: PluginConfig): void {
  const storage = ctx.get('storageDomain')
  const manager = new RoomManager(ctx, config, storage)
  manager.listenPort = () => ctx.webServer.port
  ctx.effect(() => {
    const stop = [
      ...registerDouDizhuHttp(ctx.webServer, manager),
      registerDouDizhuSocket(ctx.webServer, manager),
    ]
    return () => {
      for (const dispose of stop) dispose()
      void manager.dispose()
    }
  })
  installSettingsSection(ctx, DOUDIZHU_NS, Config, config, {
    setSource: (current) => { manager.replaceConfig(current()) },
    onChange: () => { /* live defaults only; in-hand state stays frozen */ },
    validate: (value) => { resolveConfig(value) },
  })
  ctx.inject(['systemPrompt'], (promptCtx) => {
    promptCtx.systemPrompt?.section({
      name: 'plugin:doudizhu',
      order: 200,
      text: '本机已安装 dsh-doudizhu。开房走侧栏「斗地主」，支持 3 人/4 人、经典/癞子。结算是 Host 欢迎积分账本，不是 DeepSeek 平台余额。',
    })
  })
}
