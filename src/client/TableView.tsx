import { useEffect, useState } from 'react'
import { formatM } from '../settle/math.ts'
import {
  holeCount, parseAtoms, type BidAction, type CardId, type DoubleAction, type PlayerId,
  type PlayerView, type Seat, type SeatState,
} from '../types.ts'
import { CardBack } from './CardBack.tsx'
import { DealAnimation } from './DealAnimation.tsx'
import { FlipCard } from './FlipCard.tsx'
import { HandFan } from './HandFan.tsx'
import { PlayFly } from './PlayFly.tsx'
import { RoomCodeBar } from './InviteDialog.tsx'
import { SeatAvatar } from './SeatAvatar.tsx'
import { SeatRow } from './SeatRow.tsx'
import { opponentSeats } from './seat-layout.ts'
import { selectionLegal } from './store.ts'
import css from './styles.module.css'

export function TableView({
  view, selected, onToggle, onBid, onDouble, onMingPai, onPlay, onPass, onReady, onStart, onKick, onChat,
  roomCode, sitUrl, shareable, canRename, onRename,
}: {
  view: PlayerView
  selected: CardId[]
  onToggle: (card: CardId) => void
  onBid: (action: BidAction) => void
  onDouble: (action: DoubleAction) => void
  onMingPai?: () => void
  onPlay: (cards?: readonly CardId[]) => void
  onPass: () => void
  onReady?: (ready: boolean) => void
  onStart?: () => void
  onKick?: (playerId: PlayerId) => void
  onChat: (text: string) => void
  roomCode?: string
  sitUrl?: string
  shareable?: boolean
  canRename?: boolean
  onRename?: (title: string) => void
}) {
  const seats = view.room.seats
  const count = view.room.seatCount ?? (seats.length >= 4 ? 4 : 3)
  const self = view.you.seat ?? 0
  const opponents = opponentSeats(self, count).map((seat) => seatAt(seats, seat))
  const mine = seatAt(seats, self)
  const legal = selectionLegal(view, selected)
  const phase = view.room.phase
  const laiZi = view.laiZiRanks ?? []
  const seconds = useDeadline(phase === 'playing' || phase === 'bidding' ? view.deadlineAt : null)
  const seated = seats.filter((seat) => seat.playerId).length
  const isHost = view.you.playerId === view.room.hostPlayerId
  const guestsReady = seats
    .filter((seat) => seat.playerId && seat.playerId !== view.room.hostPlayerId)
    .every((seat) => seat.ready)
  const tableFull = seated === count
  const canStart = isHost && phase === 'waiting' && tableFull && guestsReady
  const waiting = phase === 'waiting'
  return (
    <div className={css.table} data-table>
      <div className={css.tableBar}>
        {roomCode
          ? (
            <RoomCodeBar
              title={view.room.title}
              roomCode={roomCode}
              {...(sitUrl ? { sitUrl } : {})}
              {...(shareable !== undefined ? { shareable } : {})}
              {...(canRename ? { canRename } : {})}
              {...(onRename ? { onRename } : {})}
              meta={`${count}人${view.room.laiZi ? '癞子' : '经典'} · 底注 ${formatM(parseAtoms(view.room.stakeAtoms))} · ${view.bid ? `${view.bid}倍` : '未叫'} · ${phaseLabel(phase)}`}
              aside={<span className={css.muted}>余额 {formatM(parseAtoms(view.yourAvailableAtoms))} · 冻结 {formatM(parseAtoms(view.yourEscrowAtoms))}</span>}
            />
          )
          : (
            <>
              <div>
                {view.room.title || '好友局'} · {count}人{view.room.laiZi ? '癞子' : '经典'} · 底注 {formatM(parseAtoms(view.room.stakeAtoms))} · {view.bid ? `${view.bid}倍` : '未叫'} · {phaseLabel(phase)}
              </div>
              <div className={css.muted}>余额 {formatM(parseAtoms(view.yourAvailableAtoms))} · 冻结 {formatM(parseAtoms(view.yourEscrowAtoms))}</div>
            </>
          )}
      </div>
      {seconds !== null
        ? (
          <div className={`${css.timer} ${seconds <= 10 ? css.timerUrgent : ''}`}>
            {phase === 'bidding' ? '叫抢剩余' : '出牌剩余'} <strong>{seconds}</strong> 秒
          </div>
        )
        : waiting
          ? <div className={css.hint}>{seated}/{count} 人入座。好友点准备，齐了由房主开打。</div>
          : phase === 'dealing'
            ? <div className={css.hint}>发牌中…</div>
            : null}
      {laiZi.length > 0
        ? <div className={css.muted}>癞子：{laiZi.join('、')}</div>
        : null}
      <div className={`${css.opponents} ${opponents.length > 2 ? css.opponentsThree : ''}`}>
        {opponents.map((seat, index) => (
          <SeatRow
            key={seat.seat}
            seat={seat}
            align={index === opponents.length - 1 ? 'right' : index === 0 ? 'left' : 'center'}
            {...(view.revealedBySeat?.[seat.seat] ? { revealed: view.revealedBySeat[seat.seat] } : {})}
            mingPai={Boolean(view.mingPaiBySeat?.[seat.seat])}
            laiZiRanks={laiZi}
            waiting={waiting}
            host={seat.playerId === view.room.hostPlayerId}
            canKick={isHost && waiting && Boolean(seat.playerId) && seat.playerId !== view.room.hostPlayerId}
            {...(seat.playerId && onKick ? { onKick: () => { onKick(seat.playerId!) } } : {})}
          />
        ))}
      </div>
      <div className={css.centerPlay} data-play-zone>
        {phase === 'dealing'
          ? <DealAnimation seatCount={count} selfSeat={self} />
          : view.lastPlays.slice(-1).map((play, index) => (
            play.type === 'pass'
              ? <span key={index} className={css.muted}>过</span>
              : <PlayFly key={`${play.seq}-${index}`} cards={play.cards} laiZiRanks={laiZi} />
          ))}
        {waiting && !view.you.spectator
          ? (
            <div className={css.readyCenter}>
              {isHost
                ? canStart
                  ? (
                    <button type="button" className={css.start} onClick={onStart}>
                      开始游戏
                    </button>
                  )
                  : <p className={css.hint}>等好友点准备后再开打</p>
                : (
                  <button
                    type="button"
                    className={mine?.ready ? css.unready : css.readyBtn}
                    onClick={() => { onReady?.(!mine?.ready) }}
                  >
                    {mine?.ready ? '取消准备' : '准备'}
                  </button>
                )}
            </div>
          )
          : null}
      </div>
      <div className={css.bottom}>
        {view.bottom
          ? view.bottom.map((card, index) => (
            <FlipCard key={card} card={card} faceUp laiZiRanks={laiZi} delay={index * 0.08} />
          ))
          : phase !== 'waiting' && phase !== 'dealing'
            ? <CardBack count={holeCount(count)} />
            : null}
      </div>
      {view.you.spectator
        ? (
          <>
            <div className={css.selfRow}>
              <div className={css.selfSeat} data-self-seat>
                <SeatAvatar spectator />
                <div className={css.seatName}>
                  我
                  <span className={css.badge}>观战</span>
                </div>
              </div>
            </div>
            <div className={css.hint}>观战中。只能看见已打出的牌与公开区。</div>
          </>
        )
        : (
          <div className={css.selfRow}>
            <div className={css.selfSeat} data-self-seat>
              <SeatAvatar
                avatarUrl={mine?.avatarUrl ?? null}
                role={mine?.role ?? 'empty'}
                seat={self}
                occupied={Boolean(mine?.playerId)}
                self
              />
              <div className={css.seatName}>
                我
                {isHost ? <span className={css.badge}>房主</span> : null}
                {mine?.role === 'landlord' ? <span className={css.badge}>地主</span> : null}
                {mine?.role === 'farmer' ? <span className={css.badge}>农民</span> : null}
                {view.mingPaiBySeat?.[self] ? <span className={css.badge}>明牌</span> : null}
              </div>
              {waiting && !isHost
                ? <div className={mine?.ready ? css.ready : css.muted}>{mine?.ready ? '已准备' : '未准备'}</div>
                : mine?.autoPlay
                  ? <div className={css.muted}>托管</div>
                  : null}
            </div>
            {phase === 'waiting' || phase === 'dealing'
              ? <CardBack count={holeCount(count)} compact />
              : (
                <div className={css.selfPlay} data-self-play>
                  <ActionBar
                    view={view}
                    legal={legal}
                    waiting={waiting}
                    isHost={isHost}
                    canStart={canStart}
                    onBid={onBid}
                    onDouble={onDouble}
                    {...(onMingPai ? { onMingPai } : {})}
                    onPlay={onPlay}
                    onPass={onPass}
                  />
                  <HandFan
                    cards={view.you.cards}
                    selected={selected}
                    laiZiRanks={laiZi}
                    canPlay={phase === 'playing' && isTurn(view) && !view.you.spectator}
                    onToggle={onToggle}
                    onPlay={(cards) => {
                      if (!selectionLegal(view, [...cards])) return
                      onPlay(cards)
                    }}
                  />
                </div>
              )}
          </div>
        )}
      {view.you.spectator || phase === 'waiting' || phase === 'dealing'
        ? (
          <ActionBar
            view={view}
            legal={legal}
            waiting={waiting}
            isHost={isHost}
            canStart={canStart}
            onBid={onBid}
            onDouble={onDouble}
            {...(onMingPai ? { onMingPai } : {})}
            onPlay={onPlay}
            onPass={onPass}
          />
        )
        : null}
      <div className={css.chat}>
        {view.chat.map((line) => <div key={line.ts}>{line.displayName}: {line.text}</div>)}
        {!view.you.spectator
          ? (
            <form onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const text = String(data.get('chat') ?? '')
              if (text) onChat(text)
              event.currentTarget.reset()
            }}
            >
              <input className={css.input} name="chat" maxLength={80} placeholder="聊天" />
            </form>
          )
          : null}
      </div>
    </div>
  )
}

function seatAt(seats: readonly SeatState[], index: number): SeatState {
  return seats[index] ?? {
    seat: index as Seat,
    playerId: null,
    displayName: null,
    avatarUrl: null,
    ready: false,
    connected: false,
    autoPlay: false,
    role: 'empty',
    grantId: null,
    cardsLeft: 0,
  }
}

function isTurn(view: PlayerView): boolean {
  return view.you.seat !== null && view.turnSeat === view.you.seat
}

function useDeadline(deadlineAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!deadlineAt) return undefined
    const tick = setInterval(() => { setNow(Date.now()) }, 250)
    return () => { clearInterval(tick) }
  }, [deadlineAt])
  if (!deadlineAt) return null
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - now) / 1000))
}

function ActionBar({
  view, legal, waiting, isHost, canStart, onBid, onDouble, onMingPai, onPlay, onPass,
}: {
  view: PlayerView
  legal: boolean
  waiting: boolean
  isHost: boolean
  canStart: boolean
  onBid: (action: BidAction) => void
  onDouble: (action: DoubleAction) => void
  onMingPai?: () => void
  onPlay: (cards?: readonly CardId[]) => void
  onPass: () => void
}) {
  const phase = view.room.phase
  return (
    <div className={css.actions} data-actions>
      {waiting && !view.you.spectator
        ? <p className={css.hint}>{isHost ? (canStart ? '好友都准备好了，可以开打。' : '等好友点准备。') : '点中间黄色按钮准备，再点一次取消。'}</p>
        : null}
      {phase === 'bidding' && !view.you.spectator && !isTurn(view)
        ? <p className={css.hint}>{view.auction?.kind === 'rob' ? '等待下家抢地主' : '等待下家叫地主'}</p>
        : null}
      {phase === 'bidding' && isTurn(view)
        ? (
          <>
            {view.auction?.kind === 'rob'
              ? (
                <>
                  <button type="button" className={css.ghost} onClick={() => { onBid('pass') }}>不抢</button>
                  <button type="button" className={css.primary} onClick={() => { onBid('rob') }}>抢地主</button>
                </>
              )
              : (
                <>
                  <button type="button" className={css.ghost} onClick={() => { onBid('pass') }}>不叫</button>
                  <button type="button" className={css.primary} onClick={() => { onBid('call') }}>叫地主</button>
                </>
              )}
          </>
        )
        : null}
      {canMingPai(view) && onMingPai
        ? <button type="button" className={css.ghost} onClick={onMingPai}>明牌</button>
        : null}
      {phase === 'doubling' && !view.you.spectator
        ? (
          <>
            <button type="button" className={css.ghost} onClick={() => { onDouble('pass') }}>不加倍</button>
            <button type="button" className={css.primary} onClick={() => { onDouble('double') }}>加倍 ×2</button>
            <button type="button" className={css.primary} onClick={() => { onDouble('reDouble') }}>超级加倍 ×4</button>
          </>
        )
        : null}
      {phase === 'playing' && isTurn(view) && !view.you.spectator
        ? (
          <>
            <button type="button" className={css.primary} disabled={!legal} onClick={() => { onPlay() }}>出牌</button>
            <button type="button" className={css.ghost} disabled={!view.legal.canPass} onClick={onPass}>过</button>
          </>
        )
        : null}
    </div>
  )
}

function canMingPai(view: PlayerView): boolean {
  if (view.you.spectator || view.you.seat === null) return false
  if (view.mingPaiBySeat?.[view.you.seat]) return false
  const phase = view.room.phase
  if (phase === 'waiting' || phase === 'dealing' || phase === 'bidding') return true
  if (phase === 'doubling') {
    const mine = view.room.seats.find((seat) => seat.seat === view.you.seat)
    return mine?.role === 'landlord'
  }
  return false
}

function phaseLabel(phase: PlayerView['room']['phase']): string {
  if (phase === 'waiting') return '准备'
  if (phase === 'dealing') return '发牌'
  if (phase === 'bidding') return '叫抢'
  if (phase === 'doubling') return '加倍'
  if (phase === 'playing') return '出牌'
  if (phase === 'settling') return '结算'
  return phase
}

export type { Seat }
