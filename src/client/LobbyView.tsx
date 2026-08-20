import type { CSSProperties } from 'react'
import { DEFAULT_MAX_MULTIPLIER, DEFAULT_STAKE_M, formatM, seatCapAtoms, stakeAtomsFromM, STAKE_LADDER_M } from '../settle/math.ts'
import type { CardId, SeatCount } from '../types.ts'
import { CardFace } from './CardFace.tsx'
import { InviteDialog, LocalOnlyHint } from './InviteDialog.tsx'
import { JoinForm } from './JoinForm.tsx'
import css from './styles.module.css'

const MAX_MULTIPLIER_OPTIONS = [8, 16, 32, 64] as const
const TABLEAU_CARDS = ['S10', 'HQ', 'CK', 'DA', 'RJ'] as CardId[]

export function LobbyView({
  tab, onTab, title, stakeM, maxMultiplier, seatCount, laiZi, onTitle, onStake, onCap, onSeats, onLaiZi, onCreate, creating, error,
  roomCode, sitUrl, watchUrl, shareable, welcomeAtoms, turnTimeoutSec, join,
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
  turnTimeoutSec: number
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
  const tableauCards = TABLEAU_CARDS.slice(0, seatCount + 1)

  return (
    <main className={css.lobby}>
      <section className={css.lobbyPanel} aria-label="斗地主房间">
        <div className={css.lobbyForm}>
          <div className={css.tabs} role="tablist" aria-label="开房或加入">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'create'}
              className={`${css.tab} ${tab === 'create' ? css.tabActive : ''}`}
              onClick={() => { onTab('create') }}
            >
              创建牌桌
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'join'}
              className={`${css.tab} ${tab === 'join' ? css.tabActive : ''}`}
              onClick={() => { onTab('join') }}
            >
              加入牌桌
            </button>
          </div>

          {tab === 'join'
            ? (
              <div className={css.lobbyTabPanel} role="tabpanel">
                <div className={css.eyebrow}>JOIN A PRIVATE TABLE</div>
                <h1>带上房号，入座。</h1>
                <p className={css.lobbyLead}>
                  填入好友发来的六位房号。预览桌况后再确认，打牌始终留在这个 DSH tab。
                </p>
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
                <p className={css.lobbyNote}>
                  积分记在开房那台机器的欢迎账本，不是 DeepSeek 平台余额。
                </p>
              </div>
            )
            : (
              <div className={css.lobbyTabPanel} role="tabpanel">
                <div className={css.eyebrow}>PRIVATE HOST TABLE</div>
                <h1>今晚，开一桌。</h1>
                {shareable ? null : <LocalOnlyHint />}
                <p className={css.lobbyLead}>
                  三人经典或四人双牌。好友准备齐后由房主开打，这台机器负责房间与账本。
                </p>

                <label className={css.field}>
                  <span>房间名</span>
                  <input
                    className={css.input}
                    value={title}
                    maxLength={24}
                    placeholder="好友局"
                    onChange={(event) => { onTitle(event.target.value) }}
                  />
                </label>

                <div className={css.setupGrid}>
                  <fieldset className={css.field}>
                    <legend>人数</legend>
                    <div className={css.choiceGroup}>
                      {([
                        { value: 3, label: '3 人', detail: '一副牌' },
                        { value: 4, label: '4 人', detail: '两副牌' },
                      ] as const).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={css.choiceButton}
                          data-active={seatCount === option.value ? '' : undefined}
                          aria-pressed={seatCount === option.value}
                          onClick={() => { onSeats(option.value) }}
                        >
                          <span className={css.choiceIndicator} aria-hidden="true" />
                          <strong>{option.label}</strong>
                          <small>{option.detail}</small>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className={css.field}>
                    <legend>玩法</legend>
                    <div className={css.choiceGroup}>
                      {([
                        { value: false, label: '经典', detail: '标准牌型' },
                        { value: true, label: '癞子', detail: '翻牌为癞子' },
                      ] as const).map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          className={css.choiceButton}
                          data-active={laiZi === option.value ? '' : undefined}
                          aria-pressed={laiZi === option.value}
                          onClick={() => { onLaiZi(option.value) }}
                        >
                          <span className={css.choiceIndicator} aria-hidden="true" />
                          <strong>{option.label}</strong>
                          <small>{option.detail}</small>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className={css.field}>
                    <span>底注</span>
                    <span className={css.selectShell}>
                      <select className={css.select} value={stakeM} onChange={(event) => { onStake(Number(event.target.value)) }}>
                        {STAKE_LADDER_M.map((value) => <option key={value} value={value}>{value}M</option>)}
                      </select>
                      <SelectChevron />
                    </span>
                  </label>
                  <label className={css.field}>
                    <span>倍数封顶</span>
                    <span className={css.selectShell}>
                      <select className={css.select} value={maxMultiplier} onChange={(event) => { onCap(Number(event.target.value)) }}>
                        {MAX_MULTIPLIER_OPTIONS.map((value) => <option key={value} value={value}>{value} 倍</option>)}
                      </select>
                      <SelectChevron />
                    </span>
                  </label>
                </div>

                <div className={css.roomFacts}>
                  <div><strong>{seatCount}</strong><span>玩家</span></div>
                  <div><strong>{turnTimeoutSec}</strong><span>秒 / 回合</span></div>
                  <div><strong>{formatM(cap)}</strong><span>入座冻结</span></div>
                </div>
                <p className={css.lobbyNote}>
                  桌上积分是本机欢迎账本。先到的人入座，坐满或开打后加入的人观战。
                </p>
                {blocked
                  ? (
                    <p className={css.error} role="alert">
                      欢迎积分不够入座冻结。请调低底注或封顶，或去设置增加欢迎积分。
                    </p>
                  )
                  : null}
                <button type="button" className={css.primary} disabled={blocked || creating} onClick={onCreate}>
                  <span>{creating ? '正在布置牌桌…' : '创建房间'}</span>
                  <span aria-hidden="true" className={css.buttonArrow}>→</span>
                </button>
                {error ? <p className={css.error} role="alert">{error}</p> : null}
                {roomCode
                  ? <InviteDialog roomCode={roomCode} sitUrl={sitUrl} watchUrl={watchUrl} shareable={shareable} />
                  : <p className={css.defaultNote}>默认底注 {DEFAULT_STAKE_M}M · 封顶 {DEFAULT_MAX_MULTIPLIER} · 欢迎 {formatM(welcomeAtoms)}</p>}
              </div>
            )}
        </div>

        <div className={css.lobbyStage} aria-hidden="true">
          <div className={css.stageGlow} />
          <div className={css.stageTopline}>
            <span>{laiZi ? 'WILD TABLE' : 'CLASSIC TABLE'}</span>
            <span>0{seatCount} SEATS</span>
          </div>
          <div className={css.tableau} data-wild={laiZi ? '' : undefined}>
            {tableauCards.map((card, index) => {
              const middle = (tableauCards.length - 1) / 2
              const offset = index - middle
              return (
                <div
                  key={card}
                  className={css.tableauCard}
                  style={{
                    '--fan': `${offset * 8}deg`,
                    '--lift': `${Math.abs(offset) * 6}px`,
                    '--shift': `${offset * 18}px`,
                    '--delay': `${index * 45}ms`,
                    zIndex: index,
                  } as CSSProperties}
                >
                  <div className={css.tableauClip}>
                    <CardFace card={card} laiZiRanks={laiZi ? ['A'] : []} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className={css.stageSeal}>
            <span>HOST</span>
            <strong>房主牌局</strong>
            <small>本机权威结算</small>
          </div>
          <div className={css.stageRule} />
          <p>{seatCount === 4 ? '两副牌 · 25 张 / 人 · 8 张底牌' : '一副牌 · 17 张 / 人 · 3 张底牌'}</p>
        </div>
      </section>
    </main>
  )
}

function SelectChevron() {
  return (
    <svg className={css.selectChevron} viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 6 4 4 4-4" />
    </svg>
  )
}
