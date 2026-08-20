import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PluginConfig } from '../config.ts'
import { doudizhuTabHash, parseDoudizhuHash } from './hash.ts'
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
  const [mount, setMount] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let host: HTMLElement | null = null
    const place = (): void => {
      const after = findNewSessionAnchor()
      if (!after) return
      if (!host) {
        host = document.createElement('div')
        host.dataset.doudizhuEntry = ''
      }
      if (host.previousElementSibling !== after || !host.isConnected) {
        after.insertAdjacentElement('afterend', host)
      }
      setMount((prev) => (prev === host ? prev : host))
    }
    place()
    const observer = new MutationObserver(place)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      host?.remove()
    }
  }, [])

  useEffect(() => {
    if (!mount) return
    const slot = css.sidebarSlot ?? ''
    const rail = css.sidebarSlotRail ?? ''
    mount.className = wide ? slot : `${slot} ${rail}`
  }, [mount, wide])

  if (!mount) return null
  return createPortal(
    <DouDizhuSidebarControl wide={wide === true} />,
    mount,
  )
}

function DouDizhuSidebarControl({ wide }: { wide: boolean }) {
  const [open, setOpen] = useState(() => parseDoudizhuHash(location.hash).open)
  useHashOpen(setOpen)
  return (
    <button
      type="button"
      className={`${css.sidebarBtn} ${wide ? '' : css.sidebarBtnRail} ${open ? css.sidebarBtnActive : ''}`}
      aria-current={open ? 'page' : undefined}
      onClick={() => {
        if (!parseDoudizhuHash(location.hash).open) location.hash = doudizhuTabHash()
      }}
    >
      <span>{wide ? 'dsh-poker' : 'dsh'}</span>
    </button>
  )
}

function findNewSessionAnchor(): HTMLElement | null {
  const labeled = document.querySelectorAll<HTMLButtonElement>(
    'button[aria-label="New session"], button[aria-label="新建会话"]',
  )
  const button = labeled[labeled.length - 1]
    ?? [...document.querySelectorAll('button')].find((el) => {
      const text = el.textContent?.replace(/\s+/g, ' ').trim()
      return text === 'New Session' || text === '新会话'
    })
    ?? null
  if (!button) return null
  let node: HTMLElement = button
  let parent = node.parentElement
  while (parent) {
    const style = getComputedStyle(parent)
    if (style.display === 'flex' && style.flexDirection === 'column') return node
    node = parent
    parent = node.parentElement
  }
  return button
}

function DouDizhuOverlay() {
  const [open, setOpen] = useState(() => parseDoudizhuHash(location.hash).open)
  const inset = useCenterColumnInset(open)
  useHashOpen(setOpen)
  if (!open) return null
  return (
    <div className={css.tabShell} style={{ left: inset.left, right: inset.right }} data-doudizhu-tab="">
      <HostApp onClose={() => { location.hash = '#/' }} />
    </div>
  )
}

function useHashOpen(setOpen: (open: boolean) => void): void {
  useEffect(() => {
    const sync = (): void => { setOpen(parseDoudizhuHash(location.hash).open) }
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('hashchange', sync) }
  }, [setOpen])
}

/** Keep the game in the DSH center column so the sidebar stays the 斗地主 tab chrome. */
function useCenterColumnInset(active: boolean): { left: number; right: number } {
  const [inset, setInset] = useState({ left: 0, right: 0 })
  useLayoutEffect(() => {
    if (!active) return
    const overlay = document.querySelector('[data-shell-overlay]')
    const frame = overlay?.parentElement
    const sidebar = frame?.firstElementChild
    const details = overlay?.previousElementSibling
    if (!(sidebar instanceof HTMLElement)) return
    const update = (): void => {
      setInset({
        left: sidebar.getBoundingClientRect().width,
        right: details instanceof HTMLElement ? details.getBoundingClientRect().width : 0,
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(sidebar)
    if (details instanceof HTMLElement) observer.observe(details)
    return () => { observer.disconnect() }
  }, [active])
  return inset
}
