import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_MAX_MULTIPLIER, DEFAULT_STAKE_M, DEFAULT_WELCOME_ATOMS } from '../settle/math.ts'
import type { CardId, ClientCommand, PlayerView, RoomPreview, SeatCount } from '../types.ts'
import { connectChannel, createRoom, joinRoom, peekRoom, sendCommand, type CreateRoomResponse } from './host-api.ts'
import { LobbyView } from './LobbyView.tsx'
import { RoomPreviewCard } from './RoomPreviewCard.tsx'
import { SettlementView } from './SettlementView.tsx'
import { emptyState, toggleCard } from './store.ts'
import { TableView } from './TableView.tsx'
import css from './styles.module.css'

export function HostApp({ onClose }: { onClose: () => void }) {
  const [stakeM, setStakeM] = useState(DEFAULT_STAKE_M)
  const [maxMultiplier, setMaxMultiplier] = useState(DEFAULT_MAX_MULTIPLIER)
  const [seatCount, setSeatCount] = useState<SeatCount>(3)
  const [laiZi, setLaiZi] = useState(false)
  const [title, setTitle] = useState('好友局')
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [joinCode, setJoinCode] = useState('')
  const [joinInvite, setJoinInvite] = useState('')
  const [joinName, setJoinName] = useState('好友')
  const [preview, setPreview] = useState<RoomPreview | null>(null)
  const [state, setState] = useState(emptyState)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [previewing, setPreviewing] = useState(false)
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
        stakeM, maxMultiplier, seatCount, laiZi, hostDisplayName: '房主', title,
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
      listenRoom(created.roomId, created.wsTicket)
    } catch (error) {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'create failed' }))
    } finally {
      setCreating(false)
    }
  }

  const loadPreview = async (): Promise<void> => {
    setPreviewing(true)
    setState((prev) => ({ ...prev, error: null }))
    try {
      setPreview(await peekRoom({ roomCode: joinCode.trim(), invite: joinInvite.trim() }))
    } catch (error) {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'preview failed' }))
    } finally {
      setPreviewing(false)
    }
  }

  const enterRoom = async (): Promise<void> => {
    setJoining(true)
    setState((prev) => ({ ...prev, error: null }))
    try {
      const result = await joinRoom({
        roomCode: joinCode.trim(),
        invite: joinInvite.trim(),
        displayName: joinName,
        role: preview && !preview.canSit ? 'watch' : 'sit',
      })
      setRoomId(result.roomId)
      applyView(result.view)
      setPreview(null)
      setState((prev) => ({ ...prev, roomCode: result.view.room.roomCode }))
      location.hash = `#/doudizhu/room/${result.roomId}`
      listenRoom(result.roomId, result.wsTicket)
    } catch (error) {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'join failed' }))
    } finally {
      setJoining(false)
    }
  }

  const listenRoom = (nextRoomId: string, ticket: string): void => {
    connectChannel(ticket, (event) => {
      if (event.type === 'snapshot') {
        seq.value = event.seq
        applyView(event.view)
      }
      if (event.type === 'settled') {
        seq.value = event.seq
        setState((prev) => ({ ...prev, settlement: event.settlement }))
      }
      if (event.type === 'kicked') {
        setRoomId(null)
        setPreview(null)
        setState({ ...emptyState(), error: '房主把你踢出了房间' })
        location.hash = '#/doudizhu'
      }
      if (event.type === 'reject') {
        setState((prev) => ({ ...prev, error: event.reason }))
      }
    }, { roomId: nextRoomId, seq: () => seq.value })
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
        ? preview
          ? (
            <div className={css.lobby}>
              <div className={css.card}>
                <RoomPreviewCard
                  preview={preview}
                  name={joinName}
                  onName={setJoinName}
                  onConfirm={() => { void enterRoom() }}
                  onBack={() => { setPreview(null) }}
                  confirming={joining}
                  error={state.error}
                />
              </div>
            </div>
          )
          : (
          <LobbyView
            tab={tab}
            onTab={setTab}
            title={title}
            stakeM={stakeM}
            maxMultiplier={maxMultiplier}
            seatCount={seatCount}
            laiZi={laiZi}
            onTitle={setTitle}
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
            join={{
              code: joinCode,
              invite: joinInvite,
              name: joinName,
              joining: previewing,
              onCode: setJoinCode,
              onInvite: setJoinInvite,
              onName: setJoinName,
              onJoin: () => { void loadPreview() },
            }}
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
            <TableView
              view={state.view}
              selected={state.selected}
              onToggle={(card: CardId) => { setState((prev) => ({ ...prev, selected: toggleCard(prev.selected, card) })) }}
              onBid={(action) => { command({ type: 'bid', action }) }}
              onDouble={(action) => { command({ type: 'double', action }) }}
              onMingPai={() => { command({ type: 'mingPai' }) }}
              onPlay={(cards) => {
                const next = cards && cards.length > 0 ? [...cards] : state.selected
                if (next.length === 0) return
                command({ type: 'play', cards: next, nonce: crypto.randomUUID() })
              }}
              onPass={() => { command({ type: 'pass', nonce: crypto.randomUUID() }) }}
              onReady={(ready) => { command({ type: 'ready', ready }) }}
              onStart={() => { command({ type: 'start' }) }}
              onKick={(playerId) => { command({ type: 'hostKick', playerId }) }}
              onChat={(text) => { command({ type: 'chat', text }) }}
              roomCode={state.roomCode}
              sitUrl={state.sitUrl}
              shareable={state.shareable}
              canRename
              onRename={(next) => { command({ type: 'rename', title: next }) }}
            />
          )}
    </div>
  )
}
