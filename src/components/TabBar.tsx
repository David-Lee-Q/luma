import type { TabId } from '../lib/types'
import { IconAlbums, IconGrid, IconPlay, IconPlus, IconSparkles } from './Icons'

interface TabBarProps {
  active: TabId
  cleanupCount: number
  hasPhotos: boolean
  onChange: (tab: TabId) => void
  onUpload: () => void
  onSlideshow: () => void
}

export function TabBar({
  active,
  cleanupCount,
  hasPhotos,
  onChange,
  onUpload,
  onSlideshow,
}: TabBarProps) {
  return (
    <nav className="tabbar" aria-label="主导航">
      <button
        type="button"
        className={`tab ${active === 'library' ? 'is-active' : ''}`}
        onClick={() => onChange('library')}
        aria-current={active === 'library' ? 'page' : undefined}
      >
        <IconGrid size={21} />
        <span>图库</span>
      </button>
      <button
        type="button"
        className={`tab ${active === 'albums' ? 'is-active' : ''}`}
        onClick={() => onChange('albums')}
        aria-current={active === 'albums' ? 'page' : undefined}
      >
        <IconAlbums size={21} />
        <span>相册</span>
      </button>
      <button type="button" className="tab-upload" onClick={onUpload} aria-label="添加照片">
        <IconPlus size={26} />
      </button>
      <button
        type="button"
        className={`tab ${active === 'cleanup' ? 'is-active' : ''}`}
        onClick={() => onChange('cleanup')}
        aria-current={active === 'cleanup' ? 'page' : undefined}
      >
        <span className="tab-icon-wrap">
          <IconSparkles size={21} />
          {cleanupCount > 0 && (
            <span className="tab-badge">{cleanupCount > 99 ? '99+' : cleanupCount}</span>
          )}
        </span>
        <span>清理</span>
      </button>
      <button
        type="button"
        className={`tab ${active === 'slideshow' ? 'is-active' : ''}`}
        onClick={onSlideshow}
        disabled={!hasPhotos}
      >
        <IconPlay size={20} />
        <span>播放</span>
      </button>
    </nav>
  )
}
