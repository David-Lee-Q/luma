import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  albumFromLabel,
  cosineSimilarity,
  createLimiter,
  enhancePhotoBatch,
  insightSearchText,
  parseInsight,
} from './cloud'
import type { CloudInsight } from './types'

describe('albumFromLabel', () => {
  it('maps canonical album names', () => {
    expect(albumFromLabel('风景')).toBe('nature')
    expect(albumFromLabel('夜景')).toBe('night')
    expect(albumFromLabel('截图')).toBe('screenshots')
  })

  it('maps aliases, english labels and extra words', () => {
    expect(albumFromLabel('人像')).toBe('people')
    expect(albumFromLabel('landscape')).toBe('nature')
    expect(albumFromLabel('这是一张美食照片')).toBe('food')
    expect(albumFromLabel(' 日常 ')).toBe('moments')
  })

  it('returns null for unknown labels', () => {
    expect(albumFromLabel('宇宙飞船')).toBeNull()
    expect(albumFromLabel('')).toBeNull()
    expect(albumFromLabel(undefined)).toBeNull()
  })
})

describe('cosineSimilarity', () => {
  it('scores identical vectors as 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6)
  })

  it('scores orthogonal vectors as 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6)
  })

  it('tolerates length mismatch and zero vectors', () => {
    expect(cosineSimilarity([1, 1, 1], [1, 1])).toBeCloseTo(1, 6)
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0)
    expect(cosineSimilarity([], [])).toBe(0)
  })
})

describe('createLimiter', () => {
  it('never exceeds the concurrency cap', async () => {
    const limit = createLimiter(2)
    let active = 0
    let peak = 0
    const tasks = Array.from({ length: 8 }, (_, index) =>
      limit(async () => {
        active += 1
        peak = Math.max(peak, active)
        await new Promise((resolve) => setTimeout(resolve, 5))
        active -= 1
        return index
      }),
    )
    const results = await Promise.all(tasks)
    expect(peak).toBeLessThanOrEqual(2)
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})

describe('parseInsight', () => {
  it('normalizes a complete payload', () => {
    const insight = parseInsight(
      {
        desc: '落日悬于沙丘之上',
        tags: ['落日', '沙丘', '', '黄昏', '风景', '多余'],
        album: '风景',
        confidence: 0.86,
        advice: '构图简洁，可保留',
      },
      'qwen3-vl',
    )
    expect(insight).not.toBeNull()
    expect(insight?.album).toBe('nature')
    expect(insight?.albumConfidence).toBeCloseTo(0.86)
    expect(insight?.tags).toHaveLength(5)
    expect(insight?.tags).not.toContain('')
    expect(insight?.model).toBe('qwen3-vl')
  })

  it('falls back to a keep hint and clamps confidence', () => {
    const insight = parseInsight({ desc: '模糊的照片', keep: false, confidence: 3 }, 'm')
    expect(insight?.album).toBeNull()
    expect(insight?.albumConfidence).toBe(1)
    expect(insight?.advice).toContain('不再保留')
  })

  it('drops empty payloads', () => {
    expect(parseInsight(null, 'm')).toBeNull()
    expect(parseInsight({}, 'm')).toBeNull()
    expect(parseInsight({ desc: '   ' }, 'm')).toBeNull()
  })
})

describe('insightSearchText', () => {
  it('joins description and tags', () => {
    const insight: CloudInsight = {
      desc: '粉色草莓蛋糕',
      tags: ['甜点', '美食'],
      album: 'food',
      albumConfidence: 0.9,
      albums: ['food'],
      advice: '',
      model: 'm',
      at: 1,
    }
    expect(insightSearchText(insight)).toBe('粉色草莓蛋糕 甜点 美食')
  })
})

describe('enhancePhotoBatch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubDom() {
    vi.stubGlobal('createImageBitmap', async () => ({
      width: 800,
      height: 600,
      close: () => undefined,
    }))
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => undefined }),
        toDataURL: () => 'data:image/jpeg;base64,AAAA',
      }),
    })
  }

  it('maps a JSON items array back to the input order', async () => {
    stubDom()
    const captured: { images?: string[]; prompt?: string } = {}
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { images: string[]; prompt: string }
      captured.images = body.images
      captured.prompt = body.prompt
      const content = JSON.stringify({
        items: [
          { desc: '落日沙丘', tags: ['落日'], album: '风景', confidence: 0.9, advice: '' },
          { desc: '草莓蛋糕', tags: ['蛋糕'], album: '美食', confidence: 0.8, advice: '' },
        ],
      })
      return new Response(JSON.stringify({ text: content, model: 'qwen3-vl' }), { status: 200 })
    })

    const insights = await enhancePhotoBatch([
      {
        blob: new Blob(['a']),
        name: 'a.jpg',
        localAlbumName: '风景',
        quality: 70,
        issues: [],
      },
      {
        blob: new Blob(['b']),
        name: 'b.jpg',
        localAlbumName: '美食',
        quality: 80,
        issues: ['画面模糊'],
      },
    ])

    expect(captured.images).toHaveLength(2)
    expect(captured.prompt).toContain('a.jpg')
    expect(insights.map((item) => item?.desc)).toEqual(['落日沙丘', '草莓蛋糕'])
    expect(insights.map((item) => item?.album)).toEqual(['nature', 'food'])
  })

  it('keeps the input length when the model returns fewer items', async () => {
    stubDom()
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ text: JSON.stringify({ items: [] }), model: 'm' }), {
        status: 200,
      }),
    )
    const insights = await enhancePhotoBatch([
      { blob: new Blob(['a']), name: 'a.jpg', localAlbumName: '日常', quality: 60, issues: [] },
    ])
    expect(insights).toEqual([null])
  })
})
