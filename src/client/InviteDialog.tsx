import { useEffect, useState } from 'react'
import css from './styles.module.css'

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
            <p className={css.hint}>同一条链接。先到的人入座，坐满或开打后来的人观战。</p>
            <button type="button" className={css.ghost} onClick={() => { void navigator.clipboard.writeText(sitUrl) }}>复制房间链接</button>
            <img className={css.qr} alt="room qr" src={`https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(sitUrl)}`} />
          </>
        )
        : (
          <p className={`${css.hint} ${css.warn}`}>
            要给别的机器用，先在插件设置里填 publicBaseUrl（named tunnel 或反代到本机端口）。
            生产环境的 dsh web 不能绑 0.0.0.0，所以局域网 IP 用不了。本机可以打开 {sitUrl || 'loopback 加入页'} 自己测。
          </p>
        )}
    </div>
  )
}

export function RoomCodeBar({
  title, roomCode, sitUrl, shareable, canRename, onRename,
}: {
  title: string
  roomCode: string
  sitUrl?: string
  shareable?: boolean
  canRename?: boolean
  onRename?: (title: string) => void
}) {
  const [draft, setDraft] = useState(title)
  const [editing, setEditing] = useState(false)
  useEffect(() => { setDraft(title) }, [title])
  return (
    <div className={css.codeBar}>
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
      <span className={css.muted}>房号</span>
      <code className={css.codeValue} onClick={() => { void navigator.clipboard.writeText(roomCode) }}>{roomCode}</code>
      <button type="button" className={css.ghost} onClick={() => { void navigator.clipboard.writeText(roomCode) }}>复制房号</button>
      {shareable && sitUrl
        ? <button type="button" className={css.ghost} onClick={() => { void navigator.clipboard.writeText(sitUrl) }}>复制链接</button>
        : sitUrl
          ? <span className={css.muted}>未配置 publicBaseUrl，仅本机可加入</span>
          : null}
    </div>
  )
}
