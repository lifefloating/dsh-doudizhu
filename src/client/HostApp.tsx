import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_MAX_MULTIPLIER, DEFAULT_STAKE_M, DEFAULT_WELCOME_ATOMS } from '../settle/math.ts'
import type { CardId, ClientCommand, PlayerView, SeatCount } from '../types.ts'
import { connectChannel, createRoom, sendCommand, type CreateRoomResponse } from './host-api.ts'
import { LobbyView } from './LobbyView.tsx'
import { SettlementView } from './SettlementView.tsx'
import { emptyState, toggleCard } from './store.ts'
import { TableView } from './TableView.tsx'
import css from './styles.module.css'

export function HostApp({ onClose }: { onClose: () => void }) {
  const [stakeM, setStakeM] = useState(DEFAULT_STAKE_M)
  const [maxMultiplier, setMaxMultiplier] = useState(DEFAULT_MAX_MULTIPLIER)
  const [seatCount, setSeatCount] = useState<SeatCount>(3)
  const [laiZi, setLaiZi] = useState(false)
  const [state, setState] = useState(emptyState)
  const [creating, setCreating] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(null)
  const seq = useMemo(() => ({ value: 0 }), [])

  useEffect(() => {
    const onHash = (): void => {
      const match = /#\/doudizhu\/room\/([^/]+)/.exec(location.hash)
      if (match) setRoomId(match[1] ?? null)
    }
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => { window.removeEventListener('hashchange', onHash) }
  }, [])

  useEffect(() => {
    if (!roomId || !state.view) return
    return undefined
  }, [roomId, state.view])

  const applyView = (view: PlayerView): void => {
    setState((prev) => ({ ...prev, view, selected: prev.selected.filter((card) => view.you.cards.includes(card)) }))
  }

  const startRoom = async (): Promise<void> => {
    setCreating(true)
    setState((prev) => ({ ...prev, error: null }))
    try {
      const created: CreateRoomResponse = await createRoom({
        stakeM, maxMultiplier, seatCount, laiZi, hostDisplayName: '房主',
      })
      setRoomId(created.roomId)
      setState((prev) => ({
        ...prev,
        view: created.view,
        shareable: created.shareable,
        sitUrl: created.sitUrl,
        watchUrl: created.watchUrl,
        roomCode: created.roomCode,
      }))
      location.hash = `#/doudizhu/room/${created.roomId}`
      connectChannel(created.wsTicket, (event) => {
        if (event.type === 'snapshot') {
          seq.value = event.seq
          applyView(event.view)
        }
        if (event.type === 'settled') {
          seq.value = event.seq
          setState((prev) => ({ ...prev, settlement: event.settlement }))
        }
        if (event.type === 'reject') {
          setState((prev) => ({ ...prev, error: event.reason }))
        }
      }, { roomId: created.roomId, seq: () => seq.value })
    } catch (error) {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'create failed' }))
    } finally {
      setCreating(false)
    }
  }

  const command = (cmd: ClientCommand): void => {
    if (!roomId) return
    void sendCommand(roomId, cmd).catch((error: unknown) => {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'command failed' }))
    })
  }

  return (
    <div className={css.root}>
      <div className={css.topbar}>
        <div className={css.brand}>斗地主</div>
        <button type="button" className={css.close} onClick={onClose}>关闭</button>
      </div>
      {state.error ? <div className={css.banner}>{state.error}</div> : null}
      {!state.view
        ? (
          <LobbyView
            stakeM={stakeM}
            maxMultiplier={maxMultiplier}
            seatCount={seatCount}
            laiZi={laiZi}
            onStake={setStakeM}
            onCap={setMaxMultiplier}
            onSeats={setSeatCount}
            onLaiZi={setLaiZi}
            onCreate={() => { void startRoom() }}
            creating={creating}
            error={state.error}
            roomCode={state.roomCode}
            sitUrl={state.sitUrl}
            watchUrl={state.watchUrl}
            shareable={state.shareable}
            welcomeAtoms={DEFAULT_WELCOME_ATOMS}
          />
        )
        : state.settlement && state.view.room.phase === 'waiting'
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
            <>
              {state.roomCode
                ? (
                  <div className={css.banner}>
                    房间 {state.roomCode}
                    {state.shareable ? ` · ${state.sitUrl}` : ' · 未配置 publicBaseUrl，仅本机可加入'}
                    {' · 先到入座，后来观战'}
                  </div>
                )
                : null}
              <TableView
                view={state.view}
                selected={state.selected}
                onToggle={(card: CardId) => { setState((prev) => ({ ...prev, selected: toggleCard(prev.selected, card) })) }}
                onBid={(score) => { command({ type: 'bid', score }) }}
                onDouble={(action) => { command({ type: 'double', action }) }}
                onPlay={() => { command({ type: 'play', cards: state.selected, nonce: crypto.randomUUID() }) }}
                onPass={() => { command({ type: 'pass', nonce: crypto.randomUUID() }) }}
                onReady={(ready) => { command({ type: 'ready', ready }) }}
                onChat={(text) => { command({ type: 'chat', text }) }}
              />
            </>
          )}
    </div>
  )
}
