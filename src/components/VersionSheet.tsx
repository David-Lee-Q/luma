import { IconCheck, IconClose, IconLock, IconSparkles } from './Icons'
import { Sheet } from './Sheet'
import { APP_NAME, APP_TAGLINE, APP_VERSION, CURRENT_RELEASE, TECH_FACTS } from '../lib/version'

export function VersionSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label="版本说明">
      <header className="sheet-head">
        <div>
          <span className="eyebrow">RELEASE NOTES</span>
          <h2>版本说明</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
          <IconClose size={19} />
        </button>
      </header>

      <div className="version-card">
        <span className="version-mark" aria-hidden="true">
          <IconSparkles size={18} />
        </span>
        <div className="version-card-text">
          <strong>
            {APP_NAME} <span className="version-number">v{APP_VERSION}</span>
          </strong>
          <small>
            {CURRENT_RELEASE.title} · {CURRENT_RELEASE.date}
          </small>
        </div>
      </div>

      <p className="version-tagline">{APP_TAGLINE}</p>

      <h3 className="version-heading">本次更新</h3>
      <ul className="version-list">
        {CURRENT_RELEASE.highlights.map((item) => (
          <li key={item}>
            <span className="version-bullet" aria-hidden="true">
              <IconCheck size={13} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <h3 className="version-heading">运行说明</h3>
      <dl className="version-facts">
        {TECH_FACTS.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <p className="cloud-note">
        <IconLock size={14} />
        照片、分析结果与自定义音乐都保存在本机浏览器，版本更新不会上传或删除它们。
      </p>
    </Sheet>
  )
}
