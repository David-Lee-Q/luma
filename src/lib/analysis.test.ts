import { describe, expect, it } from 'vitest'
import {
  FINGERPRINT_HEX_LENGTH,
  HASH_HEX_LENGTH,
  classifyPhoto,
  colorDistance,
  computeQuality,
  detectIssues,
  hammingDistance,
  hashFromGray,
} from './analysis'
import { buildCleanupPlan, findDuplicateGroups } from './cleanup'
import type { PhotoMeta } from './types'

const base = {
  name: 'photo.jpg',
  type: 'image/jpeg',
  width: 1600,
  height: 1200,
  whiteRatio: 0.05,
  edgeDensity: 0.08,
  brightness: 0.5,
  skinRatio: 0.02,
  centerSkinRatio: 0.04,
  greenRatio: 0.1,
  blueRatio: 0.1,
  warmRatio: 0.1,
  saturation: 0.3,
}

describe('perceptual hash', () => {
  it('creates a 240 bit hex hash', () => {
    const size = 16
    const gray = new Float32Array(size * size)
    gray.forEach((_, index) => {
      gray[index] = (index % size) * 16
    })
    const hash = hashFromGray(gray)
    expect(hash).toHaveLength(HASH_HEX_LENGTH)
    expect(hash).toMatch(/^[0-9a-f]{60}$/)
    expect(hammingDistance(hash, hash)).toBe(0)
  })

  it('counts bit differences', () => {
    expect(hammingDistance('0000000000000000', 'ffffffffffffffff')).toBe(64)
    expect(hammingDistance('0000000000000001', '0000000000000003')).toBe(1)
    expect(hammingDistance('bad', '0000000000000000')).toBe(64)
  })

  it('compares color fingerprints by euclidean distance', () => {
    expect(colorDistance('00ff', '00ff')).toBe(0)
    expect(colorDistance('0000', '0003')).toBeGreaterThan(1)
    expect(colorDistance('0000', 'ffff')).toBeGreaterThan(colorDistance('0000', '0001'))
    expect(colorDistance('bad', '0000')).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('smart album classification', () => {
  it('detects screenshots from filename and shape', () => {
    expect(
      classifyPhoto({ ...base, name: 'Screenshot_2026.png', width: 1080, height: 2340 }),
    ).toMatchObject({ album: 'screenshots' })
  })

  it('detects white documents', () => {
    expect(
      classifyPhoto({
        ...base,
        name: 'scan.jpg',
        whiteRatio: 0.62,
        edgeDensity: 0.09,
        saturation: 0.08,
      }),
    ).toMatchObject({ album: 'documents' })
  })

  it('detects night scenes', () => {
    expect(classifyPhoto({ ...base, name: 'street.jpg', brightness: 0.08 })).toMatchObject({
      album: 'night',
    })
  })

  it('detects people from skin tones', () => {
    expect(
      classifyPhoto({ ...base, name: 'portrait.jpg', skinRatio: 0.14, centerSkinRatio: 0.34 }),
    ).toMatchObject({ album: 'people' })
  })

  it('detects nature from green and blue', () => {
    expect(classifyPhoto({ ...base, greenRatio: 0.42 })).toMatchObject({ album: 'nature' })
    expect(
      classifyPhoto({ ...base, name: 'sea.jpg', blueRatio: 0.35, brightness: 0.65 }),
    ).toMatchObject({ album: 'nature' })
  })

  it('detects warm food scenes', () => {
    expect(
      classifyPhoto({
        ...base,
        name: 'ramen.jpg',
        warmRatio: 0.4,
        saturation: 0.5,
        brightness: 0.45,
        greenRatio: 0.04,
        blueRatio: 0.02,
      }),
    ).toMatchObject({ album: 'food' })
  })

  it('keeps warm landscapes out of the food album', () => {
    expect(
      classifyPhoto({
        ...base,
        name: 'dune.jpg',
        warmRatio: 0.34,
        blueRatio: 0.37,
        greenRatio: 0,
        brightness: 0.21,
        saturation: 0.36,
        skinRatio: 0.05,
        centerSkinRatio: 0.08,
      }),
    ).toMatchObject({ album: 'nature' })
  })

  it('does not mistake pink desserts for people', () => {
    expect(
      classifyPhoto({
        ...base,
        name: 'cake.jpg',
        warmRatio: 0.86,
        greenRatio: 0,
        blueRatio: 0,
        brightness: 0.45,
        saturation: 0.44,
        skinRatio: 0.51,
        centerSkinRatio: 0.28,
      }),
    ).toMatchObject({ album: 'food' })
  })

  it('falls back to moments', () => {
    expect(classifyPhoto(base)).toMatchObject({ album: 'moments' })
  })
})

describe('multi album classification', () => {
  it('keeps a night portrait in both people and night albums', () => {
    const result = classifyPhoto({
      ...base,
      name: 'night-portrait.jpg',
      brightness: 0.12,
      darkRatio: 0.62,
      skinRatio: 0.2,
      centerSkinRatio: 0.5,
      warmRatio: 0.3,
    })
    expect(result.album).toBe('people')
    expect(result.albums).toContain('people')
    expect(result.albums).toContain('night')
  })

  it('labels a dark scene without people as night', () => {
    const result = classifyPhoto({
      ...base,
      name: 'street.jpg',
      brightness: 0.1,
      darkRatio: 0.7,
      skinRatio: 0.01,
      centerSkinRatio: 0.02,
    })
    expect(result.album).toBe('night')
    expect(result.albums).toEqual(['night'])
  })

  it('adds a secondary album only when it is also convincing', () => {
    const sunset = classifyPhoto({
      ...base,
      name: 'sunset.jpg',
      warmRatio: 0.45,
      blueRatio: 0.3,
      greenRatio: 0.05,
      saturation: 0.5,
      brightness: 0.4,
      skyRatio: 0.5,
      contrast: 0.3,
    })
    expect(sunset.album).toBe('nature')
    expect(sunset.albums).toHaveLength(1)
  })

  it('never returns duplicate or catch-all secondary albums', () => {
    const result = classifyPhoto({ ...base, greenRatio: 0.42 })
    expect(new Set(result.albums).size).toBe(result.albums.length)
    expect(result.albums).not.toContain('moments')
    expect(result.albums.length).toBeLessThanOrEqual(3)
  })

  it('exposes per album scores for the strongest candidate', () => {
    const result = classifyPhoto({ ...base, greenRatio: 0.42 })
    expect(result.scores.nature).toBeGreaterThan(result.scores.moments ?? 0)
  })
})

describe('quality and issues', () => {
  const stats = {
    sharpness: 600,
    edgeDensity: 0.09,
    contrast: 0.2,
    width: 1600,
    height: 1200,
    brightness: 0.5,
    colorfulness: 0.4,
  }

  it('scores sharp photos above soft ones', () => {
    const sharp = computeQuality(stats)
    const soft = computeQuality({ ...stats, sharpness: 20 })
    expect(sharp).toBeGreaterThan(soft)
    expect(sharp).toBeGreaterThan(60)
  })

  it('flags blur, dark and low resolution photos', () => {
    const issues = detectIssues({
      album: 'moments',
      sharpness: 30,
      brightness: 0.06,
      width: 400,
      height: 300,
      quality: 30,
    })
    expect(issues.map((issue) => issue.type).sort()).toEqual(['blurry', 'dark', 'lowres'])
  })

  it('does not critique documents or screenshots', () => {
    expect(
      detectIssues({
        album: 'documents',
        sharpness: 10,
        brightness: 0.96,
        width: 500,
        height: 700,
        quality: 40,
      }),
    ).toHaveLength(0)
  })
})

const H = (hex: string) => hex.padEnd(HASH_HEX_LENGTH, '0')
const F = (hex: string) => hex.padEnd(FINGERPRINT_HEX_LENGTH, '0')
const solid = (char: string, length: number) => char.repeat(length)
const ZERO_HASH = solid('0', HASH_HEX_LENGTH)
const ONE_HASH = solid('0', HASH_HEX_LENGTH - 1) + '1'
const FAR_HASH = solid('f', HASH_HEX_LENGTH)
const ALT_HASH = solid('a', HASH_HEX_LENGTH)

function photo(id: string, hash: string, quality: number, size: number): PhotoMeta {
  return {
    id,
    name: `${id}.jpg`,
    type: 'image/jpeg',
    size,
    width: 1600,
    height: 1200,
    takenAt: 1,
    addedAt: 1,
    hash,
    fingerprint: F('8'),
    brightness: 0.5,
    contrast: 0.2,
    saturation: 0.3,
    colorfulness: 0.3,
    sharpness: 400,
    edgeDensity: 0.08,
    whiteRatio: 0.05,
    greenRatio: 0.1,
    blueRatio: 0.1,
    warmRatio: 0.1,
    skinRatio: 0.02,
    centerSkinRatio: 0.03,
    palette: ['#334433'],
    dominant: '#334433',
    album: 'moments',
    albumConfidence: 0.6,
    localAlbum: 'moments',
    localAlbums: ['moments'],
    albums: ['moments'],
    albumSource: 'local',
    manualAlbums: [],
    darkRatio: 0,
    skyRatio: 0,
    quality,
    favorite: false,
    analyzed: true,
  }
}

describe('duplicate cleanup', () => {
  it('groups near-identical photos and keeps the best one', () => {
    const list = [
      photo('a', ZERO_HASH, 70, 100),
      photo('b', ONE_HASH, 92, 100),
      photo('c', FAR_HASH, 80, 500),
    ]
    const groups = findDuplicateGroups(list)
    expect(groups).toHaveLength(1)
    expect(groups[0].keeperId).toBe('b')
    expect(groups[0].photos).toHaveLength(2)
    expect(groups[0].savedBytes).toBe(100)
    expect(groups[0].kind).toBe('duplicate')
  })

  it('builds a deduplicated suggestion list', () => {
    const list = [
      photo('a', ZERO_HASH, 70, 100),
      photo('b', ONE_HASH, 92, 100),
      { ...photo('c', FAR_HASH, 20, 500), fingerprint: F('0'), sharpness: 10 },
      { ...photo('d', ALT_HASH, 80, 800), fingerprint: F('4'), width: 2400, height: 1800 },
    ]
    const plan = buildCleanupPlan(list)
    expect(plan.groups).toHaveLength(1)
    expect(plan.suggestedIds).toContain('a')
    expect(plan.suggestedIds).not.toContain('b')
    expect(plan.reclaimableBytes).toBe(600)
    expect(new Set(plan.suggestedIds).size).toBe(plan.suggestedIds.length)
  })

  it('does not chain unrelated photos through transitive similarity', () => {
    const list = [
      { ...photo('k', ZERO_HASH, 95, 100), fingerprint: F(solid('8', 192)) },
      { ...photo('x', H(solid('f', 6)), 85, 100), fingerprint: F(solid('8', 192)) },
      { ...photo('y', H(solid('0', 2) + solid('f', 7)), 75, 100), fingerprint: F(solid('8', 192)) },
    ]
    const groups = findDuplicateGroups(list)
    expect(groups.map((group) => group.photos.length)).toEqual([2])
    expect(groups[0].photos.map((entry) => entry.id).sort()).toEqual(['k', 'x'])
  })

  it('rejects similar layouts that carry very different colors', () => {
    const list = [
      { ...photo('sunset', ZERO_HASH, 80, 100), fingerprint: solid('2', 192) },
      { ...photo('faded', ONE_HASH, 60, 100), fingerprint: solid('e', 192) },
    ]
    expect(findDuplicateGroups(list)).toHaveLength(0)
  })
})
