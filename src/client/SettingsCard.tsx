import { useEffect, useState } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { PluginConfig } from '../config.ts'
import css from './styles.module.css'

interface SettingsDraft {
  publicBaseUrl: string
  welcomeAtoms: string
  defaultSeatCount: 3 | 4
  defaultMaxMultiplier: number
  defaultLaiZi: boolean
  spectatorCardCounter: boolean
}

function draftFrom(value: PluginConfig): SettingsDraft {
  return {
    publicBaseUrl: value.publicBaseUrl ?? '',
    welcomeAtoms: value.welcomeAtoms ?? '200000000',
    defaultSeatCount: value.defaultSeatCount === 4 ? 4 : 3,
    defaultMaxMultiplier: value.defaultMaxMultiplier ?? 8,
    defaultLaiZi: value.defaultLaiZi === true,
    spectatorCardCounter: value.spectatorCardCounter === true,
  }
}

function draftsEqual(left: SettingsDraft, right: SettingsDraft): boolean {
  return left.publicBaseUrl === right.publicBaseUrl
    && left.welcomeAtoms === right.welcomeAtoms
    && left.defaultSeatCount === right.defaultSeatCount
    && left.defaultMaxMultiplier === right.defaultMaxMultiplier
    && left.defaultLaiZi === right.defaultLaiZi
    && left.spectatorCardCounter === right.spectatorCardCounter
}

function validateDraft(draft: SettingsDraft): string | null {
  const publicBaseUrl = draft.publicBaseUrl.trim().replace(/\/+$/, '')
  if (publicBaseUrl !== '') {
    let parsed: URL
    try {
      parsed = new URL(publicBaseUrl)
    } catch {
      return 'publicBaseUrl 必须是绝对 http(s) origin，不要路径或尾斜杠'
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'publicBaseUrl 必须是 http 或 https'
    }
    if (parsed.origin !== publicBaseUrl) {
      return 'publicBaseUrl 必须是 origin，不要路径、查询或尾斜杠'
    }
  }
  if (!/^\d+$/.test(draft.welcomeAtoms)) return '欢迎积分必须是非负整数'
  if (![8, 16, 32, 64].includes(draft.defaultMaxMultiplier)) return '倍数封顶只能是 8、16、32 或 64'
  return null
}

export function SettingsCard({ scope }: { scope: SettingsScope<PluginConfig> }) {
  const [snap, setSnap] = useState(() => scope.getSnapshot())
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SettingsDraft | null>(() => snap.value ? draftFrom(snap.value) : null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => scope.subscribe(() => {
    const next = scope.getSnapshot()
    setSnap((prevSnap) => {
      if (next.value) {
        const incoming = draftFrom(next.value)
        const previousStored = prevSnap.value ? draftFrom(prevSnap.value) : incoming
        setDraft((prev) => {
          if (!prev || draftsEqual(prev, previousStored)) return incoming
          return prev
        })
      }
      return next
    })
  }), [scope])

  useEffect(() => {
    if (draft || !snap.value) return
    setDraft(draftFrom(snap.value))
  }, [draft, snap.value])

  const value = snap.value
  if (!value || !draft) return null
  const stored = draftFrom(value)
  const dirty = !draftsEqual(draft, stored)
  const patch = <K extends keyof SettingsDraft>(field: K, next: SettingsDraft[K]): void => {
    setSaved(false)
    setError(null)
    setDraft((prev) => prev ? { ...prev, [field]: next } : prev)
  }

  const save = async (): Promise<void> => {
    const invalid = validateDraft(draft)
    if (invalid) {
      setError(invalid)
      return
    }
    const next: SettingsDraft = {
      ...draft,
      publicBaseUrl: draft.publicBaseUrl.trim().replace(/\/+$/, ''),
    }
    setDraft(next)
    setSaving(true)
    setError(null)
    try {
      const writes: Array<readonly [keyof SettingsDraft, string | number | boolean]> = [
        ['publicBaseUrl', next.publicBaseUrl],
        ['welcomeAtoms', next.welcomeAtoms],
        ['defaultSeatCount', next.defaultSeatCount],
        ['defaultMaxMultiplier', next.defaultMaxMultiplier],
        ['defaultLaiZi', next.defaultLaiZi],
        ['spectatorCardCounter', next.spectatorCardCounter],
      ]
      for (const [field, fieldValue] of writes) {
        if (stored[field] === fieldValue) continue
        await scope.set(String(field), fieldValue)
      }
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${css.settingsCard} ${open ? css.settingsOpen : ''}`}>
      <button
        type="button"
        className={css.settingsHeader}
        aria-expanded={open}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.settingsHeadText}>
          <span className={css.settingsName}>dsh-doudizhu</span>
          <span className={css.settingsDesc}>本机房间默认：人数、癞子、邀请地址和欢迎积分。同一房间先到入座，后来观战。</span>
        </span>
        <svg
          className={`${css.settingsChevron} ${open ? css.settingsChevronOpen : ''}`}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
        >
          <path d="M3.2 5.1 7 8.9l3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open
        ? (
          <div className={css.settingsBody}>
            <p className={css.settingsHint}>开房在侧栏「斗地主」，这里只改下次开房的默认值。点保存后生效，已经开着的房间不动。</p>
            <label className={css.settingsField}>
              <span className={css.settingsLabel}>对外地址 publicBaseUrl</span>
              <input
                className={css.settingsInput}
                value={draft.publicBaseUrl}
                placeholder="https://your-named-tunnel.example"
                onChange={(event) => { patch('publicBaseUrl', event.target.value) }}
              />
              <p className={css.settingsFieldHint}>填能打到本机的 https origin，好友才能用邀请链接进桌。空着只能本机标签页互打。</p>
            </label>
            <label className={css.settingsField}>
              <span className={css.settingsLabel}>欢迎积分</span>
              <input
                className={css.settingsInput}
                inputMode="numeric"
                value={draft.welcomeAtoms}
                onChange={(event) => { patch('welcomeAtoms', event.target.value) }}
              />
              <p className={css.settingsFieldHint}>进房时账本里的起始积分，不是 DeepSeek 平台余额。默认 200000000（200M）。</p>
            </label>
            <label className={css.settingsField}>
              <span className={css.settingsLabel}>默认人数</span>
              <select
                className={css.settingsInput}
                value={draft.defaultSeatCount}
                onChange={(event) => { patch('defaultSeatCount', Number(event.target.value) === 4 ? 4 : 3) }}
              >
                <option value={3}>3 人</option>
                <option value={4}>4 人</option>
              </select>
              <p className={css.settingsFieldHint}>3 人一副牌 3 张底牌；4 人两副牌 8 张底牌。</p>
            </label>
            <label className={css.settingsField}>
              <span className={css.settingsLabel}>默认倍数封顶</span>
              <input
                className={css.settingsInput}
                inputMode="numeric"
                value={String(draft.defaultMaxMultiplier)}
                onChange={(event) => { patch('defaultMaxMultiplier', Number(event.target.value)) }}
              />
            </label>
            <div className={css.settingsField}>
              <div className={css.settingsSwitchRow}>
                <span className={css.settingsLabel}>默认开癞子</span>
                <button
                  type="button"
                  className={css.settingsSwitch}
                  role="switch"
                  aria-checked={draft.defaultLaiZi}
                  onClick={() => { patch('defaultLaiZi', !draft.defaultLaiZi) }}
                >
                  <span className={css.settingsSwitchTrack} data-on={draft.defaultLaiZi ? '' : undefined}>
                    <span className={css.settingsSwitchThumb} />
                  </span>
                </button>
              </div>
              <p className={css.settingsFieldHint}>下次开房默认癞子。翻两张万能牌，大小王不当癞子。</p>
            </div>
            <div className={css.settingsField}>
              <div className={css.settingsSwitchRow}>
                <span className={css.settingsLabel}>旁观记牌器</span>
                <button
                  type="button"
                  className={css.settingsSwitch}
                  role="switch"
                  aria-checked={draft.spectatorCardCounter}
                  onClick={() => { patch('spectatorCardCounter', !draft.spectatorCardCounter) }}
                >
                  <span className={css.settingsSwitchTrack} data-on={draft.spectatorCardCounter ? '' : undefined}>
                    <span className={css.settingsSwitchThumb} />
                  </span>
                </button>
              </div>
              <p className={css.settingsFieldHint}>观战可见剩余牌张。默认关。</p>
            </div>
            <div className={css.settingsActions}>
              <button
                type="button"
                className={css.primary}
                disabled={saving || !dirty || snap.writable === false}
                onClick={() => { void save() }}
              >
                {saving ? '保存中…' : 'Save'}
              </button>
              <button
                type="button"
                className={css.ghost}
                disabled={saving || !dirty}
                onClick={() => {
                  setDraft(stored)
                  setSaved(false)
                  setError(null)
                }}
              >
                Discard
              </button>
              {error
                ? <p className={css.settingsSaveError}>{error}</p>
                : saved && !dirty
                  ? <p className={css.settingsSaveOk}>已保存，下次开房生效</p>
                  : dirty
                    ? <p className={css.settingsFieldHint}>有未保存的更改</p>
                    : null}
            </div>
            {snap.status === 'unavailable'
              ? <p className={css.settingsHint}>没挂 storageDomain 时房间只在内存里，重启就没了。</p>
              : null}
          </div>
        )
        : null}
    </div>
  )
}
