import { useEffect, useState } from 'react'
import {
  holeCount, type BidAction, type CardId, type DoubleAction, type PlayerId,
  type PlayerView, type Seat, type SeatState,
} from '../types.ts'
import { CardBack } from './CardBack.tsx'
import { ChatLog } from './ChatLog.tsx'
import { ChatComposer, DanmakuLayer } from './ChatDock.tsx'
import { DealAnimation } from './DealAnimation.tsx'
import { FlipCard } from './FlipCard.tsx'
import { HandFan } from './HandFan.tsx'
import { PlayFly } from './PlayFly.tsx'
import { SeatAvatar } from './SeatAvatar.tsx'
import { SeatRow } from './SeatRow.tsx'
import { SeatTags } from './SeatTags.tsx'
import { opponentSeats } from './seat-layout.ts'
import { selectionLegal } from './store.ts'
import { opponentTurnCue, yourTurnToastKey } from './turn-cue.ts'
import css from './styles.module.css'

export function TableView({
  view, selected, onToggle, onBid, onDouble, onMingPai, onPlay, onPass, onReady, onStart, onKick, onChat,
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
}) {
  const seats = view.room.seats
  const count = view.room.seatCount ?? (seats.length >= 4 ? 4 : 3)
  const selfSeat = view.you.seat
  const layoutSelf = selfSeat ?? 0
  const opponents = (selfSeat === null
    ? Array.from({ length: count }, (_, index) => index as Seat)
    : opponentSeats(layoutSelf, count)
  ).map((seat) => seatAt(seats, seat))
  const mine = seatAt(seats, layoutSelf)
  const toastKey = yourTurnToastKey(view)
  const legal = selectionLegal(view, selected)
  const phase = view.room.phase
  const laiZi = view.laiZiRanks ?? []
  const seated = seats.filter((seat) => seat.playerId).length
  const isHost = view.you.playerId === view.room.hostPlayerId
  const guestsReady = seats
    .filter((seat) => seat.playerId && seat.playerId !== view.room.hostPlayerId)
    .every((seat) => seat.ready)
  const tableFull = seated === count
  const canStart = isHost && phase === 'waiting' && tableFull && guestsReady
  const waiting = phase === 'waiting'
  const statusCopy = waiting ? waitingStatusCopy(isHost, canStart) : null
  const bidWaitCopy = biddingWaitCopy(view)
  return (
    <div className={css.table} data-table>
      <DanmakuLayer lines={view.chat} selfId={view.you.playerId} />
      {waiting
        ? <div className={css.waitingPill}><span className={css.liveDot} /> {seated}/{count} 人入座。好友点准备，齐了由房主开打。</div>
        : null}
      {laiZi.length > 0
        ? <div className={css.wildPill}>癞子牌 · {laiZi.join('、')}</div>
        : null}
      <div className={`${css.opponents} ${opponents.length > 2 ? css.opponentsThree : ''}`} aria-label="其他玩家">
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
            playing={opponentTurnCue(view, seat.seat)}
            {...(seat.playerId && onKick ? { onKick: () => { onKick(seat.playerId!) } } : {})}
          />
        ))}
      </div>
      <div className={css.centerPlay} data-play-zone aria-label="牌桌公共区域">
        <ChatLog lines={view.chat} />
        {phase === 'dealing'
          ? <DealAnimation seatCount={count} selfSeat={layoutSelf} />
          : view.lastPlays.length > 0
            ? view.lastPlays.slice(-1).map((play, index) => (
                play.type === 'pass'
                  ? <span key={index} className={css.passMark}>过</span>
                  : <PlayFly key={`${play.seq}-${index}`} cards={play.cards} laiZiRanks={laiZi} />
              ))
            : phase === 'playing'
              ? <span className={css.tableWatermark}>等待首轮出牌</span>
              : null}
        {toastKey ? <YourTurnToast turnKey={toastKey} /> : null}
        {bidWaitCopy
          ? <p className={css.tableStatus} data-bid-wait="">{bidWaitCopy}</p>
          : null}
        {waiting && !view.you.spectator
          ? (
            <div className={css.readyCenter} data-ready-center="">
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
              {statusCopy ? <p className={css.hint}>{statusCopy}</p> : null}
              <MingPaiButton view={view} {...(onMingPai ? { onMingPai } : {})} />
            </div>
          )
          : null}
      </div>
      <div className={css.bottom} data-hole="" aria-label="底牌">
        {view.bottom
          ? view.bottom.map((card, index) => (
            <FlipCard key={card} card={card} faceUp laiZiRanks={laiZi} delay={index * 0.08} />
          ))
          : Array.from({ length: holeCount(count) }, (_, index) => (
            <CardBack key={index} />
          ))}
      </div>
      {view.you.spectator
        ? (
          <>
            <div className={css.selfRow}>
              <div className={css.selfSeat} data-self-seat>
                <SeatAvatar spectator />
                <div className={css.seatName}>
                  我
                  <SeatTags spectator />
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
                seat={layoutSelf}
                occupied={Boolean(mine?.playerId)}
                self
              />
              <div className={css.seatName}>
                我
                <SeatTags
                  host={isHost}
                  role={mine?.role ?? 'empty'}
                  mingPai={selfSeat !== null && Boolean(view.mingPaiBySeat?.[selfSeat])}
                />
                {waiting && !isHost
                  ? <span className={mine?.ready ? css.ready : css.muted}>{mine?.ready ? '已准备' : '未准备'}</span>
                  : mine?.autoPlay
                    ? <span className={css.muted}>托管</span>
                    : null}
              </div>
            </div>
            {phase === 'waiting'
              ? null
              : (
                <div className={css.selfPlay} data-self-play>
                  <ActionBar
                    view={view}
                    legal={legal}
                    onBid={onBid}
                    onDouble={onDouble}
                    {...(onMingPai ? { onMingPai } : {})}
                    onPlay={onPlay}
                    onPass={onPass}
                  />
                  {phase === 'dealing'
                    ? null
                    : (
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
                    )}
                </div>
              )}
          </div>
        )}
      {!view.you.spectator
        ? (
          <div className={css.chatComposer} data-chat-composer="">
            <ChatComposer
              seats={seats}
              selfId={view.you.playerId}
              canSend
              onSend={onChat}
            />
          </div>
        )
        : null}
    </div>
  )
}

function YourTurnToast({ turnKey }: { turnKey: string }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    setVisible(true)
    const hide = window.setTimeout(() => { setVisible(false) }, 1000)
    return () => { window.clearTimeout(hide) }
  }, [turnKey])
  if (!visible) return null
  return (
    <div className={css.yourTurnToast} data-your-turn-toast="" aria-live="polite">
      轮到你出牌了~
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

function ActionBar({
  view, legal, onBid, onDouble, onMingPai, onPlay, onPass,
}: {
  view: PlayerView
  legal: boolean
  onBid: (action: BidAction) => void
  onDouble: (action: DoubleAction) => void
  onMingPai?: () => void
  onPlay: (cards?: readonly CardId[]) => void
  onPass: () => void
}) {
  const phase = view.room.phase
  const [pendingDouble, setPendingDouble] = useState<DoubleAction | null>(null)
  useEffect(() => {
    if (phase !== 'doubling') setPendingDouble(null)
    else if (view.yourDouble) setPendingDouble(view.yourDouble)
  }, [phase, view.yourDouble])
  const answered = view.yourDouble ?? pendingDouble
  return (
    <div className={css.actions} data-actions>
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
      {phase !== 'waiting' ? <MingPaiButton view={view} {...(onMingPai ? { onMingPai } : {})} /> : null}
      {phase === 'doubling' && !view.you.spectator
        ? answered
          ? <p className={css.hint} data-double-answered="">{doubleAnswerLabel(answered)}</p>
          : (
            <>
              <button type="button" className={css.ghost} onClick={() => { setPendingDouble('pass'); onDouble('pass') }}>不加倍</button>
              <button type="button" className={css.primary} onClick={() => { setPendingDouble('double'); onDouble('double') }}>加倍 ×2</button>
              <button type="button" className={css.primary} onClick={() => { setPendingDouble('reDouble'); onDouble('reDouble') }}>超级加倍 ×4</button>
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

function MingPaiButton({ view, onMingPai }: { view: PlayerView; onMingPai?: () => void }) {
  if (!canMingPai(view) || !onMingPai) return null
  return (
    <button type="button" className={css.ghost} onClick={onMingPai}>
      明牌
    </button>
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

function waitingStatusCopy(isHost: boolean, canStart: boolean): string | null {
  if (isHost) return canStart ? '好友都准备好了，可以开打。' : null
  return '点中间黄色按钮准备，再点一次取消。'
}

function biddingWaitCopy(view: PlayerView): string | null {
  if (view.room.phase !== 'bidding' || view.you.spectator || isTurn(view)) return null
  return view.auction?.kind === 'rob' ? '等待下家抢地主' : '等待下家叫地主'
}

function doubleAnswerLabel(action: DoubleAction): string {
  if (action === 'reDouble') return '已超级加倍 ×4'
  if (action === 'double') return '已加倍 ×2'
  return '已不加倍'
}

export type { Seat }
