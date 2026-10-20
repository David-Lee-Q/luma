import { useEffect, useMemo, useState } from 'react'
import { ALBUM_MAP } from '../lib/types'
import type { AlbumId, PhotoMeta } from '../lib/types'
import type { CleanupPlan } from '../lib/cleanup'
import { formatBytes } from '../lib/format'
import { useLibrary } from '../lib/library'
import { useSettings } from '../lib/settings'
import { ConfirmSheet } from './ConfirmSheet'
import {
  IconChevronRight,
  IconCloud,
  IconGrid,
  IconHeart,
  IconImage,
  IconInfo,
  IconLock,
  IconPlay,
  IconSearch,
  IconSelectAll,
  IconSparkles,
  IconSpinner,
  IconWand,
} from './Icons'
import { PhotoGrid } from './PhotoGrid'
import { APP_VERSION } from '../lib/version'

interface LibraryViewProps {
  cleanup: CleanupPlan
  onOpenCleanup: () => void
  onUpload: () => void
  onPlay: () => void
  onOpenCloud: () => void
  onOpenVersion: () => void
  onOpenPhoto: (ids: string[], index: number) => void
}

export function LibraryView({
  cleanup,
  onOpenCleanup,
  onUpload,
  onPlay,
  onOpenCloud,
  onOpenVersion,
  onOpenPhoto,
}: LibraryViewProps) {
  const { photos, totalBytes, removePhotos, addDemo, enhancedCount, searchPhotos, notify } =
    useLibrary()
  const { settings } = useSettings()
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchIds, setSearchIds] = useState<string[] | null>(null)
  const [searchMode, setSearchMode] = useState<'semantic' | 'local' | null>(null)
  const [searching, setSearching] = useState(false)

  const ids = useMemo(() => photos.map((photo) => photo.id), [photos])

  useEffect(() => {
    setSelected((previous) => {
      const next = new Set([...previous].filter((id) => ids.includes(id)))
      return next.size === previous.size ? previous : next
    })
  }, [ids])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setSearchIds(null)
      setSearchMode(null)
      setSearching(false)
      return
    }

    let active = true
    setSearching(true)
    const timer = window.setTimeout(() => {
      searchPhotos(trimmed)
        .then((result) => {
          if (!active) return
          setSearchIds(result.ids)
          setSearchMode(result.mode)
        })
        .catch(() => {
          if (!active) return
          setSearchIds([])
          setSearchMode('local')
          notify('检索暂不可用，请稍后重试', 'warning')
        })
        .finally(() => {
          if (active) setSearching(false)
        })
    }, 320)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query, photos, searchPhotos, notify])

  const visiblePhotos = useMemo(() => {
    if (!query.trim()) return photos
    if (!searchIds) return []
    const map = new Map(photos.map((photo) => [photo.id, photo]))
    return searchIds
      .map((id) => map.get(id))
      .filter((photo): photo is PhotoMeta => Boolean(photo))
  }, [photos, searchIds, query])

  const visibleIds = useMemo(() => visiblePhotos.map((photo) => photo.id), [visiblePhotos])

  const stats = useMemo(() => {
    const usedAlbums = new Set<AlbumId>()
    const bytesByAlbum = new Map<AlbumId, number>()
    photos.forEach((photo) => {
      usedAlbums.add(photo.album)
      bytesByAlbum.set(photo.album, (bytesByAlbum.get(photo.album) ?? 0) + photo.size)
    })
    const segments = [...bytesByAlbum.entries()]
      .filter(([, bytes]) => bytes > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([album, bytes]) => ({
        album,
        bytes,
        percent: totalBytes ? (bytes / totalBytes) * 100 : 0,
      }))
    return { albumCount: usedAlbums.size, segments }
  }, [photos, totalBytes])

  const selectedBytes = photos
    .filter((photo) => selected.has(photo.id))
    .reduce((sum, photo) => sum + photo.size, 0)

  const toggleSelect = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelect = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  if (!photos.length) {
    return (
      <div className="view view--library">
        <header className="page-head">
          <div className="page-head-row">
            <div>
              <span className="eyebrow">LUMA LIBRARY</span>
              <h1 className="page-title">图库</h1>
              <p className="page-sub">本地智能整理，让照片各归其位</p>
            </div>
            <button
              type="button"
              className="icon-btn icon-btn--subtle"
              onClick={onOpenVersion}
              title={`版本说明 v${APP_VERSION}`}
              aria-label={`版本说明 v${APP_VERSION}`}
            >
              <IconInfo size={17} />
            </button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-art" aria-hidden="true">
            <div className="hero-card hero-card--back">
              <span className="hero-sun" />
              <span className="hero-hill hero-hill--one" />
              <span className="hero-hill hero-hill--two" />
            </div>
            <div className="hero-card hero-card--mid">
              <span className="hero-bokeh" />
              <span className="hero-bokeh hero-bokeh--two" />
            </div>
            <div className="hero-card hero-card--front">
              <span className="hero-glow" />
              <span className="hero-mountain" />
              <span className="hero-ground" />
            </div>
            <span className="hero-badge">
              <IconSparkles size={15} />
              本地智能分析
            </span>
          </div>

          <span className="eyebrow">LOCAL-FIRST PHOTO STUDIO</span>
          <h2 className="hero-title">
            把杂乱的相册
            <br />
            交给 Luma
          </h2>
          <p className="hero-copy">
            上传图片，自动分好相册，找出重复、模糊与低质量照片，还能随时放成沉浸幻灯片。画面分析全部在这台设备上完成，云端增强可选且默认关闭。
          </p>

          <div className="hero-actions">
            <button type="button" className="btn btn--primary" onClick={onUpload}>
              <IconImage size={18} />
              选择图片
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => void addDemo()}>
              <IconWand size={17} />
              载入演示相册
            </button>
          </div>

          <ul className="feature-list">
            <li>
              <span className="feature-icon">
                <IconGrid size={18} />
              </span>
              <div>
                <strong>智能分相册</strong>
                <p>人物、风景、美食、夜景、截图、文档，按画面内容自动归类</p>
              </div>
            </li>
            <li>
              <span className="feature-icon">
                <IconSparkles size={18} />
              </span>
              <div>
                <strong>画质体检</strong>
                <p>感知哈希找重复，清晰度、曝光与分辨率逐张评估</p>
              </div>
            </li>
            <li>
              <span className="feature-icon">
                <IconPlay size={17} />
              </span>
              <div>
                <strong>沉浸播放</strong>
                <p>相册一键幻灯片，慢速推镜、自动切页、支持随机播放</p>
              </div>
            </li>
            <li>
              <span className="feature-icon">
                <IconCloud size={18} />
              </span>
              <div>
                <strong>云端智能增强（可选）</strong>
                <p>接入视觉模型生成画面描述、复核归类与清理理由，默认关闭</p>
              </div>
            </li>
          </ul>

          <p className="hero-privacy">
            <IconLock size={14} />
            {settings.enabled
              ? '原图不出本机，仅上传 640px 压缩样张用于云端增强'
              : '图片仅保存在本机浏览器，不会上传'}
          </p>

          <button type="button" className="text-btn" onClick={onOpenCloud}>
            <IconCloud size={15} />
            {settings.enabled ? '云端增强已开启，点此管理' : '了解并开启云端智能增强'}
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="view view--library">
      <header className="page-head">
        <div className="page-head-row">
          <div>
            <span className="eyebrow">LUMA LIBRARY</span>
            <h1 className="page-title">图库</h1>
            <p className="page-sub">
              {photos.length} 张照片 · {formatBytes(totalBytes)}
            </p>
          </div>
          <div className="head-actions">
            <button
              type="button"
              className={`icon-btn ${settings.enabled ? 'is-active' : ''}`}
              onClick={onOpenCloud}
              aria-label="云端智能增强"
            >
              <IconCloud size={19} />
            </button>
            <button type="button" className="icon-btn" onClick={onPlay} aria-label="播放全部照片">
              <IconPlay size={19} />
            </button>
            <button
              type="button"
              className={`text-btn ${selectMode ? 'is-active' : ''}`}
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            >
              {selectMode ? '取消' : '选择'}
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--subtle"
              onClick={onOpenVersion}
              title={`版本说明 v${APP_VERSION}`}
              aria-label={`版本说明 v${APP_VERSION}`}
            >
              <IconInfo size={17} />
            </button>
          </div>
        </div>
      </header>

      <section className="insight">
        <div className="insight-head">
          <span className="insight-mark">
            <IconSparkles size={18} />
          </span>
          <div className="insight-heading">
            <strong>智能整理</strong>
            <span>
              {photos.filter((photo) => photo.analyzed).length === photos.length
                ? '全部照片已完成画面分析'
                : '正在分析新加入的照片'}
            </span>
          </div>
          <button type="button" className="pill-btn" onClick={onOpenCleanup}>
            清理建议
            <IconChevronRight size={14} />
          </button>
        </div>

        <div className="insight-stats">
          <div>
            <strong>{stats.albumCount}</strong>
            <span>智能相册</span>
          </div>
          <div>
            <strong>{cleanup.recommendedCount}</strong>
            <span>建议清理</span>
          </div>
          <div>
            <strong>{formatBytes(cleanup.reclaimableBytes, 0)}</strong>
            <span>可释放</span>
          </div>
        </div>

        <div className="storage">
          <div className="storage-bar" aria-hidden="true">
            {stats.segments.map((segment) => (
              <span
                key={segment.album}
                style={{
                  width: `${segment.percent}%`,
                  background: ALBUM_MAP[segment.album].color,
                }}
              />
            ))}
          </div>
          <div className="storage-legend">
            {stats.segments.slice(0, 3).map((segment) => (
              <span key={segment.album}>
                <i style={{ background: ALBUM_MAP[segment.album].color }} />
                {ALBUM_MAP[segment.album].name}
              </span>
            ))}
            <span className="storage-total">{formatBytes(totalBytes, 0)}</span>
          </div>
        </div>
      </section>

      <form
        className="search-bar"
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <span className="search-icon" aria-hidden="true">
          {searching ? <IconSpinner size={16} /> : <IconSearch size={17} />}
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={enhancedCount ? '描述画面，如“海边日落”' : '按文件名、标签或相册搜索'}
          aria-label="搜索照片"
        />
        {query && (
          <button
            type="button"
            className="text-btn text-btn--sm"
            onClick={() => setQuery('')}
          >
            清除
          </button>
        )}
      </form>

      {query.trim() && (
        <p className="search-hint">
          {searching ? (
            <>
              <IconSearch size={14} />
              正在检索…
            </>
          ) : searchMode === 'semantic' ? (
            <>
              <IconSparkles size={14} />
              语义 + 关键词匹配到 {visiblePhotos.length} 张
            </>
          ) : (
            <>
              <IconSearch size={14} />
              关键词匹配到 {visiblePhotos.length} 张
              {settings.enabled && !enhancedCount ? ' · 增强后语义搜索更准' : ''}
            </>
          )}
        </p>
      )}

      <div className="section-head">
        <h2>{query.trim() ? '搜索结果' : '所有照片'}</h2>
        <span>{query.trim() ? `${visiblePhotos.length} 张` : '按拍摄时间排序'}</span>
      </div>

      <PhotoGrid
        photos={visiblePhotos}
        onOpen={(index) => onOpenPhoto(visibleIds, index)}
        selectable={selectMode}
        selected={selected}
        onToggle={toggleSelect}
        empty={<p className="search-empty">没有匹配的照片，换个说法试试</p>}
      />

      {selectMode && (
        <div className="action-dock">
          <div className="action-dock-info">
            <strong>{selected.size ? `已选 ${selected.size} 张` : '选择要处理的照片'}</strong>
            <span>{selected.size ? formatBytes(selectedBytes) : '轻点照片进行多选'}</span>
          </div>
          <button
            type="button"
            className="dock-icon"
            aria-label="全选"
            onClick={() => setSelected(new Set(ids))}
          >
            <IconSelectAll size={19} />
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            disabled={!selected.size}
            onClick={() => setConfirmOpen(true)}
          >
            删除
          </button>
        </div>
      )}

      {!selectMode && photos.some((photo) => photo.favorite) && (
        <p className="favorites-note">
          <IconHeart size={14} filled />
          收藏的照片会保留在详情页，方便随时回看
        </p>
      )}

      {confirmOpen && (
        <ConfirmSheet
          title={`删除 ${selected.size} 张照片？`}
          description={`将从本机图库移除这些照片并释放 ${formatBytes(selectedBytes)}，此操作无法撤销。`}
          confirmText="确认删除"
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            void removePhotos([...selected])
            setSelected(new Set())
            setSelectMode(false)
          }}
        />
      )}
    </div>
  )
}
