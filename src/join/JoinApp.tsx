import { useEffect, useMemo, useState } from 'react'
import { connectChannel, joinRoom, peekRoom, sendCommand } from '../client/host-api.ts'
import { SettlementView } from '../client/SettlementView.tsx'
import { emptyState, toggleCard } from '../client/store.ts'
import { JoinForm } from '../client/JoinForm.tsx'
import { RoomPreviewCard } from '../client/RoomPreviewCard.tsx'
import { TableView } from '../client/TableView.tsx'
import type { CardId, PlayerView, RoomPreview } from '../types.ts'
import css from '../client/styles.module.css'

export function JoinApp() {
  const params = new URLSearchParams(location.search)
  const [code, setCode] = useState(params.get('code') ?? '')
  const [invite, setInvite] = useState(params.get('invite') ?? '')
  const [name, setName] = useState('好友')
  const [role] = useState<'sit' | 'watch'>(params.get('role') === 'watch' ? 'watch' : 'sit')
  const [preview, setPreview] = useState<RoomPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [joining, setJoining] = useState(false)
  const [state, setState] = useState(emptyState)
  const [roomId, setRoomId] = useState<string | null>(null)
  const seq = useMemo(() => ({ value: 0 }), [])

  const applyView = (view: PlayerView): void => {
    setState((prev) => ({ ...prev, view, selected: prev.selected.filter((card) => view.you.cards.includes(card)) }))
  }

  const loadPreview = async (): Promise<void> => {
    setPreviewing(true)
    setState((prev) => ({ ...prev, error: null }))
    try {
      const next = await peekRoom({ roomCode: code.trim(), invite: invite.trim() })
      setPreview(next)
    } catch (error) {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'preview failed' }))
    } finally {
      setPreviewing(false)
    }
  }

  const join = async (): Promise<void> => {
    setJoining(true)
    setState((prev) => ({ ...prev, error: null }))
    try {
      const nextRole = role === 'watch' || (preview !== null && !preview.canSit) ? 'watch' : 'sit'
      const result = await joinRoom({ roomCode: code, invite, displayName: name, role: nextRole })
      setRoomId(result.roomId)
      applyView(result.view)
      setPreview(null)
      connectChannel(result.wsTicket, (event) => {
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
          setState({ ...emptyState(), error: '房主把你踢出了房间' })
        }
        if (event.type === 'reject') setState((prev) => ({ ...prev, error: event.reason }))
      }, { roomId: result.roomId, seq: () => seq.value })
    } catch (error) {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'join failed' }))
    } finally {
      setJoining(false)
    }
  }

  useEffect(() => {
    if (params.get('code')) void loadPreview()
    // one-shot preview from query
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
            {preview
              ? (
                <RoomPreviewCard
                  preview={preview}
                  name={name}
                  onName={setName}
                  onConfirm={() => { void join() }}
                  onBack={() => { setPreview(null) }}
                  confirming={joining}
                  error={state.error}
                />
              )
              : (
                <>
                  <h2>加入斗地主</h2>
                  <JoinForm
                    code={code}
                    invite={invite}
                    name={name}
                    onCode={setCode}
                    onInvite={setInvite}
                    onName={setName}
                    onJoin={() => { void loadPreview() }}
                    joining={previewing}
                    error={state.error}
                  />
                </>
              )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={css.root}>
      {state.error ? <div className={css.banner}>{state.error}</div> : null}
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
            roomCode={state.view.room.roomCode}
          />
        )}
    </div>
  )
}
