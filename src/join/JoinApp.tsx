import { useEffect, useMemo, useState } from 'react'
import { connectChannel, joinRoom, sendCommand } from '../client/host-api.ts'
import { SettlementView } from '../client/SettlementView.tsx'
import { emptyState, toggleCard } from '../client/store.ts'
import { RoomCodeBar } from '../client/InviteDialog.tsx'
import { ROLE_ICONS } from '../client/SeatAvatar.tsx'
import { TableView } from '../client/TableView.tsx'
import type { CardId, PlayerView } from '../types.ts'
import css from '../client/styles.module.css'

export function JoinApp() {
  const params = new URLSearchParams(location.search)
  const [code, setCode] = useState(params.get('code') ?? '')
  const [invite, setInvite] = useState(params.get('invite') ?? '')
  const [name, setName] = useState('好友')
  const [role] = useState<'sit' | 'watch'>(params.get('role') === 'watch' ? 'watch' : 'sit')
  const [state, setState] = useState(emptyState)
  const [roomId, setRoomId] = useState<string | null>(null)
  const seq = useMemo(() => ({ value: 0 }), [])

  const applyView = (view: PlayerView): void => {
    setState((prev) => ({ ...prev, view, selected: prev.selected.filter((card) => view.you.cards.includes(card)) }))
  }

  const join = async (): Promise<void> => {
    try {
      const result = await joinRoom({ roomCode: code, invite, displayName: name, role })
      setRoomId(result.roomId)
      applyView(result.view)
      connectChannel(result.wsTicket, (event) => {
        if (event.type === 'snapshot') {
          seq.value = event.seq
          applyView(event.view)
        }
        if (event.type === 'settled') {
          seq.value = event.seq
          setState((prev) => ({ ...prev, settlement: event.settlement }))
        }
        if (event.type === 'reject') setState((prev) => ({ ...prev, error: event.reason }))
      }, { roomId: result.roomId, seq: () => seq.value })
    } catch (error) {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'join failed' }))
    }
  }

  useEffect(() => {
    if (params.get('code') && params.get('invite')) void join()
    // one-shot autojoin from query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const command = (cmd: Parameters<typeof sendCommand>[1]): void => {
    if (!roomId) return
    void sendCommand(roomId, cmd).catch((error: unknown) => {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'command failed' }))
    })
  }

  if (!state.view) {
    return (
      <div className={css.root}>
        <div className={css.lobby}>
          <div className={css.card}>
            <h2>加入斗地主</h2>
            <div className={css.roleHero}>
              <figure className={css.roleHeroItem}>
                <img className={css.roleHeroImg} src={ROLE_ICONS.landlord} alt="地主" />
                <figcaption>地主</figcaption>
              </figure>
              <figure className={css.roleHeroItem}>
                <img className={css.roleHeroImg} src={ROLE_ICONS.farmer} alt="农民" />
                <figcaption>农民</figcaption>
              </figure>
              <figure className={css.roleHeroItem}>
                <img className={css.roleHeroImg} src={ROLE_ICONS.landlordB} alt="地主" />
                <figcaption>地主</figcaption>
              </figure>
              <figure className={css.roleHeroItem}>
                <img className={css.roleHeroImg} src={ROLE_ICONS.farmerB} alt="农民" />
                <figcaption>农民</figcaption>
              </figure>
            </div>
            <p className={css.hint}>同一房间链接。先到的人入座，坐满或已经开打后来的人观战。出牌每手 120 秒。</p>
            <div className={css.codeRow}>
              <label className={css.field}>
                房号
                <input className={`${css.input} ${css.codeInput}`} value={code} onChange={(e) => { setCode(e.target.value) }} />
              </label>
              <button type="button" className={css.ghost} onClick={() => { void navigator.clipboard.writeText(code) }}>复制房号</button>
            </div>
            <label className={css.field}>邀请<input className={css.input} value={invite} onChange={(e) => { setInvite(e.target.value) }} /></label>
            <label className={css.field}>昵称<input className={css.input} value={name} maxLength={16} onChange={(e) => { setName(e.target.value) }} /></label>
            <button type="button" className={css.primary} onClick={() => { void join() }}>加入</button>
            {state.error ? <p className={css.error}>{state.error}</p> : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={css.root}>
      {state.error ? <div className={css.banner}>{state.error}</div> : null}
      <div className={css.banner}>
        <RoomCodeBar title={state.view.room.title} roomCode={state.view.room.roomCode} />
      </div>
      {state.settlement && state.view.room.phase === 'waiting'
        ? (
          <SettlementView
            settlement={state.settlement}
            onRematch={() => {
              setState((prev) => ({ ...prev, settlement: null }))
              command({ type: 'rematch' })
            }}
          />
        )
        : (
          <TableView
            view={state.view}
            selected={state.selected}
            onToggle={(card: CardId) => { setState((prev) => ({ ...prev, selected: toggleCard(prev.selected, card) })) }}
            onBid={(action) => { command({ type: 'bid', action }) }}
            onDouble={(action) => { command({ type: 'double', action }) }}
            onMingPai={() => { command({ type: 'mingPai' }) }}
            onPlay={() => { command({ type: 'play', cards: state.selected, nonce: crypto.randomUUID() }) }}
            onPass={() => { command({ type: 'pass', nonce: crypto.randomUUID() }) }}
            onReady={(ready) => { command({ type: 'ready', ready }) }}
            onChat={(text) => { command({ type: 'chat', text }) }}
          />
        )}
    </div>
  )
}
