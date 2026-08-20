import { useEffect, useState, type ReactNode } from 'react'
import { PLUGIN_REPO } from './links.ts'
import css from './styles.module.css'

export const LOCAL_ONLY_COPY = '去设置里填对外地址，才能分享给朋友一起玩。'

export function LocalOnlyHint({
  variant = 'card',
}: {
  variant?: 'card' | 'bar' | 'badge'
}) {
  if (variant === 'badge') {
    return <span className={css.localOnlyBadge} title={LOCAL_ONLY_COPY}>仅本机</span>
  }
  return (
    <div className={variant === 'bar' ? css.localOnlyBar : css.localOnlyNotice} role="status">
      <span className={css.localOnlyBadge}>仅本机</span>
      {LOCAL_ONLY_COPY}
    </div>
  )
}

export function InviteDialog({
  roomCode, sitUrl, shareable,
}: {
  roomCode: string
  sitUrl: string
  watchUrl?: string
  shareable: boolean
}) {
  return (
    <div className={css.inviteBox}>
      <div className={css.codeRow}>
        <span>房间号</span>
        <code className={css.codeValue} onClick={() => { void navigator.clipboard.writeText(roomCode) }}>{roomCode}</code>
        <button type="button" className={css.ghost} onClick={() => { void navigator.clipboard.writeText(roomCode) }}>复制房号</button>
      </div>
      {shareable
        ? (
          <>
            <p className={css.hint}>
              同一条链接。对方需要 DeepSeek Harness，并已安装本插件；打开后点「进入」。
              缺任何一项时页面会提示怎么安装。先到的人入座，坐满或开打后来的人观战。
            </p>
            <button type="button" className={css.ghost} onClick={() => { void navigator.clipboard.writeText(sitUrl) }}>复制房间链接</button>
            <img className={css.qr} alt="room qr" src={`https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(sitUrl)}`} />
          </>
        )
        : (
          <LocalOnlyHint />
        )}
    </div>
  )
}

export function RoomCodeBar({
  brand, title, roomCode, sitUrl, shareable, canRename, onRename, meta, aside,
}: {
  brand?: string
  title: string
  roomCode: string
  sitUrl?: string
  shareable?: boolean
  canRename?: boolean
  onRename?: (title: string) => void
  meta?: string
  aside?: ReactNode
}) {
  const [draft, setDraft] = useState(title)
  const [editing, setEditing] = useState(false)
  useEffect(() => { setDraft(title) }, [title])
  return (
    <div className={css.codeBar}>
      <div className={css.brandTitle}>
        {brand ? <span className={css.brand}>{brand}</span> : null}
        {brand ? <span className={css.brandDash} aria-hidden="true">-</span> : null}
        {canRename && editing
          ? (
            <form
              className={css.codeEdit}
              onSubmit={(event) => {
                event.preventDefault()
                onRename?.(draft)
                setEditing(false)
              }}
            >
              <input className={css.input} value={draft} maxLength={24} onChange={(event) => { setDraft(event.target.value) }} />
              <button type="submit" className={css.ghost}>保存</button>
            </form>
          )
          : (
            <button type="button" className={css.titleBtn} disabled={!canRename} onClick={() => { if (canRename) setEditing(true) }}>
              {title || '好友局'}
            </button>
          )}
      </div>
      <span className={css.muted}>房号</span>
      <code className={css.codeValue} onClick={() => { void navigator.clipboard.writeText(roomCode) }}>{roomCode}</code>
      <button type="button" className={css.ghost} onClick={() => { void navigator.clipboard.writeText(roomCode) }}>复制房号</button>
      {shareable && sitUrl
        ? <button type="button" className={css.ghost} onClick={() => { void navigator.clipboard.writeText(sitUrl) }}>复制链接</button>
        : sitUrl
          ? <LocalOnlyHint variant="badge" />
          : null}
      {meta ? <span className={css.codeMeta}>{meta}</span> : null}
      {aside}
    </div>
  )
}

export function GithubLink() {
  return (
    <a
      className={css.githubLink}
      href={PLUGIN_REPO}
      target="_blank"
      rel="noreferrer"
      aria-label="GitHub 仓库"
      title="GitHub"
    >
      <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
        />
      </svg>
    </a>
  )
}
