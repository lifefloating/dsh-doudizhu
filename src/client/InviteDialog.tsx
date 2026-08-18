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
      <div>房间号 <strong>{roomCode}</strong></div>
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
