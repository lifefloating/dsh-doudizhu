import { useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PluginConfig } from '../config.ts'
import { HostApp } from './HostApp.tsx'
import { SettingsCard } from './SettingsCard.tsx'
import css from './styles.module.css'

export function registerClientSlots(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'doudizhu',
  }, DouDizhuSidebarButton))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'doudizhu',
  }, DouDizhuOverlay))

  ctx.slots.inject('settings.plugin.item', () => {
    const scope = ctx.settingsScope.bind<PluginConfig>({ namespace: 'doudizhu' })
    return ctx.slots.register({
      name: 'settings.plugin.item',
      key: 'doudizhu',
    }, function DouDizhuSettingsCard() {
      return <SettingsCard scope={scope} />
    })
  })
}

function DouDizhuSidebarButton({ wide }: { wide?: boolean }) {
  return (
    <button
      type="button"
      className={css.sidebarBtn}
      onClick={() => { location.hash = '#/doudizhu' }}
    >
      <span>斗地主</span>
      {wide ? <span className={css.muted}>dsh-doudizhu</span> : null}
    </button>
  )
}

function DouDizhuOverlay() {
  const [open, setOpen] = useState(() => location.hash.startsWith('#/doudizhu'))
  useHashOpen(setOpen)
  if (!open) return null
  return <HostApp onClose={() => { location.hash = '#/' }} />
}

function useHashOpen(setOpen: (open: boolean) => void): void {
  useEffect(() => {
    const sync = (): void => { setOpen(location.hash.startsWith('#/doudizhu')) }
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('hashchange', sync) }
  }, [setOpen])
}
