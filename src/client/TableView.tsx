import { useEffect, useState } from 'react'
import { holeCount, type BidAction, type DoubleAction } from '../types.ts'
import { formatM } from '../settle/math.ts'
import { parseAtoms, type CardId, type PlayerView, type Seat, type SeatState } from '../types.ts'
import { CardBack } from './CardBack.tsx'
import { CardFace } from './CardFace.tsx'
import { SeatAvatar } from './SeatAvatar.tsx'
import { SeatRow } from './SeatRow.tsx'
import { selectionLegal } from './store.ts'
import css from './styles.module.css'

export function TableView({
  view, selected, onToggle, onBid, onDouble, onMingPai, onPlay, onPass, onChat,
}: {
  view: PlayerView
  selected: CardId[]
  onToggle: (card: CardId) => void
  onBid: (action: BidAction) => void
  onDouble: (action: DoubleAction) => void
  onMingPai?: () => void
  onPlay: () => void
  onPass: () => void
  onReady?: (ready: boolean) => void
  onChat: (text: string) => void
}) {
  const seats = view.room.seats
  const count = view.room.seatCount ?? (seats.length >= 4 ? 4 : 3)
  const self = view.you.seat ?? 0
  const opponents = opponentSeats(self, count).map((seat) => seatAt(seats, seat))
  const mine = seatAt(seats, self)
  const legal = selectionLegal(view, selected)
  const phase = view.room.phase
  const laiZi = view.laiZiRanks ?? []
  const seconds = useDeadline(phase === 'playing' ? view.deadlineAt : null)
  const seated = seats.filter((seat) => seat.playerId).length
  return (
    <div className={css.table}>
      <div className={css.topbar}>
        <div>
          {view.room.title || '好友局'} · {count}人{view.room.laiZi ? '癞子' : '经典'} · 底注 {formatM(parseAtoms(view.room.stakeAtoms))} · {view.bid ? `${view.bid}倍` : '未叫'} · 阶段 {phaseLabel(phase)}
        </div>
        <div className={css.muted}>余额 {formatM(parseAtoms(view.yourAvailableAtoms))} · 冻结 {formatM(parseAtoms(view.yourEscrowAtoms))}</div>
      </div>
      {seconds !== null
        ? (
          <div className={`${css.timer} ${seconds <= 10 ? css.timerUrgent : ''}`}>
            出牌剩余 <strong>{seconds}</strong> / 120 秒
          </div>
        )
        : phase === 'waiting'
          ? <div className={css.hint}>{seated}/{count} 人入座，人齐开打。后来的人观战。</div>
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
            laiZiRanks={laiZi}
          />
        ))}
      </div>
      <div className={css.centerPlay}>
        {view.lastPlays.slice(-1).map((play, index) => (
          play.type === 'pass'
            ? <span key={index} className={css.muted}>过</span>
            : play.cards.map((card) => <CardFace key={card} card={card} laiZiRanks={laiZi} />)
        ))}
      </div>
      <div className={css.bottom}>
        {view.bottom
          ? view.bottom.map((card) => <CardFace key={card} card={card} laiZiRanks={laiZi} />)
          : phase !== 'waiting'
            ? <CardBack count={holeCount(count)} />
            : null}
      </div>
      {view.you.spectator
        ? (
          <>
            <div className={css.selfRow}>
              <div className={css.selfSeat}>
                <SeatAvatar spectator />
                <div className={css.seatName}>
                  观战
                  <span className={css.badge}>观战</span>
                </div>
              </div>
            </div>
            <div className={css.hint}>观战中。只能看见已打出的牌与公开区。</div>
          </>
        )
        : (
          <div className={css.selfRow}>
            <div className={css.selfSeat}>
              <SeatAvatar
                avatarUrl={mine?.avatarUrl ?? null}
                role={mine?.role ?? 'empty'}
                seat={self}
                occupied={Boolean(mine?.playerId)}
              />
              <div className={css.seatName}>
                {mine?.displayName}
                {mine?.role === 'landlord' ? <span className={css.badge}>地主</span> : null}
                {mine?.role === 'farmer' ? <span className={css.badge}>农民</span> : null}
                {view.mingPaiBySeat?.[self] ? <span className={css.badge}>明牌</span> : null}
              </div>
            </div>
            {phase === 'waiting' && !view.bottom
              ? <CardBack count={holeCount(count)} compact />
              : (
                <div className={css.hand}>
                  <div className={css.handInner}>
                    {view.you.cards.map((card) => (
                      <button type="button" key={card} onClick={() => { onToggle(card) }}>
                        <CardFace card={card} selected={selected.includes(card)} laiZiRanks={laiZi} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      <div className={css.actions}>
        {phase === 'waiting' && !view.you.spectator
          ? <p className={css.hint}>等满 {count} 人自动开打。</p>
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
              <button type="button" className={css.primary} disabled={!legal} onClick={onPlay}>出牌</button>
              <button type="button" className={css.ghost} disabled={!view.legal.canPass} onClick={onPass}>过</button>
            </>
          )
          : null}
      </div>
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

function opponentSeats(self: Seat, count: number): Seat[] {
  const out: Seat[] = []
  for (let step = 1; step < count; step += 1) {
    out.push(((self + step) % count) as Seat)
  }
  return out
}

function seatAt(seats: readonly SeatState[], index: number): SeatState {
  return seats[index] ?? {
    seat: index as Seat,
    playerId: null,
    displayName: null,
    avatarUrl: null,
    ready: false,
    connected: false,
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

function canMingPai(view: PlayerView): boolean {
  if (view.you.spectator || view.you.seat === null) return false
  if (view.mingPaiBySeat?.[view.you.seat]) return false
  return view.room.phase === 'bidding' || view.room.phase === 'doubling' || view.room.phase === 'playing'
}

function phaseLabel(phase: PlayerView['room']['phase']): string {
  if (phase === 'waiting') return '等人'
  if (phase === 'bidding') return '叫抢'
  if (phase === 'doubling') return '加倍'
  if (phase === 'playing') return '出牌'
  if (phase === 'settling') return '结算'
  return phase
}

export type { Seat }
