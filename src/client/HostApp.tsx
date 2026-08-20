import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_TURN_TIMEOUT_SEC, turnTimeoutSecFromMs } from '../config.ts'
import { DEFAULT_MAX_MULTIPLIER, DEFAULT_STAKE_M, DEFAULT_WELCOME_ATOMS } from '../settle/math.ts'
import type { CardId, ClientCommand, PlayerView, RoomPreview, SeatCount } from '../types.ts'
import { doudizhuTabHash, parseDoudizhuHash } from './hash.ts'
import {
  connectChannel, createRoom, fetchPluginReady, joinRoom, leaveHere, peekRoom, sendCommand, type CreateRoomResponse,
} from './host-api.ts'
import { GithubLink, RoomCodeBar } from './InviteDialog.tsx'
import { LobbyView } from './LobbyView.tsx'
import { ALREADY_IN_ROOM_MESSAGE, claimRoomPresence, roomOccupiedHere } from './presence.ts'
import { RoomPreviewCard } from './RoomPreviewCard.tsx'
import { SettlementView } from './SettlementView.tsx'
import { emptyState, retainSelected, toggleCard } from './store.ts'
import { tableBalance, tableMeta, useDeadline } from './table-chrome.ts'
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
  const [turnTimeoutSec, setTurnTimeoutSec] = useState(DEFAULT_TURN_TIMEOUT_SEC)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(null)
  const seq = useMemo(() => ({ value: 0 }), [])
  const channelRef = useRef<(() => void) | null>(null)
  const presenceRef = useRef<(() => void) | null>(null)
  const joinedHereRef = useRef(false)

  const dropLive = (): void => {
    channelRef.current?.()
    channelRef.current = null
    presenceRef.current?.()
    presenceRef.current = null
  }

  useEffect(() => {
    const onHash = (): void => {
      const parsed = parseDoudizhuHash(location.hash)
      if (parsed.roomId) setRoomId(parsed.roomId)
    }
    onHash()
    window.addEventListener('hashchange', onHash)
    const teardown = (): void => {
      channelRef.current?.()
      channelRef.current = null
      presenceRef.current?.()
      presenceRef.current = null
      if (joinedHereRef.current) leaveHere()
      joinedHereRef.current = false
    }
    window.addEventListener('pagehide', teardown)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('pagehide', teardown)
      teardown()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchPluginReady().then((ready) => {
      if (cancelled || typeof ready.turnTimeoutMs !== 'number') return
      setTurnTimeoutSec(turnTimeoutSecFromMs(ready.turnTimeoutMs))
    }).catch(() => { /* keep default */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const parsed = parseDoudizhuHash(location.hash)
    if (!parsed.code) return
    setTab('join')
    setJoinCode(parsed.code)
    setJoinInvite(parsed.invite)
    let cancelled = false
    setPreviewing(true)
    setState((prev) => ({ ...prev, error: null }))
    void peekRoom({ roomCode: parsed.code, invite: parsed.invite }).then((next) => {
      if (!cancelled) setPreview(next)
    }).catch((error: unknown) => {
      if (!cancelled) {
        setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'preview failed' }))
      }
    }).finally(() => {
      if (!cancelled) setPreviewing(false)
    })
    return () => { cancelled = true }
  }, [])

  const applyView = (view: PlayerView): void => {
    setState((prev) => ({ ...prev, view, selected: retainSelected(prev.selected, view.you.cards) }))
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
      location.hash = doudizhuTabHash({ roomId: created.roomId })
      listenRoom(created.roomId, created.wsTicket, created.roomCode)
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
      const code = joinCode.trim()
      if (preview?.alreadyInRoom || await roomOccupiedHere(code)) {
        setState((prev) => ({ ...prev, error: ALREADY_IN_ROOM_MESSAGE }))
        return
      }
      const result = await joinRoom({
        roomCode: code,
        invite: joinInvite.trim(),
        displayName: joinName,
        role: preview && !preview.canSit ? 'watch' : 'sit',
      })
      setRoomId(result.roomId)
      applyView(result.view)
      setPreview(null)
      setState((prev) => ({ ...prev, roomCode: result.view.room.roomCode }))
      location.hash = doudizhuTabHash({ roomId: result.roomId })
      listenRoom(result.roomId, result.wsTicket, result.view.room.roomCode)
    } catch (error) {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'join failed' }))
    } finally {
      setJoining(false)
    }
  }

  const dropToLobby = (error: string): void => {
    dropLive()
    joinedHereRef.current = false
    setRoomId(null)
    setPreview(null)
    setState({ ...emptyState(), error })
    location.hash = doudizhuTabHash()
  }

  const listenRoom = (nextRoomId: string, ticket: string, roomCode: string): void => {
    dropLive()
    joinedHereRef.current = true
    presenceRef.current = claimRoomPresence(roomCode)
    channelRef.current = connectChannel(ticket, (event) => {
      if (event.type === 'snapshot') {
        seq.value = event.seq
        applyView(event.view)
      }
      if (event.type === 'settled') {
        seq.value = event.seq
        setState((prev) => ({ ...prev, settlement: event.settlement }))
      }
      if (event.type === 'kicked') {
        dropToLobby('房主把你踢出了房间')
      }
      if (event.type === 'left') {
        dropToLobby('连接断开，已离开房间')
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

  const view = state.view
  const showSettlement = Boolean(state.settlement && view?.room.phase === 'waiting')
  const inTable = Boolean(view) && !showSettlement
  const seconds = useDeadline(
    inTable && view && (view.room.phase === 'playing' || view.room.phase === 'bidding' || view.room.phase === 'doubling')
      ? view.deadlineAt
      : null,
  )

  return (
    <div className={css.root}>
      <div className={css.topbar}>
        {inTable && view && state.roomCode
          ? (
            <RoomCodeBar
              brand="斗地主"
              title={view.room.title}
              roomCode={state.roomCode}
              {...(state.sitUrl ? { sitUrl: state.sitUrl } : {})}
              shareable={state.shareable}
              canRename
              onRename={(next) => { command({ type: 'rename', title: next }) }}
              meta={tableMeta(view, seconds)}
              aside={<span className={css.muted}>{tableBalance(view)}</span>}
            />
          )
          : <div className={css.brand}>斗地主</div>}
        <div className={css.topbarActions} data-topbar-actions="">
          <GithubLink />
          <button type="button" className={css.close} onClick={onClose}>关闭</button>
        </div>
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
            turnTimeoutSec={turnTimeoutSec}
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
            />
          )}
    </div>
  )
}
