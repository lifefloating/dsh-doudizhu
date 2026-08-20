import { DEFAULT_MAX_MULTIPLIER, DEFAULT_STAKE_M, formatM, seatCapAtoms, stakeAtomsFromM, STAKE_LADDER_M } from '../settle/math.ts'
import type { SeatCount } from '../types.ts'
import { InviteDialog } from './InviteDialog.tsx'
import { JoinForm } from './JoinForm.tsx'
import css from './styles.module.css'

const MAX_MULTIPLIER_OPTIONS = [8, 16, 32, 64] as const

export function LobbyView({
  tab, onTab, title, stakeM, maxMultiplier, seatCount, laiZi, onTitle, onStake, onCap, onSeats, onLaiZi, onCreate, creating, error,
  roomCode, sitUrl, watchUrl, shareable, welcomeAtoms, join,
}: {
  tab: 'create' | 'join'
  onTab: (tab: 'create' | 'join') => void
  title: string
  stakeM: number
  maxMultiplier: number
  seatCount: SeatCount
  laiZi: boolean
  onTitle: (value: string) => void
  onStake: (value: number) => void
  onCap: (value: number) => void
  onSeats: (value: SeatCount) => void
  onLaiZi: (value: boolean) => void
  onCreate: () => void
  creating: boolean
  error: string | null
  roomCode: string
  sitUrl: string
  watchUrl: string
  shareable: boolean
  welcomeAtoms: bigint
  join: {
    code: string
    invite: string
    name: string
    joining: boolean
    onCode: (value: string) => void
    onInvite: (value: string) => void
    onName: (value: string) => void
    onJoin: () => void
  }
}) {
  const cap = seatCapAtoms(stakeAtomsFromM(stakeM), maxMultiplier, seatCount)
  const blocked = welcomeAtoms < cap
  return (
    <div className={css.lobby}>
      <div className={css.card}>
        <div className={css.tabs} role="tablist" aria-label="开房或加入">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'create'}
            className={`${css.tab} ${tab === 'create' ? css.tabActive : ''}`}
            onClick={() => { onTab('create') }}
          >
            创建
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'join'}
            className={`${css.tab} ${tab === 'join' ? css.tabActive : ''}`}
            onClick={() => { onTab('join') }}
          >
            加入
          </button>
        </div>
        {tab === 'join'
          ? (
            <>
              <h2>加入房间</h2>
              <p className={css.hint}>别人开的房填房号就能进。积分记在开房那台机器上，不是 DeepSeek 平台余额。</p>
              <JoinForm
                code={join.code}
                invite={join.invite}
                name={join.name}
                onCode={join.onCode}
                onInvite={join.onInvite}
                onName={join.onName}
                onJoin={join.onJoin}
                joining={join.joining}
                showInvite={false}
                error={error}
              />
            </>
          )
          : (
            <>
              <h2>创建房间</h2>
              <p className={css.hint}>好友局信房主这台机器上的账本。积分不是 DeepSeek 平台余额。</p>
              <div className={css.createFields}>
                <label className={`${css.field} ${css.fieldWide}`}>
                  房间名
                  <input
                    className={css.input}
                    value={title}
                    maxLength={24}
                    placeholder="好友局"
                    onChange={(event) => { onTitle(event.target.value) }}
                  />
                </label>
                <label className={css.field}>
                  人数
                  <select className={css.select} value={seatCount} onChange={(event) => { onSeats(Number(event.target.value) === 4 ? 4 : 3) }}>
                    <option value={3}>3 人 · 一副牌</option>
                    <option value={4}>4 人 · 两副牌</option>
                  </select>
                </label>
                <label className={css.field}>
                  玩法
                  <select className={css.select} value={laiZi ? 'laizi' : 'classic'} onChange={(event) => { onLaiZi(event.target.value === 'laizi') }}>
                    <option value="classic">经典</option>
                    <option value="laizi">癞子</option>
                  </select>
                </label>
                <label className={css.field}>
                  底注
                  <select className={css.select} value={stakeM} onChange={(event) => { onStake(Number(event.target.value)) }}>
                    {STAKE_LADDER_M.map((value) => <option key={value} value={value}>{value}M</option>)}
                  </select>
                </label>
                <label className={css.field}>
                  倍数封顶
                  <select className={css.select} value={maxMultiplier} onChange={(event) => { onCap(Number(event.target.value)) }}>
                    {MAX_MULTIPLIER_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
              <p className={css.hint}>
                {seatCount} 人{laiZi ? '癞子' : '经典'}。好友点准备，齐了由房主开打。后来的人观战。出牌 120 秒。入座冻结 {formatM(cap)}，欢迎 {formatM(welcomeAtoms)}。
              </p>
              {blocked ? <p className={css.error}>欢迎积分不够入座冻结，把底注或封顶调低，或者去设置里加欢迎积分。</p> : null}
              <button type="button" className={css.primary} disabled={blocked || creating} onClick={onCreate}>
                {creating ? '创建中…' : '创建房间'}
              </button>
              {error ? <p className={css.error}>{error}</p> : null}
              {roomCode
                ? <InviteDialog roomCode={roomCode} sitUrl={sitUrl} watchUrl={watchUrl} shareable={shareable} />
                : <p className={css.hint}>默认底注 {DEFAULT_STAKE_M}M / 封顶 {DEFAULT_MAX_MULTIPLIER}。</p>}
            </>
          )}
      </div>
    </div>
  )
}
