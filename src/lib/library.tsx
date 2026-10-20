import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { classifyPhoto, computeQuality, detectIssues } from './analysis'
import { analyzer } from './analyzerClient'
import {
  albumLabel,
  cosineSimilarity,
  createLimiter,
  embedTexts,
  enhancePhotoBatch,
  expandQuery,
  rerankPhotos,
  CloudError,
} from './cloud'
import {
  clearVectors,
  deletePhotos as deletePhotosFromDb,
  loadLibrary,
  loadVectors,
  saveMeta,
  saveMetas,
  savePhoto,
  saveVectors,
} from './db'
import { generateDemoPhotos } from './demo'
import { readExifDate } from './exif'
import { createId, formatBytes } from './format'
import {
  COS_ABS_MIN,
  LEXICAL_MIN,
  LEXICAL_STRONG,
  MAX_RESULTS,
  RERANK_MIN,
  albumHitScore,
  inCosineWindow,
  inRerankWindow,
  isRelevantQuery,
  lexicalScore,
  rankScore,
  tokenize,
} from './search'
import { useSettings } from './settings'
import type {
  AlbumId,
  AlbumSource,
  CloudInsight,
  PhotoMeta,
  ToastMessage,
  ToastTone,
} from './types'

interface Progress {
  total: number
  done: number
  failed: number
}

export interface LibraryContextValue {
  photos: PhotoMeta[]
  ready: boolean
  progress: Progress | null
  enhanceProgress: Progress | null
  toast: ToastMessage | null
  notify: (text: string, tone?: ToastTone) => void
  addFiles: (files: File[]) => Promise<void>
  addDemo: () => Promise<void>
  removePhotos: (ids: string[]) => Promise<void>
  setManualAlbums: (id: string, albums: AlbumId[]) => void
  toggleFavorite: (id: string) => void
  urlFor: (id: string) => string | undefined
  totalBytes: number
  enhancedCount: number
  pendingEnhanceCount: number
  enhance: (ids?: string[]) => Promise<void>
  clearCloudData: () => Promise<void>
  searchPhotos: (query: string) => Promise<{ ids: string[]; mode: 'semantic' | 'local' }>
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

function sortPhotos(photos: PhotoMeta[]): PhotoMeta[] {
  return [...photos].sort((a, b) => b.takenAt - a.takenAt || b.addedAt - a.addedAt)
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(file.name)
}

function emptyStats() {
  return {
    hash: '',
    fingerprint: '',
    brightness: 0,
    contrast: 0,
    saturation: 0,
    colorfulness: 0,
    sharpness: 0,
    edgeDensity: 0,
    whiteRatio: 0,
    greenRatio: 0,
    blueRatio: 0,
    warmRatio: 0,
    skinRatio: 0,
    centerSkinRatio: 0,
    darkRatio: 0,
    skyRatio: 0,
    palette: ['#242822'],
    dominant: '#242822',
  }
}

function uniqueAlbums(albums: AlbumId[]): AlbumId[] {
  return albums.filter((album, index) => albums.indexOf(album) === index)
}

interface ResolvedAlbums {
  albums: AlbumId[]
  album: AlbumId
  albumConfidence: number
  albumSource: AlbumSource
}

/** 归类优先级：手动 > 云端（置信度足够）> 本地自动，且都支持多标签。 */
function resolveAlbums(photo: PhotoMeta, insight: CloudInsight | undefined): ResolvedAlbums {
  const manual = uniqueAlbums(photo.manualAlbums ?? [])
  if (manual.length) {
    return {
      albums: manual,
      album: manual[0],
      albumConfidence: 1,
      albumSource: 'manual',
    }
  }
  const cloud = insight ? uniqueAlbums(insight.albums?.length ? insight.albums : photo.albums) : []
  if (cloud.length && insight && insight.albumConfidence >= 0.5) {
    return {
      albums: cloud,
      album: cloud[0],
      albumConfidence: insight.albumConfidence,
      albumSource: 'cloud',
    }
  }
  const local = uniqueAlbums(photo.localAlbums?.length ? photo.localAlbums : [photo.localAlbum])
  return {
    albums: local,
    album: local[0],
    albumConfidence: photo.albumConfidence,
    albumSource: 'local',
  }
}

function withResolvedAlbums(photo: PhotoMeta, insight = photo.insight): PhotoMeta {
  return { ...photo, ...resolveAlbums(photo, insight) }
}

function photoWeakText(photo: PhotoMeta): string {
  return [
    photo.name,
    photo.insight?.desc ?? '',
    ...(photo.insight?.tags ?? []),
    ...photo.albums.map(albumLabel),
  ]
    .filter(Boolean)
    .join(' ')
}

/** 语义索引文本：只保留模型描述与关键词，避免文件名噪声稀释向量。 */
function photoEmbedText(photo: PhotoMeta): string {
  return [photo.insight?.desc ?? '', ...(photo.insight?.tags ?? [])].filter(Boolean).join(' ')
}

function photoStrongText(photo: PhotoMeta): string {
  return [...(photo.insight?.tags ?? []), ...photo.albums.map(albumLabel)]
    .filter(Boolean)
    .join(' ')
}

function issueLabels(photo: PhotoMeta): string[] {
  if (!photo.analyzed) return []
  return detectIssues(photo).map((issue) => issue.label)
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const settingsRef = useRef(settings)
  const [photos, setPhotos] = useState<PhotoMeta[]>([])
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [enhanceProgress, setEnhanceProgress] = useState<Progress | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const urls = useRef(new Map<string, string>())
  const cancelled = useRef(new Set<string>())
  const toastTimer = useRef<number | null>(null)
  const photosRef = useRef<PhotoMeta[]>([])
  const vectorsRef = useRef<Map<string, number[]>>(new Map())
  const vectorsLoaded = useRef(false)
  const limiter = useRef(createLimiter(2))

  const notify = useCallback((text: string, tone: ToastTone = 'default') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), text, tone })
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    let active = true
    loadLibrary()
      .then((stored) => {
        if (!active) return
        stored.forEach(({ meta, blob }) => {
          urls.current.set(meta.id, URL.createObjectURL(blob))
        })
        setPhotos(sortPhotos(stored.map((entry) => entry.meta)))
      })
      .catch(() => {
        if (active) notify('本地图库读取失败，请刷新重试', 'warning')
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [notify])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  const urlFor = useCallback((id: string) => urls.current.get(id), [])

  const mergePhoto = useCallback((updated: PhotoMeta) => {
    setPhotos((previous) =>
      sortPhotos(previous.map((photo) => (photo.id === updated.id ? updated : photo))),
    )
  }, [])

  const enhance = useCallback(
    async (ids?: string[]) => {
      if (!settingsRef.current.enabled) {
        notify('请先开启云端智能增强', 'warning')
        return
      }
      const scoped = ids?.length
        ? photosRef.current.filter((photo) => ids.includes(photo.id))
        : photosRef.current
      const targets = scoped.filter((photo) => photo.analyzed && !photo.insight)
      if (!targets.length) {
        notify('所选照片都已完成智能增强', 'default')
        return
      }

      const batches: PhotoMeta[][] = []
      for (let start = 0; start < targets.length; start += 4) {
        batches.push(targets.slice(start, start + 4))
      }

      setEnhanceProgress({ total: targets.length, done: 0, failed: 0 })
      let done = 0
      let failed = 0
      let lastError: string | null = null
      const fresh: PhotoMeta[] = []

      await Promise.all(
        batches.map((batch) =>
          limiter.current(async () => {
            try {
              const inputs = await Promise.all(
                batch.map(async (photo) => {
                  const objectUrl = urls.current.get(photo.id)
                  if (!objectUrl) throw new CloudError('原图数据不可用')
                  const blob = await fetch(objectUrl).then((response) => response.blob())
                  return {
                    blob,
                    name: photo.name,
                    localAlbumName: albumLabel(photo.localAlbum),
                    quality: photo.quality,
                    issues: issueLabels(photo),
                  }
                }),
              )
              const insights = await enhancePhotoBatch(inputs)
              for (let index = 0; index < batch.length; index += 1) {
                const photo = batch[index]
                const insight = insights[index]
                if (!insight) {
                  failed += 1
                  continue
                }
                if (cancelled.current.has(photo.id)) continue
                const updated = withResolvedAlbums({ ...photo, insight })
                await saveMeta(updated)
                mergePhoto(updated)
                fresh.push(updated)
                done += 1
              }
            } catch (error) {
              failed += batch.length
              lastError = error instanceof Error ? error.message : '智能增强失败'
            } finally {
              setEnhanceProgress({ total: targets.length, done: done + failed, failed })
            }
          }),
        ),
      )

      let vectorFailed = false
      if (fresh.length) {
        for (let start = 0; start < fresh.length; start += 32) {
          const chunk = fresh.slice(start, start + 32)
          try {
            const vectors = await embedTexts(
              chunk.map((photo) => photoEmbedText(photo) || photo.name),
            )
            const entries = chunk
              .map((photo, index) => ({ id: photo.id, vector: vectors[index] }))
              .filter((entry) => Array.isArray(entry.vector) && entry.vector.length > 0)
            if (entries.length) {
              entries.forEach((entry) => vectorsRef.current.set(entry.id, entry.vector))
              await saveVectors(entries)
            }
          } catch {
            vectorFailed = true
          }
        }
      }

      setEnhanceProgress(null)

      if (failed && !done) {
        notify(lastError ?? '智能增强失败，请稍后重试', 'warning')
        return
      }
      if (failed) {
        notify(`已增强 ${done} 张，${failed} 张失败`, 'warning')
      } else {
        notify(`已完成 ${done} 张照片的云端智能增强`, 'success')
      }
      if (vectorFailed) notify('描述已保存，语义搜索索引暂未建立成功', 'warning')
    },
    [mergePhoto, notify],
  )

  const clearCloudData = useCallback(async () => {
    const affected = photosRef.current.filter((photo) => photo.insight)
    if (!affected.length) {
      notify('暂无云端增强数据', 'default')
      return
    }
    const restored = affected.map((photo) => {
      const { insight: _dropped, ...rest } = photo
      return withResolvedAlbums(rest as PhotoMeta, undefined)
    })
    await saveMetas(restored)
    await clearVectors()
    vectorsRef.current.clear()
    setPhotos((previous) =>
      sortPhotos(previous.map((photo) => restored.find((item) => item.id === photo.id) ?? photo)),
    )
    notify('已清除云端增强数据，照片恢复为本地判定', 'success')
  }, [notify])

  /**
   * 三路融合检索：文本模型抽关键词与类别、向量召回、重排打分，再叠加本地词法匹配。
   * 云端不可用时自动退化为纯词法匹配，保证离线也能搜。
   */
  const searchPhotos = useCallback(
    async (query: string): Promise<{ ids: string[]; mode: 'semantic' | 'local' }> => {
      const trimmed = query.trim()
      if (!trimmed) return { ids: [], mode: 'local' }
      const photos = photosRef.current
      const remote = settingsRef.current.enabled

      const [plan, queryVector] = await Promise.all([
        remote ? expandQuery(trimmed) : Promise.resolve(null),
        remote
          ? embedTexts([trimmed]).then((vectors) => vectors[0] ?? null).catch(() => null)
          : Promise.resolve(null),
      ])

      const keywords = plan?.keywords ?? []
      const tokens = [
        ...new Set([...tokenize(trimmed), ...keywords.flatMap((word) => tokenize(word))]),
      ]
      const wantedAlbums = plan?.albums ?? []
      const lexicalOf = (photo: PhotoMeta) =>
        lexicalScore(tokens, photoWeakText(photo), photoStrongText(photo))

      if (remote) {
        if (!vectorsLoaded.current) {
          vectorsRef.current = await loadVectors()
          vectorsLoaded.current = true
        }
        const cosineOf = (photo: PhotoMeta) => {
          const vector = vectorsRef.current.get(photo.id)
          return vector && queryVector ? cosineSimilarity(queryVector, vector) : 0
        }
        const scored = photos.map((photo) => ({
          photo,
          cosine: cosineOf(photo),
          lexical: lexicalOf(photo),
        }))
        const cosineTop = scored.reduce((max, item) => Math.max(max, item.cosine), 0)
        const lexicalTop = scored.reduce((max, item) => Math.max(max, item.lexical), 0)

        if (isRelevantQuery(cosineTop, lexicalTop)) {
          const ranked = scored
            .filter((item) => vectorsRef.current.has(item.photo.id))
            .filter(
              (item) =>
                inCosineWindow(item.cosine, cosineTop) ||
                (item.cosine >= COS_ABS_MIN &&
                  albumHitScore(item.photo.albums, wantedAlbums) > 0),
            )
            .sort((a, b) => b.cosine - a.cosine)
            .slice(0, 30)

          const rerankScores = new Map<string, number>()
          let rerankTop = 0
          if (ranked.length) {
            const expanded = keywords.length ? `${trimmed} ${keywords.join(' ')}` : trimmed
            try {
              const results = await rerankPhotos(
                expanded,
                ranked.map((entry) => photoWeakText(entry.photo) || entry.photo.name),
              )
              results.forEach((item) => {
                const entry = ranked[item.index]
                if (!entry) return
                rerankScores.set(entry.photo.id, item.score)
                rerankTop = Math.max(rerankTop, item.score)
              })
            } catch {
              // 重排失败时仍有向量与词法两路信号
            }
          }

          const candidates = ranked.map((entry) => {
            const rerank = rerankScores.get(entry.photo.id) ?? 0
            const albumHit = albumHitScore(entry.photo.albums, wantedAlbums)
            return {
              id: entry.photo.id,
              rerank,
              lexical: entry.lexical,
              score: rankScore({
                rerank,
                rerankTop,
                cosine: entry.cosine,
                cosineTop,
                lexical: entry.lexical,
                albumHit,
              }),
            }
          })
          // 重排可用时由重排决定准入（信噪比更高），否则退回余弦窗口；
          // 词法强命中的照片不受窗口限制。
          const kept = candidates.filter(
            (hit) =>
              hit.lexical >= LEXICAL_STRONG ||
              rerankTop < RERANK_MIN ||
              inRerankWindow(hit.rerank, rerankTop),
          )
          // 词法命中但落在余弦窗口之外的照片（例如按文件名可精确命中的）
          photos.forEach((photo) => {
            const lexical = lexicalOf(photo)
            if (lexical < LEXICAL_MIN || kept.some((hit) => hit.id === photo.id)) return
            const rerank = rerankScores.get(photo.id) ?? 0
            kept.push({
              id: photo.id,
              rerank,
              lexical,
              score: rankScore({
                rerank,
                rerankTop,
                cosine: cosineOf(photo),
                cosineTop,
                lexical,
                albumHit: albumHitScore(photo.albums, wantedAlbums),
              }),
            })
          })
          const fused = kept.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS)
          if (fused.length) return { ids: fused.map((hit) => hit.id), mode: 'semantic' }
        }
      }

      const lexical = photos
        .map((photo) => ({ id: photo.id, score: lexicalOf(photo) }))
        .filter((hit) => hit.score >= LEXICAL_MIN)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS)
      return { ids: lexical.map((hit) => hit.id), mode: 'local' }
    },
    [],
  )

  const addEntries = useCallback(
    async (entries: Array<{ blob: Blob; name: string; takenAt: number }>) => {
      if (!entries.length) return
      const now = Date.now()
      const metas: PhotoMeta[] = entries.map((entry, index) => ({
        ...emptyStats(),
        id: createId(),
        name: entry.name,
        type: entry.blob.type || 'image/jpeg',
        size: entry.blob.size,
        width: 0,
        height: 0,
        takenAt: entry.takenAt,
        addedAt: now + index,
        album: 'moments',
        albumConfidence: 0,
        albums: ['moments'],
        localAlbum: 'moments',
        localAlbums: ['moments'],
        albumSource: 'local',
        manualAlbums: [],
        quality: 0,
        favorite: false,
        analyzed: false,
      }))

      for (let i = 0; i < metas.length; i += 1) {
        urls.current.set(metas[i].id, URL.createObjectURL(entries[i].blob))
        await savePhoto(metas[i], entries[i].blob)
      }
      setPhotos((previous) => sortPhotos([...metas, ...previous]))

      let done = 0
      let failed = 0
      const total = metas.length
      setProgress({ total, done: 0, failed: 0 })

      const jobs = metas.map((meta, index) => ({ meta, blob: entries[index].blob }))
      let cursor = 0

      const run = async () => {
        while (cursor < jobs.length) {
          const job = jobs[cursor]
          cursor += 1
          if (cancelled.current.has(job.meta.id)) continue
          try {
            const [analysis, exifDate] = await Promise.all([
              analyzer.analyze(job.meta.id, job.blob),
              readExifDate(job.blob),
            ])
            if (cancelled.current.has(job.meta.id)) continue
            const classified = classifyPhoto({
              name: job.meta.name,
              type: job.meta.type,
              width: analysis.width,
              height: analysis.height,
              whiteRatio: analysis.whiteRatio,
              edgeDensity: analysis.edgeDensity,
              brightness: analysis.brightness,
              skinRatio: analysis.skinRatio,
              centerSkinRatio: analysis.centerSkinRatio,
              greenRatio: analysis.greenRatio,
              blueRatio: analysis.blueRatio,
              warmRatio: analysis.warmRatio,
              saturation: analysis.saturation,
              contrast: analysis.contrast,
              colorfulness: analysis.colorfulness,
              darkRatio: analysis.darkRatio,
              skyRatio: analysis.skyRatio,
            })
            const updated: PhotoMeta = withResolvedAlbums({
              ...job.meta,
              ...analysis,
              takenAt: exifDate ?? job.meta.takenAt,
              album: classified.album,
              albumConfidence: classified.confidence,
              albums: classified.albums,
              localAlbum: classified.album,
              localAlbums: classified.albums,
              albumSource: 'local',
              quality: computeQuality({ ...job.meta, ...analysis }),
              analyzed: true,
            })
            await saveMeta(updated)
            setPhotos((previous) =>
              sortPhotos(previous.map((photo) => (photo.id === updated.id ? updated : photo))),
            )
            done += 1
          } catch {
            failed += 1
            cancelled.current.add(job.meta.id)
            const url = urls.current.get(job.meta.id)
            if (url) {
              URL.revokeObjectURL(url)
              urls.current.delete(job.meta.id)
            }
            setPhotos((previous) => previous.filter((photo) => photo.id !== job.meta.id))
            await deletePhotosFromDb([job.meta.id]).catch(() => undefined)
          }
          setProgress({ total, done: done + failed, failed })
        }
      }

      await Promise.all([run(), run(), run()])
      setProgress(null)
      if (failed > 0) {
        notify(
          done > 0
            ? `已分析 ${done} 张，${failed} 张格式无法解析已跳过`
            : '所选图片格式无法解析，请换用 JPG / PNG / WebP',
          'warning',
        )
      } else if (done > 0) {
        notify(`已完成 ${done} 张图片的智能整理`, 'success')
      }

      if (settingsRef.current.enabled && settingsRef.current.autoEnhance) {
        const ids = metas.map((meta) => meta.id).filter((id) => !cancelled.current.has(id))
        if (ids.length) void enhance(ids)
      }
    },
    [enhance, notify],
  )

  const addFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter(isImageFile)
      if (!valid.length) {
        notify('请选择图片文件', 'warning')
        return
      }
      const base = Date.now()
      const entries = valid.map((file, index) => ({
        blob: file,
        name: file.name || `未命名-${index + 1}`,
        takenAt: file.lastModified || base,
      }))
      await addEntries(entries)
    },
    [addEntries, notify],
  )

  const addDemo = useCallback(async () => {
    notify('正在生成演示相册…')
    try {
      const demo = await generateDemoPhotos()
      await addEntries(demo)
    } catch {
      notify('演示相册生成失败，请重试', 'warning')
    }
  }, [addEntries, notify])

  const removePhotos = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return
      const bytes = photos
        .filter((photo) => ids.includes(photo.id))
        .reduce((sum, photo) => sum + photo.size, 0)
      ids.forEach((id) => {
        cancelled.current.add(id)
        const url = urls.current.get(id)
        if (url) {
          URL.revokeObjectURL(url)
          urls.current.delete(id)
        }
      })
      setPhotos((previous) => previous.filter((photo) => !ids.includes(photo.id)))
      await deletePhotosFromDb(ids)
      notify(
        `已删除 ${ids.length} 张图片，释放 ${formatBytes(bytes)}`,
        'success',
      )
    },
    [notify, photos],
  )

  const setManualAlbums = useCallback(
    (id: string, albums: AlbumId[]) => {
      const manual = uniqueAlbums(albums.slice(0, 3))
      setPhotos((previous) =>
        previous.map((photo) => {
          if (photo.id !== id) return photo
          const updated = withResolvedAlbums({ ...photo, manualAlbums: manual })
          void saveMeta(updated)
          return updated
        }),
      )
      notify(
        manual.length ? `已归入 ${manual.length} 个相册` : '已恢复为自动整理',
        'success',
      )
    },
    [notify],
  )

  const toggleFavorite = useCallback((id: string) => {
    setPhotos((previous) =>
      previous.map((photo) => {
        if (photo.id !== id) return photo
        const updated = { ...photo, favorite: !photo.favorite }
        void saveMeta(updated)
        return updated
      }),
    )
  }, [])

  const totalBytes = useMemo(
    () => photos.reduce((sum, photo) => sum + photo.size, 0),
    [photos],
  )

  const enhancedCount = useMemo(
    () => photos.filter((photo) => photo.insight).length,
    [photos],
  )

  const pendingEnhanceCount = useMemo(
    () => photos.filter((photo) => photo.analyzed && !photo.insight).length,
    [photos],
  )

  const value = useMemo<LibraryContextValue>(
    () => ({
      photos,
      ready,
      progress,
      enhanceProgress,
      toast,
      notify,
      addFiles,
      addDemo,
      removePhotos,
      setManualAlbums,
      toggleFavorite,
      urlFor,
      totalBytes,
      enhancedCount,
      pendingEnhanceCount,
      enhance,
      clearCloudData,
      searchPhotos,
    }),
    [
      photos,
      ready,
      progress,
      enhanceProgress,
      toast,
      notify,
      addFiles,
      addDemo,
      removePhotos,
      setManualAlbums,
      toggleFavorite,
      urlFor,
      totalBytes,
      enhancedCount,
      pendingEnhanceCount,
      enhance,
      clearCloudData,
      searchPhotos,
    ],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext)
  if (!context) throw new Error('useLibrary must be used inside LibraryProvider')
  return context
}
