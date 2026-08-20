import { useEffect, useState } from 'react'
import { doudizhuSpaPath } from '../client/hash.ts'
import { DSH_HOME, PLUGIN_INSTALL_CMD, PLUGIN_REPO } from '../client/links.ts'
import { ROLE_ICONS } from '../client/SeatAvatar.tsx'
import { SeatTags } from '../client/SeatTags.tsx'
import css from '../client/styles.module.css'
import { probeInviteEnv, type InviteEnv } from './detect.ts'

type Probe = 'loading' | InviteEnv

export function GateApp() {
  const params = new URLSearchParams(location.search)
  const code = params.get('code') ?? ''
  const invite = params.get('invite') ?? ''
  const role = params.get('role') === 'watch' ? 'watch' as const : 'sit' as const
  const [probe, setProbe] = useState<Probe>('loading')
  const [entering, setEntering] = useState(false)

  const enterTab = (): void => {
    if (entering) return
    setEntering(true)
    location.replace(doudizhuSpaPath({ code, invite, role }))
  }

  useEffect(() => {
    let cancelled = false
    void probeInviteEnv().then((env) => {
      if (!cancelled) setProbe(env)
    })
    return () => { cancelled = true }
  }, [])

  const dshOk = probe !== 'loading' && probe.dsh
  const pluginOk = probe !== 'loading' && probe.plugin
  const ready = dshOk && pluginOk
  const dshStatus = probe === 'loading' ? 'pending' : dshOk ? 'ok' : 'missing'
  const pluginStatus = probe === 'loading' ? 'pending' : pluginOk ? 'ok' : 'missing'

  return (
    <div className={css.gate}>
      <div className={css.lobby}>
        <div className={css.card}>
          <div className={css.roleHero}>
            <figure className={css.roleHeroItem}>
              <img className={css.roleHeroImg} src={ROLE_ICONS.landlord} alt="" />
              <figcaption><SeatTags role="landlord" /></figcaption>
            </figure>
            <figure className={css.roleHeroItem}>
              <img className={css.roleHeroImg} src={ROLE_ICONS.farmer} alt="" />
              <figcaption><SeatTags role="farmer" /></figcaption>
            </figure>
            <figure className={css.roleHeroItem}>
              <img className={css.roleHeroImg} src={ROLE_ICONS.farmerB} alt="" />
              <figcaption><SeatTags role="farmer" /></figcaption>
            </figure>
          </div>
          <h2>加入斗地主</h2>
          <p className={css.hint}>加入房间需安装 DeepSeek Harness 和本插件。</p>
          {code ? (
            <p className={css.hint}>
              房号 <code className={css.codeValue}>{code}</code>
            </p>
          ) : null}
          <ul className={css.reqList}>
            <li className={css.reqItem} data-status={dshStatus}>
              <div className={css.reqTitle}>1. DeepSeek Harness（dsh）</div>
              <p className={css.reqMeta}>
                {dshStatus === 'ok'
                  ? '已检测到本机 / 当前站点的 DSH。'
                  : dshStatus === 'missing'
                    ? '没有检测到 DSH。先安装并运行 `dsh web`，再用同一套 Harness 打开邀请。'
                    : '正在检测是否已安装 DSH…'}
              </p>
              <p className={css.reqMeta}>
                安装：
                <a href={DSH_HOME} target="_blank" rel="noreferrer">{DSH_HOME}</a>
              </p>
            </li>
            <li className={css.reqItem} data-status={pluginStatus}>
              <div className={css.reqTitle}>2. dsh-poker 斗地主插件</div>
              <p className={css.reqMeta}>
                {pluginStatus === 'ok'
                  ? '已检测到本插件。'
                  : pluginStatus === 'missing'
                    ? '当前 DSH 还没有装这个插件。装完后重启 `dsh web`。'
                    : '正在检测是否已安装插件…'}
              </p>
              <p className={css.reqMeta}>
                仓库：
                <a href={PLUGIN_REPO} target="_blank" rel="noreferrer">{PLUGIN_REPO}</a>
              </p>
              <div className={css.installCmd}>
                <code>{PLUGIN_INSTALL_CMD}</code>
                <button
                  type="button"
                  className={css.ghost}
                  onClick={() => { void navigator.clipboard.writeText(PLUGIN_INSTALL_CMD) }}
                >
                  复制命令
                </button>
              </div>
            </li>
          </ul>
          {ready
            ? <p className={css.hint}>{entering ? '已就绪，正在进入…' : '已就绪，请点击进入。'}</p>
            : probe !== 'loading' && !dshOk
              ? <p className={css.error}>请先安装 DeepSeek Harness。</p>
              : probe !== 'loading' && !pluginOk
                ? <p className={css.error}>请先安装 dsh-poker 插件，装完后重启 `dsh web`。</p>
                : null}
          <button type="button" className={css.primary} onClick={enterTab} disabled={probe === 'loading' || entering}>
            {entering ? '正在进入…' : ready ? '进入' : '我已完成安装'}
          </button>
        </div>
      </div>
    </div>
  )
}
