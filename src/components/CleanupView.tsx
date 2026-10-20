import { useEffect, useMemo, useState } from 'react'
import type { CleanupPlan } from '../lib/cleanup'
import { formatBytes, formatDate, cx } from '../lib/format'
import { useLibrary } from '../lib/library'
import { useSettings } from '../lib/settings'
import { ConfirmSheet } from './ConfirmSheet'
import {
  IconCheck,
  IconChevronRight,
  IconCloud,
  IconImage,
  IconSparkles,
  IconSpinner,
  IconTrash,
  IconWand,
} from './Icons'

interface CleanupViewProps {
  cleanup: CleanupPlan
  onOpenPhoto: (ids: string[], index: number) => void
  onUpload: () => void
  onGoLibrary: () => void
  onOpenCloud: () => void
}

export function CleanupView({
  cleanup,
  onOpenPhoto,
  onUpload,
  onGoLibrary,
  onOpenCloud,
}: CleanupViewProps) {
  const { photos, removePhotos, enhance, enhanceProgress, enhancedCount, pendingEnhanceCount } =
    useLibrary()
  const { settings, status } = useSettings()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmMode, setConfirmMode] = useState<'all' | 'selected' | null>(null)

  const validIds = useMemo(() => new Set(photos.map((photo) => photo.id)), [photos])
  useEffect(() => {
    setSelected((previous) => {
      const next = new Set([...previous].filter((id) => validIds.has(id)))
      return next.size === previous.size ? previous : next
    })
  }, [validIds])

  const issueCounts = useMemo(() => {
    const counts = { blurry: 0, exposure: 0, lowres: 0 }
    cleanup.issuePhotos.forEach(({ issues }) => {
      if (issues.some((issue) => issue.type === 'blurry')) counts.blurry += 1
      if (issues.some((issue) => issue.type === 'dark' || issue.type === 'overexposed')) {
        counts.exposure += 1
      }
      if (issues.some((issue) => issue.type === 'lowres')) counts.lowres += 1
    })
    return counts
  }, [cleanup.issuePhotos])

  const duplicateGroupCount = useMemo(
    () => cleanup.groups.filter((group) => group.kind === 'duplicate').length,
    [cleanup.groups],
  )

  const selectedBytes = photos
    .filter((photo) => selected.has(photo.id))
    .reduce((sum, photo) => sum + photo.size, 0)

  const toggle = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const suggestAll = () => setSelected(new Set(cleanup.suggestedIds))

  if (!photos.length) {
    return (
      <div className="view view--cleanup">
        <header className="page-head">
          <span className="eyebrow">PHOTO CARE</span>
          <h1 className="page-title">清理建议</h1>
          <p className="page-sub">本地检测重复、模糊与低质量照片</p>
        </header>
        <div className="inline-empty inline-empty--page">
          <span className="inline-empty-icon">
            <IconWand size={28} />
          </span>
          <h3>先添加一些照片</h3>
          <p>Luma 会逐张检查清晰度、曝光、分辨率，并找出重复与相似的照片。</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={onUpload}>
            <IconImage size={16} />
            添加照片
          </button>
        </div>
      </div>
    )
  }

  if (!cleanup.recommendedCount) {
    return (
      <div className="view view--cleanup">
        <header className="page-head">
          <span className="eyebrow">PHOTO CARE</span>
          <h1 className="page-title">清理建议</h1>
          <p className="page-sub">本地检测重复、模糊与低质量照片</p>
        </header>
        <div className="clean-empty">
          <span className="clean-check">
            <IconCheck size={30} />
          </span>
          <span className="eyebrow">ALL CLEAR</span>
          <h2>相册状态很好</h2>
          <p>没有发现明显的重复、模糊或曝光问题。继续享受你的照片吧。</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onGoLibrary}>
            返回图库
          </button>
        </div>
      </div>
    )
  }

  const issueIds = cleanup.issuePhotos.map((entry) => entry.photo.id)

  return (
    <div className="view view--cleanup">
      <header className="page-head">
        <span className="eyebrow">PHOTO CARE</span>
        <h1 className="page-title">清理建议</h1>
        <p className="page-sub">本地分析完成 · 删除前由你确认</p>
      </header>

      <section className="reclaim">
        <div className="reclaim-copy">
          <span className="eyebrow">RECLAIMABLE</span>
          <strong className="reclaim-value">{formatBytes(cleanup.reclaimableBytes)}</strong>
          <p>{cleanup.recommendedCount} 张照片存在重复或画质问题</p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setConfirmMode('all')}
        >
          <IconSparkles size={17} />
          一键清理建议
        </button>
        <div className="reclaim-metrics">
          <span>
            <strong>{duplicateGroupCount}</strong>
            组重复
          </span>
          <span>
            <strong>{issueCounts.blurry}</strong>
            张模糊
          </span>
          <span>
            <strong>{issueCounts.exposure}</strong>
            张曝光异常
          </span>
          <span>
            <strong>{issueCounts.lowres}</strong>
            张低分辨率
          </span>
        </div>
      </section>

      <section className="clean-section clean-section--cloud">
        <div className="cloud-review">
          <span className="cloud-review-mark">
            <IconCloud size={17} />
          </span>
          <div className="cloud-review-text">
            <strong>模型复核建议</strong>
            <small>
              {settings.enabled && status.configured
                ? `${enhancedCount} 张已有模型点评${pendingEnhanceCount ? `，${pendingEnhanceCount} 张待复核` : ''}`
                : '开启云端增强后，模型会逐张解释画质问题与保留理由'}
            </small>
          </div>
          {settings.enabled && status.configured ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={Boolean(enhanceProgress) || !cleanup.recommendedCount}
              onClick={() => void enhance(cleanup.suggestedIds)}
            >
              {enhanceProgress ? <IconSpinner size={15} /> : <IconSparkles size={15} />}
              {enhanceProgress ? '复核中' : '复核问题照片'}
            </button>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenCloud}>
              去开启
            </button>
          )}
        </div>
      </section>

      {cleanup.groups.length > 0 && (
        <section className="clean-section">
          <div className="section-head">
            <h2>重复与相似</h2>
            <span>{cleanup.groups.length} 组</span>
          </div>
          {cleanup.groups.map((group) => {
            const rest = group.photos.filter((photo) => photo.id !== group.keeperId)
            const restIds = rest.map((photo) => photo.id)
            const allSelected = restIds.every((id) => selected.has(id))
            return (
              <article className="dup-card" key={group.key}>
                <header className="dup-head">
                  <div>
                    <span className={`tag tag--${group.kind}`}>
                      {group.kind === 'duplicate' ? '重复' : '相似'}
                    </span>
                    <strong>{group.photos.length} 张画面相近</strong>
                  </div>
                  <span className="dup-save">可释放 {formatBytes(group.savedBytes)}</span>
                </header>

                <div className="dup-strip">
                  {group.photos.map((photo) => {
                    const keeper = photo.id === group.keeperId
                    const isSelected = selected.has(photo.id)
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        className={cx(
                          'dup-thumb',
                          keeper && 'is-keeper',
                          isSelected && 'is-selected',
                        )}
                        onClick={() => {
                          if (!keeper) toggle(photo.id)
                        }}
                        aria-label={`${photo.name}${keeper ? '，建议保留' : isSelected ? '，已选删除' : '，选择删除'}`}
                      >
                        <Thumb id={photo.id} />
                        <span className="dup-badge">
                          {keeper ? '保留最佳' : isSelected ? '待删除' : '轻点选择'}
                        </span>
                        {!keeper && (
                          <span className={cx('tile-check', isSelected && 'is-on')}>
                            {isSelected && <IconCheck size={12} />}
                          </span>
                        )}
                        <span className="dup-quality">画质 {photo.quality}</span>
                      </button>
                    )
                  })}
                </div>

                {(() => {
                  const keeper = group.photos.find((photo) => photo.id === group.keeperId)
                  return keeper?.insight?.advice ? (
                    <p className="dup-advice">
                      <IconSparkles size={13} />
                      {keeper.insight.advice}
                    </p>
                  ) : null
                })()}

                <footer className="dup-foot">
                  <span>
                    {group.kind === 'duplicate' ? '画面几乎一致' : '构图与色彩高度相似'} · 保留画质最佳的一张
                  </span>
                  <button
                    type="button"
                    className="text-btn text-btn--sm"
                    onClick={() =>
                      setSelected((previous) => {
                        const next = new Set(previous)
                        restIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
                        return next
                      })
                    }
                  >
                    {allSelected ? '取消选择' : `选中其余 ${rest.length} 张`}
                  </button>
                </footer>
              </article>
            )
          })}
        </section>
      )}

      {cleanup.issuePhotos.length > 0 && (
        <section className="clean-section">
          <div className="section-head">
            <h2>画质问题</h2>
            <span>{cleanup.issuePhotos.length} 张</span>
          </div>
          <div className="issue-list">
            {cleanup.issuePhotos.map(({ photo, issues }, index) => {
              const isSelected = selected.has(photo.id)
              return (
                <div
                  key={photo.id}
                  className={cx('issue-row', isSelected && 'is-selected')}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(photo.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggle(photo.id)
                    }
                  }}
                >
                  <span className={cx('issue-check', isSelected && 'is-on')}>
                    {isSelected && <IconCheck size={12} />}
                  </span>
                  <div className="issue-thumb">
                    <Thumb id={photo.id} />
                  </div>
                  <div className="issue-info">
                    <strong>{photo.name}</strong>
                    <div className="issue-chips">
                      {issues.map((issue) => (
                        <span key={issue.type} className={`issue-chip issue-chip--${issue.type}`}>
                          {issue.label}
                        </span>
                      ))}
                      <span className="issue-chip issue-chip--soft">画质 {photo.quality}</span>
                    </div>
                    <span className="issue-meta">
                      {formatDate(photo.takenAt)} · {formatBytes(photo.size)}
                    </span>
                    {photo.insight?.advice && (
                      <span className="issue-advice">
                        <IconSparkles size={12} />
                        {photo.insight.advice}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="issue-open"
                    aria-label={`查看 ${photo.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenPhoto(issueIds, index)
                    }}
                  >
                    <IconChevronRight size={18} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <p className="cleanup-note">
        {enhancedCount
          ? '本地清晰度、曝光与感知哈希负责初筛，模型点评用于复核，删除前请确认重要照片。'
          : '建议基于本地清晰度、曝光与感知哈希计算，删除前请确认重要照片。'}
      </p>

      {selected.size > 0 && (
        <div className="action-dock">
          <div className="action-dock-info">
            <strong>已选 {selected.size} 张</strong>
            <span>释放 {formatBytes(selectedBytes)}</span>
          </div>
          <button type="button" className="text-btn text-btn--sm" onClick={suggestAll}>
            全选建议
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={() => setConfirmMode('selected')}
          >
            <IconTrash size={15} />
            删除
          </button>
        </div>
      )}

      {confirmMode && (
        <ConfirmSheet
          title={
            confirmMode === 'all'
              ? `清理 ${cleanup.recommendedCount} 张照片？`
              : `删除已选的 ${selected.size} 张照片？`
          }
          description={
            confirmMode === 'all'
              ? `将删除重复组中未保留的照片，以及模糊、曝光异常和低分辨率照片，共释放 ${formatBytes(cleanup.reclaimableBytes)}。此操作无法撤销。`
              : `将从本机图库删除已选照片并释放 ${formatBytes(selectedBytes)}。此操作无法撤销。`
          }
          confirmText={confirmMode === 'all' ? '确认清理' : '确认删除'}
          onClose={() => setConfirmMode(null)}
          onConfirm={() => {
            const idsToRemove =
              confirmMode === 'all' ? cleanup.suggestedIds : [...selected]
            void removePhotos(idsToRemove)
            setSelected(new Set())
          }}
        />
      )}
    </div>
  )
}

function Thumb({ id }: { id: string }) {
  const { urlFor } = useLibrary()
  const url = urlFor(id)
  if (!url) return <span className="thumb-skeleton" />
  return <img src={url} alt="" loading="lazy" decoding="async" draggable={false} />
}
