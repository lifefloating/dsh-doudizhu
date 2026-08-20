import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChatLine } from '../types.ts'
import { chatLineKey, nextChatHidden } from './chat-log.ts'
import css from './styles.module.css'

export function ChatLog({ lines }: { lines: readonly ChatLine[] }) {
  const [hidden, setHidden] = useState(false)
  const prevLatestRef = useRef<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const latest = lines.at(-1)?.ts ?? null

  useEffect(() => {
    setHidden((current) => nextChatHidden(current, prevLatestRef.current, latest))
    prevLatestRef.current = latest
  }, [latest])

  useLayoutEffect(() => {
    if (hidden) return
    const node = scrollerRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [lines, hidden])

  if (lines.length === 0 || hidden) return null

  return (
    <div className={css.chatLog} data-chat-log="" role="log" aria-live="polite">
      <button
        type="button"
        className={css.chatLogClose}
        aria-label="隐藏聊天"
        onClick={() => { setHidden(true) }}
      >
        ×
      </button>
      <div className={css.chatLogScroll} ref={scrollerRef} data-chat-log-scroll>
        {lines.map((line, index) => (
          <div key={chatLineKey(line, index)} className={css.chatLogLine}>
            <span className={css.chatLogName}>{line.displayName}:</span>
            {' '}
            {line.text}
          </div>
        ))}
      </div>
    </div>
  )
}
