import { useMemo } from 'react'
import { ALBUMS, ALBUM_MAP } from '../lib/types'
import type { AlbumId, PhotoMeta } from '../lib/types'
import { formatBytes } from '../lib/format'
import { useLibrary } from '../lib/library'
import {
  AlbumIcon,
  IconArrowLeft,
  IconChevronRight,
  IconImage,
  IconPlay,
  IconSparkles,
} from './Icons'
import { PhotoGrid } from './PhotoGrid'

interface AlbumsViewProps {
  albumId: AlbumId | null
  onOpenAlbum: (album: AlbumId) => void
  onBack: () => void
  onOpenPhoto: (ids: string[], index: number) => void
  onPlay: (ids: string[], index: number) => void
  onUpload: () => void
}

function AlbumCover({
  photos,
  color,
  album,
}: {
  photos: PhotoMeta[]
  color: string
  album: AlbumId
}) {
  const { urlFor } = useLibrary()
  const covers = photos.filter((photo) => photo.analyzed).slice(0, 3)

  if (!covers.length) {
    return (
      <div
        className="album-cover album-cover--empty"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${color}42, #121512 72%)`,
        }}
      >
        <AlbumIcon album={album} size={34} />
      </div>
    )
  }

  return (
    <div className={`album-cover album-cover--mosaic mosaic--${covers.length}`}>
      {covers.map((photo) => (
        <img key={photo.id} src={urlFor(photo.id)} alt="" loading="lazy" decoding="async" />
      ))}
      <span className="album-veil" />
    </div>
  )
}

export function AlbumsView({
  albumId,
  onOpenAlbum,
  onBack,
  onOpenPhoto,
  onPlay,
  onUpload,
}: AlbumsViewProps) {
  const { photos } = useLibrary()

  const groups = useMemo(
    () =>
      ALBUMS.map((album) => {
        const items = photos.filter((photo) => photo.albums.includes(album.id))
        return {
          album,
          photos: items,
          bytes: items.reduce((sum, photo) => sum + photo.size, 0),
        }
      }),
    [photos],
  )

  if (albumId) {
    const meta = ALBUM_MAP[albumId]
    const items = photos.filter((photo) => photo.albums.includes(albumId))
    const ids = items.map((photo) => photo.id)
    const bytes = items.reduce((sum, photo) => sum + photo.size, 0)

    return (
      <div className="view view--album-detail">
        <header className="detail-head">
          <button type="button" className="icon-btn" onClick={onBack} aria-label="返回相册">
            <IconArrowLeft size={20} />
          </button>
          <div className="detail-heading">
            <span className="eyebrow" style={{ color: meta.color }}>
              {meta.tagline}
            </span>
            <h1 className="page-title">{meta.name}</h1>
            <p className="page-sub">
              {items.length} 张 · {formatBytes(bytes)}
            </p>
          </div>
          <button
            type="button"
            className="play-fab"
            onClick={() => onPlay(ids, 0)}
            disabled={!items.length}
            aria-label={`播放${meta.name}幻灯片`}
          >
            <IconPlay size={19} />
          </button>
        </header>

        <div className="album-note">
          <IconSparkles size={15} />
          <span>依据画面色彩与内容自动归类，一张照片可同时属于多个相册</span>
        </div>

        <PhotoGrid
          photos={items}
          onOpen={(index) => onOpenPhoto(ids, index)}
          empty={
            <div className="inline-empty">
              <span className="inline-empty-icon">
                <AlbumIcon album={albumId} size={28} />
              </span>
              <h3>这个相册还是空的</h3>
              <p>加入更多照片，Luma 会自动识别并归类到这里。</p>
              <button type="button" className="btn btn--ghost btn--sm" onClick={onUpload}>
                <IconImage size={16} />
                添加照片
              </button>
            </div>
          }
        />
      </div>
    )
  }

  const populated = groups.filter((group) => group.photos.length > 0)

  return (
    <div className="view view--albums">
      <header className="page-head">
        <span className="eyebrow">SMART ALBUMS</span>
        <h1 className="page-title">相册</h1>
        <p className="page-sub">
          {populated.length ? `${populated.length} 个智能相册已生成` : '上传照片后自动生成相册'}
        </p>
      </header>

      {photos.length === 0 ? (
        <div className="inline-empty inline-empty--page">
          <span className="inline-empty-icon">
            <IconSparkles size={28} />
          </span>
          <h3>还没有可归类的照片</h3>
          <p>加入照片后，Luma 会按人物、风景、美食、夜景、截图与文档自动整理。</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={onUpload}>
            <IconImage size={16} />
            添加照片
          </button>
        </div>
      ) : (
        <>
          <div className="album-grid">
            {groups.map((group) => (
              <button
                key={group.album.id}
                type="button"
                className={`album-card ${group.photos.length ? '' : 'is-empty'}`}
                onClick={() => onOpenAlbum(group.album.id)}
              >
                <AlbumCover
                  photos={group.photos}
                  color={group.album.color}
                  album={group.album.id}
                />
                <span className="album-count">
                  {group.photos.length}
                  <small>张</small>
                </span>
                <div className="album-info">
                  <span className="album-dot" style={{ background: group.album.color }} />
                  <div>
                    <strong>{group.album.name}</strong>
                    <span>{group.photos.length ? group.album.tagline : '等待照片'}</span>
                  </div>
                  <IconChevronRight size={17} />
                </div>
              </button>
            ))}
          </div>

          <div className="tip-card">
            <span className="tip-icon">
              <IconSparkles size={18} />
            </span>
            <div>
              <strong>归类会持续学习</strong>
              <p>新照片加入时自动识别，同一张照片可归入多个相册；若归类不准确，打开照片详情即可调整。</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
