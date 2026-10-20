import { useEffect, useMemo, useState } from 'react'
import { AlbumsView } from './components/AlbumsView'
import { CleanupView } from './components/CleanupView'
import { CloudSheet } from './components/CloudSheet'
import { IconSpinner } from './components/Icons'
import { LibraryView } from './components/LibraryView'
import { Slideshow } from './components/Slideshow'
import { TabBar } from './components/TabBar'
import { Toast } from './components/Toast'
import { UploadSheet } from './components/UploadSheet'
import { Viewer } from './components/Viewer'
import { buildCleanupPlan } from './lib/cleanup'
import { useLibrary } from './lib/library'
import type { AlbumId, TabId } from './lib/types'
import { ALBUM_MAP } from './lib/types'

interface ViewerState {
  ids: string[]
  index: number
  title: string
}

interface SlideshowState extends ViewerState {}

function Shell() {
  const { photos, ready, progress, enhanceProgress } = useLibrary()
  const [tab, setTab] = useState<TabId>('library')
  const [albumId, setAlbumId] = useState<AlbumId | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [slideshow, setSlideshow] = useState<SlideshowState | null>(null)
  const [cloudOpen, setCloudOpen] = useState(false)

  const cleanup = useMemo(() => buildCleanupPlan(photos), [photos])
  const allIds = useMemo(() => photos.map((photo) => photo.id), [photos])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [tab, albumId])

  const changeTab = (next: TabId) => {
    setAlbumId(null)
    setTab(next)
  }

  const playAll = () => {
    if (!photos.length) return
    setSlideshow({ ids: allIds, index: 0, title: '全部照片' })
    setViewer(null)
  }

  return (
    <div className="app">
      <div className="app-glow" aria-hidden="true" />
      <div className="app-grain" aria-hidden="true" />

      <main className="app-main">
        {!ready ? (
          <div className="boot">
            <span className="wordmark">
              Luma<span className="wordmark-dot" />
            </span>
            <span className="boot-loader">
              <IconSpinner size={18} />
              正在打开本地图库
            </span>
          </div>
        ) : tab === 'library' ? (
          <LibraryView
            cleanup={cleanup}
            onOpenCleanup={() => changeTab('cleanup')}
            onUpload={() => setUploadOpen(true)}
            onPlay={playAll}
            onOpenCloud={() => setCloudOpen(true)}
            onOpenPhoto={(ids, index) => setViewer({ ids, index, title: '图库' })}
          />
        ) : tab === 'albums' ? (
          <AlbumsView
            albumId={albumId}
            onOpenAlbum={(id) => setAlbumId(id)}
            onBack={() => setAlbumId(null)}
            onOpenPhoto={(ids, index) =>
              setViewer({ ids, index, title: albumId ? ALBUM_MAP[albumId].name : '相册' })
            }
            onPlay={(ids, index) =>
              setSlideshow({
                ids,
                index,
                title: albumId ? ALBUM_MAP[albumId].name : '相册',
              })
            }
            onUpload={() => setUploadOpen(true)}
          />
        ) : (
          <CleanupView
            cleanup={cleanup}
            onOpenPhoto={(ids, index) => setViewer({ ids, index, title: '清理建议' })}
            onUpload={() => setUploadOpen(true)}
            onGoLibrary={() => changeTab('library')}
            onOpenCloud={() => setCloudOpen(true)}
          />
        )}
      </main>

      <TabBar
        active={tab}
        cleanupCount={cleanup.recommendedCount}
        hasPhotos={photos.length > 0}
        onChange={changeTab}
        onUpload={() => setUploadOpen(true)}
        onSlideshow={playAll}
      />

      {progress && (
        <div className="analysis-pill" role="status" aria-live="polite">
          <IconSpinner size={16} />
          <span>
            智能分析中 {progress.done}/{progress.total}
          </span>
          <span className="analysis-bar" aria-hidden="true">
            <span
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </span>
        </div>
      )}

      {!progress && enhanceProgress && (
        <div className="analysis-pill analysis-pill--cloud" role="status" aria-live="polite">
          <IconSpinner size={16} />
          <span>
            云端增强中 {enhanceProgress.done}/{enhanceProgress.total}
          </span>
          <span className="analysis-bar" aria-hidden="true">
            <span
              style={{
                width: `${
                  enhanceProgress.total
                    ? (enhanceProgress.done / enhanceProgress.total) * 100
                    : 0
                }%`,
              }}
            />
          </span>
        </div>
      )}

      <Toast />

      {uploadOpen && <UploadSheet onClose={() => setUploadOpen(false)} />}

      {cloudOpen && <CloudSheet onClose={() => setCloudOpen(false)} />}

      {viewer && (
        <Viewer
          ids={viewer.ids}
          startIndex={viewer.index}
          title={viewer.title}
          onClose={() => setViewer(null)}
          onPlaySlideshow={(ids, index) => {
            setViewer(null)
            setSlideshow({ ids, index, title: viewer.title })
          }}
        />
      )}

      {slideshow && (
        <Slideshow
          ids={slideshow.ids}
          startIndex={slideshow.index}
          title={slideshow.title}
          onClose={() => setSlideshow(null)}
        />
      )}
    </div>
  )
}

export default Shell
