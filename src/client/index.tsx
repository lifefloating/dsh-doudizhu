import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: settingsScope + settings.plugin.item. Value-importing ui-settings
// fails the client bundle-purity gate.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { registerClientSlots } from './slots.tsx'

export const name = 'doudizhu-client'
// settingsScope.bind() reads connection + remote from the caller fiber.
export const inject = ['slots', 'connection', 'remote', 'settingsScope']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    registerClientSlots(ctx)
    return () => { /* slot injects dispose with fiber */ }
  })
}
