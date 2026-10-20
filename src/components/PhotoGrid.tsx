import type { ReactNode } from 'react'
import { detectIssues } from '../lib/analysis'
import { cx } from '../lib/format'
import { useLibrary } from '../lib/library'
import type { PhotoMeta } from '../lib/types'
import { IconCheck, IconHeart, IconSpinner } from './Icons'

interface PhotoGridProps {
  photos: PhotoMeta[]
  onOpen: (index: number) => void
  selectable?: boolean
  selected?: Set<string>
  onToggle?: (id: string) => void
  empty?: ReactNode
}

export function PhotoGrid({
  photos,
  onOpen,
  selectable = false,
  selected,
  onToggle,
  empty,
}: PhotoGridProps) {
  const { urlFor } = useLibrary()

  if (!photos.length) return <>{empty}</>

  return (
    <div className="photo-grid">
      {photos.map((photo, index) => {
        const isSelected = selected?.has(photo.id) ?? false
        const issues = photo.analyzed ? detectIssues(photo) : []
        const severe = issues.some((issue) => issue.severity === 'high')
        return (
          <button
            key={photo.id}
            type="button"
            className={cx(
              'tile',
              isSelected && 'is-selected',
              !photo.analyzed && 'is-pending',
            )}
            onClick={() => {
              if (selectable) onToggle?.(photo.id)
              else onOpen(index)
            }}
            aria-label={photo.name}
          >
            {photo.analyzed && urlFor(photo.id) ? (
              <img
                src={urlFor(photo.id)}
                alt={photo.name}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            ) : (
              <span className="tile-skeleton" aria-hidden="true" />
            )}

            {!photo.analyzed && (
              <span className="tile-pending" aria-label="正在分析">
                <IconSpinner size={15} />
              </span>
            )}

            {photo.favorite && photo.analyzed && (
              <span className="tile-favorite" aria-label="已收藏">
                <IconHeart size={12} filled />
              </span>
            )}

            {photo.analyzed && severe && (
              <span className="tile-warning" title="检测到画质问题" aria-label="检测到画质问题">
                !
              </span>
            )}

            {selectable && (
              <span className={cx('tile-check', isSelected && 'is-on')}>
                {isSelected && <IconCheck size={13} />}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
