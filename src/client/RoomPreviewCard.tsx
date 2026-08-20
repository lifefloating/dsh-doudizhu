import { formatM } from '../settle/math.ts'
import { parseAtoms, type RoomPreview } from '../types.ts'
import css from './styles.module.css'

export function RoomPreviewCard({
  preview, name, onName, onConfirm, onBack, confirming, error,
}: {
  preview: RoomPreview
  name: string
  onName: (value: string) => void
  onConfirm: () => void
  onBack: () => void
  confirming: boolean
  error: string | null
}) {
  const mode = preview.laiZi ? '癞子' : '经典'
  const action = preview.canSit ? '确定进入' : '观战进入'
  return (
    <div className={css.preview}>
      <h2>房间信息</h2>
      <p className={css.hint}>先看清这桌再进。点确定后才会入座。</p>
      <dl className={css.previewList}>
        <div><dt>房间</dt><dd>{preview.title}</dd></div>
        <div><dt>房号</dt><dd className={css.codeValue}>{preview.roomCode}</dd></div>
        <div><dt>房主</dt><dd>{preview.hostDisplayName}</dd></div>
        <div><dt>玩法</dt><dd>{preview.seatCount} 人{mode}</dd></div>
        <div><dt>底注</dt><dd>{formatM(parseAtoms(preview.stakeAtoms))}</dd></div>
        <div><dt>封顶</dt><dd>{preview.maxMultiplier} 倍</dd></div>
        <div><dt>人数</dt><dd>{preview.seated}/{preview.seatCount} 已入座</dd></div>
      </dl>
      <ul className={css.previewSeats}>
        {preview.seats.map((seat) => (
          <li key={seat.seat}>
            <span>{seat.displayName ?? '空座'}</span>
            {seat.host ? <span className={css.badge}>房主</span> : null}
            {seat.ready && !seat.host ? <span className={css.ready}>已准备</span> : null}
          </li>
        ))}
      </ul>
      {preview.canSit
        ? (
          <label className={css.field}>
            昵称
            <input className={css.input} value={name} maxLength={16} onChange={(event) => { onName(event.target.value) }} />
          </label>
        )
        : <p className={css.hint}>座位已满或已经开打，进去后观战。</p>}
      <div className={css.previewActions}>
        <button type="button" className={css.ghost} onClick={onBack} disabled={confirming}>返回</button>
        <button type="button" className={css.primary} onClick={onConfirm} disabled={confirming}>
          {confirming ? '进入中…' : action}
        </button>
      </div>
      {error ? <p className={css.error}>{error}</p> : null}
    </div>
  )
}
