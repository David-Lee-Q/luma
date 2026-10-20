import { useEffect, useMemo, useRef, useState } from 'react'
import { detectIssues } from '../lib/analysis'
import { formatBytes, formatDateTime, formatMegapixel } from '../lib/format'
import { useLibrary } from '../lib/library'
import { useLockBody } from '../lib/useLockBody'
import { ALBUMS, ALBUM_MAP } from '../lib/types'
import type { AlbumId, PhotoMeta } from '../lib/types'
import { ConfirmSheet } from './ConfirmSheet'
import {
  AlbumIcon,
  IconAlbums,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconHeart,
  IconInfo,
  IconPlay,
  IconSparkles,
  IconTrash,
} from './Icons'
import { QualityRing } from './QualityRing'
import { Sheet } from './Sheet'

interface ViewerProps {
  ids: string[]
  startIndex: number
  title: string
  onClose: () => void
  onPlaySlideshow: (ids: string[], index: number) => void
}

export function Viewer({ ids, startIndex, title, onClose, onPlaySlideshow }: ViewerProps) {
  const { photos, urlFor, toggleFavorite, setManualAlbums, removePhotos } = useLibrary()
  const [index, setIndex] = useState(Math.max(0, startIndex))
  const [albumPicker, setAlbumPicker] = useState(false)
  const [draftAlbums, setDraftAlbums] = useState<AlbumId[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useLockBody(true)

  const items = useMemo(() => {
    const map = new Map(photos.map((photo) => [photo.id, photo]))
    return ids
      .map((id) => map.get(id))
      .filter((photo): photo is PhotoMeta => Boolean(photo))
  }, [ids, photos])

  const photo = items[Math.min(index, items.length - 1)]

  useEffect(() => {
    if (!items.length) onClose()
  }, [items.length, onClose])

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, items.length - 1)))
  }, [items.length])

  useEffect(() => {
    closeRef.current?.focus()
    const handler = (event: KeyboardEvent) => {
      if (albumPicker || confirmDelete) return
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(items.length - 1, current + 1))
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(0, current - 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [albumPicker, confirmDelete, items.length, onClose])

  if (!photo) return null

  const url = urlFor(photo.id)
  const issues = detectIssues(photo)
  const photoAlbums = photo.albums.length ? photo.albums : [photo.album]
  const openAlbumPicker = () => {
    setDraftAlbums(photo.manualAlbums.length ? photo.manualAlbums : photoAlbums)
    setAlbumPicker(true)
  }
  const toggleDraftAlbum = (id: AlbumId) => {
    setDraftAlbums((previous) => {
      if (previous.includes(id)) return previous.filter((item) => item !== id)
      if (previous.length >= 3) return previous
      return [...previous, id]
    })
  }
  const goPrev = () => setIndex((current) => Math.max(0, current - 1))
  const goNext = () => setIndex((current) => Math.min(items.length - 1, current + 1))

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`${title}照片查看器`}>
      {url && (
        <div
          className="viewer-backdrop"
          style={{ backgroundImage: `url(${url})` }}
          aria-hidden="true"
        />
      )}

      <header className="viewer-top">
        <button
          type="button"
          className="glass-btn"
          onClick={onClose}
          aria-label="关闭"
          ref={closeRef}
        >
          <IconClose size={20} />
        </button>
        <div className="viewer-counter">
          <strong>{index + 1}</strong>
          <span>/ {items.length}</span>
        </div>
        <button
          type="button"
          className={`glass-btn ${photo.favorite ? 'is-active' : ''}`}
          onClick={() => toggleFavorite(photo.id)}
          aria-label={photo.favorite ? '取消收藏' : '收藏'}
          aria-pressed={photo.favorite}
        >
          <IconHeart size={19} filled={photo.favorite} />
        </button>
      </header>

      <div
        className="viewer-stage"
        onTouchStart={(event) => {
          const touch = event.touches[0]
          touchStart.current = { x: touch.clientX, y: touch.clientY }
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          if (!start) return
          const touch = event.changedTouches[0]
          const dx = touch.clientX - start.x
          const dy = touch.clientY - start.y
          touchStart.current = null
          if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            if (dx < 0) goNext()
            else goPrev()
          }
        }}
      >
        {url ? (
          <img className="viewer-image" src={url} alt={photo.name} draggable={false} />
        ) : (
          <div className="viewer-missing">图片不可用</div>
        )}

        {index > 0 && (
          <button type="button" className="stage-nav stage-nav--prev" onClick={goPrev} aria-label="上一张">
            <IconChevronLeft size={22} />
          </button>
        )}
        {index < items.length - 1 && (
          <button type="button" className="stage-nav stage-nav--next" onClick={goNext} aria-label="下一张">
            <IconChevronRight size={22} />
          </button>
        )}
      </div>

      <section className="viewer-panel">
        <div className="viewer-main">
          <div className="viewer-title">
            <div>
              <h2>{photo.name}</h2>
              <p>
                {formatDateTime(photo.takenAt)} · {photo.width}×{photo.height} ·{' '}
                {formatBytes(photo.size)}
              </p>
            </div>
            {photo.analyzed && <QualityRing score={photo.quality} size={54} />}
          </div>

          <div className="viewer-chips">
            {photoAlbums.map((albumId, position) => (
              <span className="album-chip" key={albumId}>
                <i style={{ background: ALBUM_MAP[albumId].color }} />
                {ALBUM_MAP[albumId].name}
                {position === 0 && photo.manualAlbums.length > 0 && <small>手动</small>}
                {position === 0 &&
                  !photo.manualAlbums.length &&
                  photo.albumSource === 'cloud' && <small>AI 判定</small>}
              </span>
            ))}
            {issues.map((issue) => (
              <span key={issue.type} className={`issue-chip issue-chip--${issue.type}`}>
                {issue.label}
              </span>
            ))}
            <span className="issue-chip issue-chip--soft">
              {formatMegapixel(photo.width, photo.height)}
            </span>
            {!photo.analyzed && <span className="issue-chip issue-chip--soft">正在分析</span>}
          </div>

          {photo.insight && (
            <div className="insight-card">
              <div className="insight-card-head">
                <span className="insight-card-mark">
                  <IconSparkles size={14} />
                </span>
                <strong>模型描述</strong>
                <span className="insight-card-model">{photo.insight.model}</span>
              </div>
              <p className="insight-card-desc">{photo.insight.desc}</p>
              {photo.insight.tags.length > 0 && (
                <div className="insight-card-tags">
                  {photo.insight.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
              {photo.insight.advice && (
                <p className="insight-card-advice">
                  <IconInfo size={14} />
                  {photo.insight.advice}
                </p>
              )}
            </div>
          )}

          <div className="viewer-actions">
            <button
              type="button"
              className={`viewer-action ${photo.favorite ? 'is-active' : ''}`}
              onClick={() => toggleFavorite(photo.id)}
            >
              <IconHeart size={19} filled={photo.favorite} />
              <span>{photo.favorite ? '已收藏' : '收藏'}</span>
            </button>
            <button type="button" className="viewer-action" onClick={openAlbumPicker}>
              <IconAlbums size={19} />
              <span>归类相册</span>
            </button>
            <button
              type="button"
              className="viewer-action"
              onClick={() => onPlaySlideshow(items.map((item) => item.id), index)}
            >
              <IconPlay size={18} />
              <span>幻灯片</span>
            </button>
            <button
              type="button"
              className="viewer-action viewer-action--danger"
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash size={19} />
              <span>删除</span>
            </button>
          </div>
        </div>
      </section>

      {albumPicker && (
        <Sheet onClose={() => setAlbumPicker(false)} label="选择相册">
          <header className="sheet-head">
            <div>
              <span className="eyebrow">ALBUMS</span>
              <h2>归入相册</h2>
              <p className="sheet-sub">一张照片可以同时出现在多个相册，最多选 3 个</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setAlbumPicker(false)}
              aria-label="关闭"
            >
              <IconClose size={19} />
            </button>
          </header>
          <div className="album-picker">
            {ALBUMS.map((item) => {
              const checked = draftAlbums.includes(item.id)
              const auto = !photo.manualAlbums.length && photoAlbums.includes(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`album-pick album-pick--multi ${checked ? 'is-current' : ''}`}
                  aria-pressed={checked}
                  onClick={() => toggleDraftAlbum(item.id)}
                >
                  <span className="album-pick-icon" style={{ color: item.color }}>
                    <AlbumIcon album={item.id} size={21} />
                  </span>
                  <span className="album-pick-text">
                    <strong>{item.name}</strong>
                    <small>{item.tagline}</small>
                  </span>
                  {checked ? (
                    <span className="album-pick-tag">{auto && !photo.manualAlbums.length ? '自动' : '已选'}</span>
                  ) : (
                    <span className="album-pick-plus" aria-hidden="true">
                      +
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="sheet-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setManualAlbums(photo.id, [])
                setAlbumPicker(false)
              }}
            >
              恢复自动整理
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!draftAlbums.length}
              onClick={() => {
                setManualAlbums(photo.id, draftAlbums)
                setAlbumPicker(false)
              }}
            >
              保存（{draftAlbums.length}）
            </button>
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title="删除这张照片？"
          description={`「${photo.name}」将从本机图库移除并释放 ${formatBytes(photo.size)}，此操作无法撤销。`}
          confirmText="确认删除"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            void removePhotos([photo.id])
          }}
        />
      )}
    </div>
  )
}
