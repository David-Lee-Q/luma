import type { AlbumId } from './types'

/** 检索时忽略的语气词与泛化词，保留有区分度的实词。 */
const STOPWORDS = new Set([
  '的',
  '了',
  '在',
  '是',
  '我',
  '有',
  '和',
  '与',
  '就',
  '都',
  '而',
  '及',
  '或',
  '这',
  '那',
  '照片',
  '图片',
  '相片',
  '图像',
  '拍摄',
  '拍过',
  '帮我',
  '找出',
  '找到',
  '搜索',
  '查找',
  '显示',
  '看看',
  '一下',
  '所有',
  '全部',
  '关于',
  '什么',
  '哪些',
  '哪儿',
  '哪里',
  '相关',
  '张',
  '一张',
  '一些',
  '一个',
  '这些',
  '那些',
  '时候',
  '那年',
  '那天',
  '最近',
  '之前',
  '当时',
])

const CJK = /[\u4e00-\u9fff]/
const SPLIT = /[\s,，、。.！!？?；;：:()（）[\]{}"“”'‘’/\\|~—\-_]+/
/** 单字虚词：二元组里出现这些字说明该切片是语气词碎片，直接丢弃。 */
const FILLER_CHARS = new Set([
  '的',
  '了',
  '在',
  '和',
  '与',
  '我',
  '你',
  '他',
  '她',
  '它',
  '们',
  '一',
  '下',
  '些',
  '吗',
  '呢',
  '啊',
  '个',
  '张',
  '就',
  '都',
  '而',
  '或',
  '是',
  '有',
])

/**
 * 把自然语言查询切成检索词：中文按二元组展开（「海边的照片」→ 海边/照片），
 * 英文与数字整体保留，同时过滤语气词。
 */
export function tokenize(query: string): string[] {
  const tokens: string[] = []
  const push = (token: string) => {
    const trimmed = token.trim()
    if (!trimmed || STOPWORDS.has(trimmed)) return
    tokens.push(trimmed)
  }

  query
    .toLowerCase()
    .split(SPLIT)
    .map((piece) => piece.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(Boolean)
    .forEach((piece) => {
      if (!CJK.test(piece)) {
        if (piece.length >= 2) push(piece)
        return
      }
      const stripped = piece.replace(/[的了在和与]/g, ' ').trim()
      stripped.split(/\s+/).filter(Boolean).forEach((part) => {
        if (part.length <= 2) {
          push(part)
          return
        }
        for (let i = 0; i < part.length - 1; i += 1) {
          const gram = part.slice(i, i + 2)
          if (FILLER_CHARS.has(gram[0]) || FILLER_CHARS.has(gram[1])) continue
          push(gram)
        }
      })
    })

  return [...new Set(tokens)]
}

/**
 * 词法匹配：命中越多得分越高，命中标签或相册名时权重更高。
 * 返回 0-1，便于与语义分数融合。
 */
export function lexicalScore(tokens: string[], haystack: string, strong = ''): number {
  if (!tokens.length) return 0
  const text = haystack.toLowerCase()
  const strongText = strong.toLowerCase()
  let matched = 0
  let weight = 0
  tokens.forEach((token) => {
    const base = token.length >= 2 ? 1 : 0.6
    weight += base
    if (strongText.includes(token)) matched += base * 1.6
    else if (text.includes(token)) matched += base
  })
  if (!weight) return 0
  return Math.min(1, matched / (weight * 1.3))
}

/**
 * 检索置信度与排序的阈值常量。
 *
 * 实测两路语义信号的特点：
 * - bge 余弦相似度：相关照片约 0.55-0.67，无关照片 0.23-0.38，适合判断「是否相关」；
 * - 重排 relevance_score：绝对量级随查询剧烈波动（同一张相关照片可能 0.99 也可能 0.03），
 *   但同一查询内相关样本往往高出其他样本两个数量级，适合判断「谁更相关」。
 * 因此余弦负责候选准入，重排负责候选排序。
 */
export const COS_FLOOR = 0.4
export const COS_ABS_MIN = 0.3
export const COS_RELATIVE = 0.72
export const RERANK_MIN = 0.01
export const RERANK_RELATIVE = 0.2
export const LEXICAL_MIN = 0.34
export const LEXICAL_STRONG = 0.6
export const MAX_RESULTS = 24

/** 查询级置信度：最高余弦过低且没有词法命中时，判定为「没有匹配」。 */
export function isRelevantQuery(cosineTop: number, lexicalTop: number): boolean {
  return cosineTop >= COS_FLOOR || lexicalTop >= LEXICAL_MIN
}

/** 余弦候选窗口：只保留接近查询最高相似度的照片，避免「返回全部」。 */
export function inCosineWindow(cosine: number, cosineTop: number): boolean {
  return cosine >= Math.max(COS_ABS_MIN, cosineTop * COS_RELATIVE)
}

/** 重排候选窗口：模型给出的高分样本往往高出其余样本一个数量级。 */
export function inRerankWindow(rerank: number, rerankTop: number): boolean {
  return rerankTop >= RERANK_MIN && rerank >= rerankTop * RERANK_RELATIVE
}

export interface RankInput {
  rerank: number
  rerankTop: number
  cosine: number
  cosineTop: number
  lexical: number
  albumHit: number
}

/** 候选排序分：重排为主、词法优先、余弦兜底，相册命中作为微调。 */
export function rankScore({
  rerank,
  rerankTop,
  cosine,
  cosineTop,
  lexical,
  albumHit,
}: RankInput): number {
  const rerankPart = rerankTop >= RERANK_MIN ? rerank / rerankTop : 0
  const cosinePart = cosineTop > 0 ? cosine / cosineTop : 0
  const lexicalPart =
    lexical >= LEXICAL_STRONG ? 1 : lexical >= LEXICAL_MIN ? 0.5 : 0
  return 0.62 * rerankPart + 0.16 * cosinePart + 0.8 * lexicalPart + 0.06 * albumHit
}

export function albumHitScore(albums: AlbumId[], wanted: AlbumId[]): number {
  if (!wanted.length || !albums.length) return 0
  return albums.some((album) => wanted.includes(album)) ? 1 : 0
}
