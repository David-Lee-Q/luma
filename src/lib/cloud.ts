import { ALBUM_MAP, ALBUMS, type AlbumId, type CloudInsight } from './types'

const MAX_EDGE = 640
const JPEG_QUALITY = 0.82
const TIMEOUT_MS = 90_000

const NAME_TO_ALBUM = new Map(ALBUMS.map((album) => [album.name, album.id]))
const ALBUM_ALIASES: Record<string, AlbumId> = {
  人像: 'people',
  人物: 'people',
  肖像: 'people',
  风景: 'nature',
  自然: 'nature',
  风光: 'nature',
  山水: 'nature',
  美食: 'food',
  食物: 'food',
  餐饮: 'food',
  夜景: 'night',
  夜色: 'night',
  截图: 'screenshots',
  截屏: 'screenshots',
  文档: 'documents',
  文件: 'documents',
  文字: 'documents',
  日常: 'moments',
  生活: 'moments',
  其他: 'moments',
}

export const ALBUM_CHOICES = ALBUMS.map((album) => album.name).join('、')

export function albumFromLabel(label: unknown): AlbumId | null {
  if (typeof label !== 'string') return null
  const trimmed = label.trim()
  if (!trimmed) return null
  const direct = NAME_TO_ALBUM.get(trimmed)
  if (direct) return direct
  if (ALBUM_ALIASES[trimmed]) return ALBUM_ALIASES[trimmed]
  const lowered = trimmed.toLowerCase()
  if (lowered === 'people' || lowered === 'person') return 'people'
  if (lowered === 'nature' || lowered === 'landscape') return 'nature'
  if (lowered === 'food') return 'food'
  if (lowered === 'night') return 'night'
  if (lowered === 'screenshot' || lowered === 'screenshots') return 'screenshots'
  if (lowered === 'document' || lowered === 'documents') return 'documents'
  if (lowered === 'moments' || lowered === 'daily') return 'moments'
  const matched = ALBUMS.find((album) => trimmed.includes(album.name))
  return matched ? matched.id : null
}

/** 将模型返回的类别标签数组解析为去重后的 AlbumId 列表。 */
export function albumsFromLabels(value: unknown, primary: AlbumId | null): AlbumId[] {
  const list = Array.isArray(value) ? value : []
  const ids: AlbumId[] = []
  const push = (album: AlbumId | null) => {
    if (album && !ids.includes(album)) ids.push(album)
  }
  push(primary)
  list.forEach((item) => push(albumFromLabel(item)))
  return ids.slice(0, 3)
}

export class CloudError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'CloudError'
    this.status = status
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'TimeoutError'
    throw new CloudError(aborted ? '云端响应超时，请稍后重试' : '无法连接云端智能服务')
  }
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }
  if (!response.ok) {
    if (response.status === 429) {
      throw new CloudError('云端模型调用配额已满，正在自动重试', 429)
    }
    const message =
      (payload as { error?: string } | null)?.error ?? `云端服务返回 ${response.status}`
    throw new CloudError(message, response.status)
  }
  return payload as T
}

export async function toSampleDataUrl(blob: Blob, maxEdge = MAX_EDGE): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new CloudError('本机无法压缩图片')
    context.drawImage(bitmap, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  } finally {
    bitmap.close?.()
  }
}

function extractJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '')
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        return {}
      }
    }
    return {}
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toStringArray(value: unknown, limit = 6): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, limit)
}

/** 将模型返回的单条结果规整为 CloudInsight，字段缺失时返回 null。 */
export function parseInsight(raw: unknown, model: string): CloudInsight | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const album = albumFromLabel(record.album)
  const albums = albumsFromLabels(record.albums, album)
  const desc = typeof record.desc === 'string' ? record.desc.trim() : ''
  const advice = typeof record.advice === 'string' ? record.advice.trim() : ''
  if (!desc && !album && !advice) return null
  return {
    desc: desc || '模型未给出描述',
    tags: toStringArray(record.tags),
    album: albums[0] ?? album,
    albumConfidence: Math.min(1, Math.max(0, toNumber(record.confidence, album ? 0.7 : 0))),
    albums,
    advice: advice || (record.keep === false ? '模型建议不再保留这张照片' : ''),
    model,
    at: Date.now(),
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 配额或瞬时故障时退避重试，其余错误直接抛出。 */
async function withRetry<T>(task: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      const status = error instanceof CloudError ? error.status : 0
      const retriable = status === 429 || status === 502 || status === 503 || status === 0
      if (!retriable || attempt === attempts - 1) throw error
      await sleep(1500 * 2 ** attempt)
    }
  }
  throw lastError
}

export interface EnhanceInput {
  blob: Blob
  name: string
  localAlbumName: string
  quality: number
  issues: string[]
}

const SYSTEM_PROMPT =
  '你是专业照片整理助手。只依据画面本身判断，输出严格的 JSON，不要输出多余文字。'

const FIELD_SPEC =
  `{"desc":"一句中文描述，不超过 28 字，说清主体与场景","tags":["3 到 5 个中文关键词"],"album":"必须从这些类别里选一个最匹配的：${ALBUM_CHOICES}","albums":["1 到 3 个确实相关的类别，最匹配的排第一位，只能是：${ALBUM_CHOICES}"],"confidence":0.0到1.0之间的小数,"advice":"一句话点评画质与是否值得保留，不超过 34 字，语气克制","keep":true 或 false}`

const FIELD_RULES =
  '规则：keep 为 false 仅当画面明显模糊、严重过曝或闭眼等确实不宜保留；重复构图不算缺陷。albums 用于多标签归类，只有画面同时具备两类特征时才给出第二个类别，宁少勿多。'

function contextLine(input: EnhanceInput, index: number): string {
  const issueText = input.issues.length ? input.issues.join('、') : '未检测到明显缺陷'
  return `${index + 1}. 文件名「${input.name}」，本机初判类别「${input.localAlbumName}」，本机画质评分 ${Math.round(input.quality)}，本机检测到：${issueText}`
}

/** 单张增强：适合详情页临时调用。 */
export async function enhancePhoto(input: EnhanceInput): Promise<CloudInsight> {
  const [insight] = await enhancePhotoBatch([input])
  if (!insight) throw new CloudError('模型未返回可用结果')
  return insight
}

/**
 * 批量增强：一次请求最多 4 张，显著低于网关每分钟调用配额。
 * 返回数组与入参顺序一一对应，失败项为 null。
 */
export async function enhancePhotoBatch(
  inputs: EnhanceInput[],
  batchSize = 4,
): Promise<Array<CloudInsight | null>> {
  if (!inputs.length) return []
  const results: Array<CloudInsight | null> = []
  for (let start = 0; start < inputs.length; start += batchSize) {
    const chunk = inputs.slice(start, start + batchSize)
    const dataUrls = await Promise.all(chunk.map((input) => toSampleDataUrl(input.blob)))
    const prompt = [
      `下面按顺序给出 ${chunk.length} 张照片，请逐张独立分析。`,
      chunk.map(contextLine).join('\n'),
      `只输出 JSON 对象 {"items":[...]}，items 数组长度必须等于 ${chunk.length}，顺序与照片顺序严格一致，每项字段如下：`,
      FIELD_SPEC,
      FIELD_RULES,
    ].join('\n')
    const payload = await withRetry(() =>
      postJson<{ text: string; model: string }>('/api/vision', {
        system: SYSTEM_PROMPT,
        prompt,
        images: dataUrls,
        json: true,
        temperature: 0.2,
        maxTokens: 500 * chunk.length,
      }),
    )
    const parsed = extractJson(payload.text)
    const items = Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed)
        ? (parsed as unknown[])
        : []
    chunk.forEach((_, index) => {
      results.push(parseInsight(items[index], payload.model))
    })
  }
  return results
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return []
  const payload = await withRetry(() =>
    postJson<{ vectors: number[][] }>('/api/embeddings', { input: texts }),
  )
  return payload.vectors ?? []
}

export async function rerankPhotos(
  query: string,
  documents: string[],
): Promise<Array<{ index: number; score: number }>> {
  if (!documents.length) return []
  const payload = await withRetry(() =>
    postJson<{ results: Array<{ index: number; score: number }> }>('/api/rerank', {
      query,
      documents,
      topN: documents.length,
    }),
  )
  return payload.results ?? []
}

export function insightSearchText(insight: CloudInsight): string {
  return [insight.desc, ...insight.tags].filter(Boolean).join(' ')
}

export interface QueryPlan {
  keywords: string[]
  albums: AlbumId[]
}

const planCache = new Map<string, QueryPlan>()

/**
 * 用文本模型把自然语言查询拆成关键词与候选类别，提升召回与排序精度。
 * 失败时返回 null，调用方回退到本地分词。
 */
export async function expandQuery(query: string): Promise<QueryPlan | null> {
  const trimmed = query.trim()
  if (!trimmed) return null
  const cached = planCache.get(trimmed)
  if (cached) return cached
  try {
    const payload = await postJson<{ text: string; model: string }>('/api/text', {
      system:
        '你是照片检索助手，把用户的检索语句转成检索条件。只输出 JSON，不要解释。',
      prompt: [
        `用户搜索语句：「${trimmed}」`,
        '请输出 JSON：',
        `{"keywords":["2 到 5 个最有区分度的中文检索词，去掉语气词、时间词与「照片」这类泛词"],"albums":["从这些类别里挑选确实被该语句指向的类别，可以为空数组：${ALBUM_CHOICES}"]}`,
      ].join('\n'),
      json: true,
      temperature: 0.1,
      maxTokens: 300,
    })
    const parsed = extractJson(payload.text)
    const keywords = toStringArray(parsed.keywords, 6)
    const albums = albumsFromLabels(parsed.albums, null)
    const plan: QueryPlan = { keywords, albums }
    if (planCache.size > 60) planCache.clear()
    planCache.set(trimmed, plan)
    return plan
  } catch {
    return null
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length)
  if (!length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (!normA || !normB) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function albumLabel(album: AlbumId): string {
  return ALBUM_MAP[album].name
}

export function createLimiter(concurrency: number) {
  let active = 0
  const queue: Array<() => void> = []
  const next = () => {
    active -= 1
    const resume = queue.shift()
    if (resume) resume()
  }
  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve))
    }
    active += 1
    try {
      return await task()
    } finally {
      next()
    }
  }
}
