import { describe, expect, it } from 'vitest'
import {
  MAX_RESULTS,
  albumHitScore,
  inCosineWindow,
  inRerankWindow,
  isRelevantQuery,
  lexicalScore,
  rankScore,
  tokenize,
} from './search'

describe('tokenize', () => {
  it('splits chinese phrases into meaningful bigrams', () => {
    const tokens = tokenize('海边的照片')
    expect(tokens).toContain('海边')
    expect(tokens).not.toContain('照片')
  })

  it('keeps latin words and digits together', () => {
    expect(tokenize('IMG 2024 sunset')).toEqual(
      expect.arrayContaining(['img', '2024', 'sunset']),
    )
  })

  it('drops english single letters and separates punctuation', () => {
    expect(tokenize('a, 蛋糕/夜景')).toEqual(expect.arrayContaining(['蛋糕', '夜景']))
    expect(tokenize('a, 蛋糕/夜景')).not.toContain('a')
  })

  it('returns an empty list for pure stopwords', () => {
    expect(tokenize('我的照片一下')).toEqual([])
  })
})

describe('lexicalScore', () => {
  it('scores tag hits higher than description hits', () => {
    const tokens = ['海边']
    const inTags = lexicalScore(tokens, '海边 沙滩', '海边 日落')
    const inDesc = lexicalScore(tokens, '海边的沙滩', '日落 黄昏')
    expect(inTags).toBeGreaterThan(inDesc)
  })

  it('is zero when nothing matches and one when everything matches', () => {
    expect(lexicalScore(['宇宙飞船'], '草莓蛋糕 甜点', '美食')).toBe(0)
    expect(lexicalScore(['蛋糕', '甜点'], '草莓蛋糕 甜点', '蛋糕 甜点')).toBe(1)
  })

  it('handles empty token lists', () => {
    expect(lexicalScore([], 'anything', '')).toBe(0)
  })
})

describe('isRelevantQuery', () => {
  it('accepts a query whose top cosine is clearly related', () => {
    expect(isRelevantQuery(0.58, 0)).toBe(true)
  })

  it('accepts a weak semantic query when a keyword matches', () => {
    expect(isRelevantQuery(0.31, 0.5)).toBe(true)
  })

  it('rejects a query with neither semantic nor lexical support', () => {
    expect(isRelevantQuery(0.31, 0)).toBe(false)
  })
})

describe('inCosineWindow', () => {
  it('keeps photos close to the query top and drops the tail', () => {
    expect(inCosineWindow(0.58, 0.58)).toBe(true)
    expect(inCosineWindow(0.366, 0.577)).toBe(false)
    expect(inCosineWindow(0.611, 0.612)).toBe(true)
    expect(inCosineWindow(0.383, 0.612)).toBe(false)
  })

  it('never admits photos below the absolute floor', () => {
    expect(inCosineWindow(0.25, 0.26)).toBe(false)
  })
})

describe('inRerankWindow', () => {
  it('keeps samples that stay close to the rerank top', () => {
    expect(inRerankWindow(0.33, 0.33)).toBe(true)
    expect(inRerankWindow(0.03, 0.03)).toBe(true)
    expect(inRerankWindow(0.0003, 0.03)).toBe(false)
    expect(inRerankWindow(0.0002, 0.987)).toBe(false)
  })

  it('refuses to trim when the rerank signal collapsed', () => {
    expect(inRerankWindow(0.002, 0.0028)).toBe(false)
  })
})

describe('rankScore', () => {
  it('orders by rerank inside the candidate window', () => {
    const best = rankScore({ rerank: 0.987, rerankTop: 0.987, cosine: 0.666, cosineTop: 0.666, lexical: 0, albumHit: 0 })
    const second = rankScore({ rerank: 0.972, rerankTop: 0.987, cosine: 0.56, cosineTop: 0.666, lexical: 0, albumHit: 0 })
    const weak = rankScore({ rerank: 0.001, rerankTop: 0.987, cosine: 0.48, cosineTop: 0.666, lexical: 0, albumHit: 0 })
    expect(best).toBeGreaterThan(second)
    expect(second).toBeGreaterThan(weak)
  })

  it('falls back to cosine when rerank collapses to noise', () => {
    const high = rankScore({ rerank: 0.0001, rerankTop: 0.0002, cosine: 0.58, cosineTop: 0.58, lexical: 0, albumHit: 0 })
    const low = rankScore({ rerank: 0.0001, rerankTop: 0.0002, cosine: 0.36, cosineTop: 0.58, lexical: 0, albumHit: 0 })
    expect(high).toBeGreaterThan(low)
  })

  it('lets a keyword hit outrank a purely semantic candidate', () => {
    const keyword = rankScore({ rerank: 0.02, rerankTop: 0.9, cosine: 0.35, cosineTop: 0.4, lexical: 1, albumHit: 0 })
    const semantic = rankScore({ rerank: 0.3, rerankTop: 0.9, cosine: 0.4, cosineTop: 0.4, lexical: 0, albumHit: 0 })
    expect(keyword).toBeGreaterThan(semantic)
  })

  it('keeps the top candidate strictly highest among the window', () => {
    const hit = rankScore({ rerank: 0.33, rerankTop: 0.33, cosine: 0.577, cosineTop: 0.577, lexical: 0, albumHit: 1 })
    const noise = rankScore({ rerank: 0.0003, rerankTop: 0.33, cosine: 0.366, cosineTop: 0.577, lexical: 0, albumHit: 0 })
    expect(hit).toBeGreaterThan(noise)
  })
})

describe('albumHitScore', () => {
  it('rewards photos whose albums match the inferred categories', () => {
    expect(albumHitScore(['nature'], ['nature', 'night'])).toBe(1)
    expect(albumHitScore(['food'], ['nature'])).toBe(0)
    expect(albumHitScore(['food'], [])).toBe(0)
  })
})

describe('result limits', () => {
  it('keeps the fused result window bounded', () => {
    expect(MAX_RESULTS).toBeGreaterThanOrEqual(12)
    expect(MAX_RESULTS).toBeLessThanOrEqual(30)
  })
})
