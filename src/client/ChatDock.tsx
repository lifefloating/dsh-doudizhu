import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_CHAT } from '../invariant.ts'
import type { ChatLine, SeatState } from '../types.ts'
import css from './styles.module.css'

const EMOJIS = ['😀', '😂', '😎', '😍', '🤔', '😱', '😡', '👍', '👎', '🔥', '🎉', '🃏', '👑', '💣', '🐔', '💥'] as const

export function DanmakuLayer({
  lines,
  selfId,
}: {
  lines: readonly ChatLine[]
  selfId: string
}) {
  const lastTs = useRef(lines.at(-1)?.ts ?? '')
  const [flying, setFlying] = useState<ChatLine[]>([])

  useEffect(() => {
    const newest = lines.at(-1)
    if (!newest || newest.ts === lastTs.current) return
    const start = lines.findIndex((line) => line.ts === lastTs.current)
    const incoming = start >= 0 ? lines.slice(start + 1) : [newest]
    lastTs.current = newest.ts
    setFlying((current) => [...current, ...incoming].slice(-6))
  }, [lines])

  return (
    <div className={css.danmakuLayer} aria-hidden="true">
      {flying.map((line, index) => (
        <div
          key={`${line.ts}-${line.playerId}-${index}`}
          className={`${css.danmaku} ${css.danmakuFly} ${line.playerId === selfId ? css.danmakuSelf : ''}`}
          style={{ top: `${18 + (index % 4) * 18}%`, animationDelay: `${index * 80}ms` }}
          onAnimationEnd={() => {
            setFlying((current) => current.filter((item) => item.ts !== line.ts || item.playerId !== line.playerId))
          }}
        >
          <strong>{line.displayName}</strong>
          <span>{line.text}</span>
        </div>
      ))}
    </div>
  )
}

export function ChatComposer({
  seats,
  selfId,
  canSend,
  onSend,
}: {
  seats: readonly SeatState[]
  selfId: string
  canSend: boolean
  onSend: (text: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const mentionable = useMemo(
    () => seats.filter((seat) => seat.playerId && seat.playerId !== selfId && seat.displayName),
    [seats, selfId],
  )
  const canMention = mentionable.length > 0

  useEffect(() => {
    if (!canMention) setMentionOpen(false)
  }, [canMention])

  const insert = (chunk: string): void => {
    const input = inputRef.current
    const start = input?.selectionStart ?? draft.length
    const end = input?.selectionEnd ?? draft.length
    const next = `${draft.slice(0, start)}${chunk}${draft.slice(end)}`.slice(0, MAX_CHAT)
    setDraft(next)
    requestAnimationFrame(() => {
      if (!input) return
      const cursor = Math.min(start + chunk.length, MAX_CHAT)
      input.focus()
      input.setSelectionRange(cursor, cursor)
    })
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !canSend) return
    onSend(text)
    setDraft('')
    setEmojiOpen(false)
    setMentionOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === '@' && canMention) setMentionOpen(true)
    if (event.key === 'Escape') {
      setEmojiOpen(false)
      setMentionOpen(false)
    }
  }

  return (
    <form className={css.chatComposerForm} onSubmit={submit}>
      <div className={css.chatTools}>
        <button
          type="button"
          className={css.chatTool}
          aria-expanded={emojiOpen}
          aria-label="选择表情"
          onClick={() => {
            setEmojiOpen((open) => !open)
            setMentionOpen(false)
          }}
        >
          表情
        </button>
        {canMention
          ? (
            <button
              type="button"
              className={css.chatTool}
              aria-expanded={mentionOpen}
              aria-label="提到某人"
              onClick={() => {
                setMentionOpen((open) => !open)
                setEmojiOpen(false)
              }}
            >
              @
            </button>
          )
          : null}
      </div>
      {emojiOpen
        ? (
          <div className={css.emojiPanel} role="group" aria-label="表情">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={css.emojiButton}
                aria-label={`插入 ${emoji}`}
                onClick={() => {
                  insert(emoji)
                  setEmojiOpen(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )
        : null}
      {mentionOpen && canMention
        ? (
          <div className={css.mentionPanel} role="group" aria-label="提到谁">
            {mentionable.map((seat) => (
              <button
                key={seat.playerId}
                type="button"
                className={css.mentionButton}
                onClick={() => {
                  insert(`@${mentionLabel(seat)} `)
                  setMentionOpen(false)
                }}
              >
                {mentionLabel(seat)}
              </button>
            ))}
          </div>
        )
        : null}
      <input
        ref={inputRef}
        className={`${css.input} ${css.chatInput}`}
        name="chat"
        value={draft}
        maxLength={MAX_CHAT}
        placeholder={canMention ? '说点什么，或 @ 某人' : '说点什么…'}
        aria-label="聊天消息"
        autoComplete="off"
        disabled={!canSend}
        onChange={(event) => { setDraft(event.target.value) }}
        onKeyDown={onKeyDown}
      />
      <button type="submit" className={css.chatSend} disabled={!canSend || !draft.trim()}>发送</button>
    </form>
  )
}

function mentionLabel(seat: SeatState): string {
  const name = seat.displayName ?? '玩家'
  return `${name} · ${seat.seat + 1}号`
}
