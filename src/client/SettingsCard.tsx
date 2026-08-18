import { useEffect, useState } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { PluginConfig } from '../config.ts'
import css from './styles.module.css'

export function SettingsCard({ scope }: { scope: SettingsScope<PluginConfig> }) {
  const [snap, setSnap] = useState(() => scope.getSnapshot())
  const [open, setOpen] = useState(false)
  useEffect(() => scope.subscribe(() => { setSnap(scope.getSnapshot()) }), [scope])
  const value = snap.value
  if (!value) return null
  const set = (field: keyof PluginConfig, next: string | boolean | number): void => {
    void scope.set(String(field), next)
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
            <p className={css.settingsHint}>开房在侧栏「斗地主」，这里只改默认值。改完马上生效，已经开着的房间不动。</p>
            <label className={css.settingsField}>
              <span className={css.settingsLabel}>对外地址 publicBaseUrl</span>
              <input
                className={css.settingsInput}
                value={value.publicBaseUrl ?? ''}
                placeholder="https://your-named-tunnel.example"
                onChange={(event) => { set('publicBaseUrl', event.target.value) }}
              />
              <p className={css.settingsFieldHint}>填能打到本机的 https origin，好友才能用邀请链接进桌。空着只能本机标签页互打。</p>
            </label>
            <label className={css.settingsField}>
              <span className={css.settingsLabel}>欢迎积分</span>
              <input
                className={css.settingsInput}
                inputMode="numeric"
                value={value.welcomeAtoms ?? '200000000'}
                onChange={(event) => { set('welcomeAtoms', event.target.value) }}
              />
              <p className={css.settingsFieldHint}>进房时账本里的起始积分，不是 DeepSeek 平台余额。默认 200000000（200M）。</p>
            </label>
            <label className={css.settingsField}>
              <span className={css.settingsLabel}>默认人数</span>
              <select
                className={css.settingsInput}
                value={value.defaultSeatCount === 4 ? 4 : 3}
                onChange={(event) => { set('defaultSeatCount', Number(event.target.value)) }}
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
                value={String(value.defaultMaxMultiplier ?? 8)}
                onChange={(event) => { set('defaultMaxMultiplier', Number(event.target.value)) }}
              />
            </label>
            <div className={css.settingsField}>
              <div className={css.settingsSwitchRow}>
                <span className={css.settingsLabel}>默认开癞子</span>
                <button
                  type="button"
                  className={css.settingsSwitch}
                  role="switch"
                  aria-checked={value.defaultLaiZi === true}
                  onClick={() => { set('defaultLaiZi', value.defaultLaiZi !== true) }}
                >
                  <span className={css.settingsSwitchTrack} data-on={value.defaultLaiZi === true ? '' : undefined}>
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
                  aria-checked={value.spectatorCardCounter === true}
                  onClick={() => { set('spectatorCardCounter', value.spectatorCardCounter !== true) }}
                >
                  <span className={css.settingsSwitchTrack} data-on={value.spectatorCardCounter === true ? '' : undefined}>
                    <span className={css.settingsSwitchThumb} />
                  </span>
                </button>
              </div>
              <p className={css.settingsFieldHint}>观战可见剩余牌张。默认关。</p>
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
