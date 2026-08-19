import { ROLE_ICONS } from './SeatAvatar.tsx'
import css from './styles.module.css'

export function JoinForm({
  code, invite, name, onCode, onInvite, onName, onJoin, joining = false, showInvite = true, error,
}: {
  code: string
  invite: string
  name: string
  onCode: (value: string) => void
  onInvite: (value: string) => void
  onName: (value: string) => void
  onJoin: () => void
  joining?: boolean
  showInvite?: boolean
  error: string | null
}) {
  return (
    <div className={css.joinForm}>
      <div className={css.roleHero}>
        <figure className={css.roleHeroItem}>
          <img className={css.roleHeroImg} src={ROLE_ICONS.landlord} alt="地主" />
          <figcaption>地主</figcaption>
        </figure>
        <figure className={css.roleHeroItem}>
          <img className={css.roleHeroImg} src={ROLE_ICONS.farmer} alt="农民" />
          <figcaption>农民</figcaption>
        </figure>
        <figure className={css.roleHeroItem}>
          <img className={css.roleHeroImg} src={ROLE_ICONS.farmerB} alt="农民" />
          <figcaption>农民</figcaption>
        </figure>
        <figure className={css.roleHeroItem}>
          <img className={css.roleHeroImg} src={ROLE_ICONS.farmerC} alt="农民" />
          <figcaption>农民</figcaption>
        </figure>
      </div>
      <p className={css.hint}>填房号就能进。先到的人入座，坐满或已经开打后来的人观战。出牌每手 120 秒。</p>
      <div className={css.joinFields}>
        {showInvite
          ? (
            <label className={css.field}>
              邀请
              <input className={css.input} value={invite} autoComplete="off" spellCheck={false} onChange={(event) => { onInvite(event.target.value) }} />
            </label>
          )
          : null}
        <div className={css.joinInline}>
          <div className={css.joinField}>
            <span className={css.settingsLabel}>房号</span>
            <input
              className={`${css.input} ${css.codeInput}`}
              value={code}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="6 位房号"
              onChange={(event) => { onCode(event.target.value) }}
            />
          </div>
          <div className={css.joinField}>
            <span className={css.settingsLabel}>昵称</span>
            <input className={css.input} value={name} maxLength={16} onChange={(event) => { onName(event.target.value) }} />
          </div>
        </div>
        <button type="button" className={css.primary} disabled={joining || !code.trim()} onClick={onJoin}>
          {joining ? '加入中…' : '加入'}
        </button>
        {error ? <p className={css.error}>{error}</p> : null}
      </div>
    </div>
  )
}
