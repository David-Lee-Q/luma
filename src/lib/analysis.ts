import type { AlbumId, Issue, PhotoMeta, PhotoStats } from './types'

export const ANALYSIS_SIZE = 192
export const BLUR_THRESHOLD = 110
export const STRONG_BLUR_THRESHOLD = 58
export const LOW_RES_SHORT_SIDE = 640

/** 感知哈希：16x16 灰度差分，共 240 bit，编码为 60 位十六进制。 */
export const HASH_SIZE = 16
export const HASH_HEX_LENGTH = (HASH_SIZE * (HASH_SIZE - 1)) / 4
/** 颜色指纹：8x8 区块的 RGB 均值，每通道量化到 4 bit，共 192 位十六进制。 */
export const FINGERPRINT_BLOCKS = 8
export const FINGERPRINT_HEX_LENGTH = FINGERPRINT_BLOCKS * FINGERPRINT_BLOCKS * 3
const FINGERPRINT_LEVELS = 16
const FINGERPRINT_STEP = 255 / (FINGERPRINT_LEVELS - 1)

/** 判定为重复：哈希与颜色都要足够接近。 */
export const DUPLICATE_DISTANCE = 8
export const DUPLICATE_COLOR = 1
/** 判定为相似：允许构图或色调略有变化，但仍需颜色一致。 */
export const SIMILAR_DISTANCE = 24
export const SIMILAR_COLOR = 2.6

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

interface ColorBucket {
  count: number
  r: number
  g: number
  b: number
  sat: number
  luma: number
}

/** 提取亮度通道，供统计与感知哈希共用。 */
export function toGray(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const total = width * height
  const gray = new Float32Array(total)
  for (let i = 0; i < total; i += 1) {
    gray[i] =
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }
  return gray
}

/** 从 4 通道像素统计出可解释的画面指标。 */
export function analyzePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  gray: Float32Array = toGray(data, width, height),
): PhotoStats {
  const total = width * height
  const buckets = new Map<number, ColorBucket>()

  let sumL = 0
  let sumL2 = 0
  let satSum = 0
  let meanRg = 0
  let meanYb = 0
  let meanRg2 = 0
  let meanYb2 = 0
  let whiteCount = 0
  let greenCount = 0
  let blueCount = 0
  let warmCount = 0
  let skinCount = 0
  let centerSkinCount = 0
  let centerCount = 0
  let darkCount = 0
  let topCount = 0
  let topBrightCount = 0
  const topBand = height * 0.38

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const luma = gray[y * width + x]

      sumL += luma
      sumL2 += luma * luma

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const delta = max - min
      const sat = max === 0 ? 0 : delta / max
      satSum += sat

      let hue = 0
      if (delta > 0) {
        if (max === r) hue = ((g - b) / delta) % 6
        else if (max === g) hue = (b - r) / delta + 2
        else hue = (r - g) / delta + 4
        hue *= 60
        if (hue < 0) hue += 360
      }

      const rg = r - g
      const yb = 0.5 * (r + g) - b
      meanRg += rg
      meanYb += yb
      meanRg2 += rg * rg
      meanYb2 += yb * yb

      if (luma > 232 && sat < 0.12) whiteCount += 1
      if (sat > 0.22 && hue >= 70 && hue <= 170) greenCount += 1
      if (sat > 0.2 && hue >= 175 && hue <= 265) blueCount += 1
      if (sat > 0.25 && (hue <= 55 || hue >= 330)) warmCount += 1
      if (luma < 44) darkCount += 1
      if (y < topBand) {
        topCount += 1
        if (luma > 150 && sat < 0.55) topBrightCount += 1
      }

      const isSkin =
        r > 80 &&
        g > 30 &&
        b > 15 &&
        r > g + 10 &&
        r > b + 18 &&
        delta > 18 &&
        luma > 35 &&
        luma < 240 &&
        sat > 0.2 &&
        sat < 0.62 &&
        hue >= 8 &&
        hue <= 40
      if (isSkin) {
        skinCount += 1
        const inCenter =
          x > width * 0.28 && x < width * 0.72 && y > height * 0.18 && y < height * 0.82
        if (inCenter) centerSkinCount += 1
      }
      if (x > width * 0.28 && x < width * 0.72 && y > height * 0.18 && y < height * 0.82) {
        centerCount += 1
      }

      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.count += 1
        bucket.r += r
        bucket.g += g
        bucket.b += b
        bucket.sat += sat
        bucket.luma += luma
      } else {
        buckets.set(key, { count: 1, r, g, b, sat, luma })
      }
    }
  }

  let edgeCount = 0
  let lapSum = 0
  let lapSum2 = 0
  let lapCount = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const c = gray[y * width + x]
      const l = gray[y * width + x - 1]
      const r = gray[y * width + x + 1]
      const u = gray[(y - 1) * width + x]
      const d = gray[(y + 1) * width + x]

      const lap = 4 * c - l - r - u - d
      lapSum += lap
      lapSum2 += lap * lap
      lapCount += 1

      const tl = gray[(y - 1) * width + x - 1]
      const tr = gray[(y - 1) * width + x + 1]
      const bl = gray[(y + 1) * width + x - 1]
      const br = gray[(y + 1) * width + x + 1]
      const gx = -tl + tr - 2 * l + 2 * r - bl + br
      const gy = -tl - 2 * u - tr + bl + 2 * d + br
      if (Math.sqrt(gx * gx + gy * gy) / 4 > 58) edgeCount += 1
    }
  }

  const meanL = sumL / total
  const variance = Math.max(0, sumL2 / total - meanL * meanL)
  const lapMean = lapCount ? lapSum / lapCount : 0
  const lapVariance = lapCount ? Math.max(0, lapSum2 / lapCount - lapMean * lapMean) : 0

  const mr = meanRg / total
  const my = meanYb / total
  const varRg = Math.max(0, meanRg2 / total - mr * mr)
  const varYb = Math.max(0, meanYb2 / total - my * my)
  const colorfulness = clamp(
    (Math.sqrt(varRg + varYb) + 0.3 * Math.sqrt(mr * mr + my * my)) / 110,
  )

  const candidates = [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      avgR: bucket.r / bucket.count,
      avgG: bucket.g / bucket.count,
      avgB: bucket.b / bucket.count,
      avgSat: bucket.sat / bucket.count,
      avgLuma: bucket.luma / bucket.count,
    }))
    .sort((a, b) => b.count - a.count)

  const colorful = candidates.filter(
    (bucket) => bucket.avgSat > 0.1 && bucket.avgLuma > 28 && bucket.avgLuma < 242,
  )
  const paletteSource = (colorful.length >= 2 ? colorful : candidates).slice(0, 6)
  const palette = paletteSource.map((bucket) => toHex(bucket.avgR, bucket.avgG, bucket.avgB))

  return {
    hash: hashFromGray(downsampleGray(gray, width, height, HASH_SIZE)),
    fingerprint: blockFingerprint(data, width, height),
    brightness: meanL / 255,
    contrast: clamp(Math.sqrt(variance) / 128),
    saturation: satSum / total,
    colorfulness,
    sharpness: lapVariance,
    edgeDensity: edgeCount / Math.max(1, (width - 2) * (height - 2)),
    whiteRatio: whiteCount / total,
    greenRatio: greenCount / total,
    blueRatio: blueCount / total,
    warmRatio: warmCount / total,
    skinRatio: skinCount / total,
    centerSkinRatio: centerCount ? centerSkinCount / centerCount : 0,
    darkRatio: darkCount / total,
    skyRatio: topCount ? topBrightCount / topCount : 0,
    palette,
    dominant: palette[0] ?? '#2c2f2a',
  }
}

function toHex(r: number, g: number, b: number): string {
  const part = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** 将亮度图按块平均降采样到 size×size。 */
export function downsampleGray(
  gray: ArrayLike<number>,
  srcWidth: number,
  srcHeight: number,
  size: number,
): Float32Array {
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y += 1) {
    const y0 = Math.floor((y * srcHeight) / size)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * srcHeight) / size))
    for (let x = 0; x < size; x += 1) {
      const x0 = Math.floor((x * srcWidth) / size)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * srcWidth) / size))
      let sum = 0
      let count = 0
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          sum += gray[sy * srcWidth + sx]
          count += 1
        }
      }
      out[y * size + x] = sum / count
    }
  }
  return out
}

/** 灰度差分哈希：比较每行相邻像素的明暗，输出十六进制字符串。 */
export function hashFromGray(
  gray: ArrayLike<number>,
  width = HASH_SIZE,
  height = HASH_SIZE,
): string {
  let hex = ''
  let nibble = 0
  let filled = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      nibble = (nibble << 1) | (gray[y * width + x] < gray[y * width + x + 1] ? 1 : 0)
      filled += 1
      if (filled === 4) {
        hex += nibble.toString(16)
        nibble = 0
        filled = 0
      }
    }
  }
  if (filled > 0) hex += (nibble << (4 - filled)).toString(16)
  return hex
}

/** 颜色指纹：8x8 区块的 RGB 均值，每通道量化为 4 bit。 */
export function blockFingerprint(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  blocks = FINGERPRINT_BLOCKS,
): string {
  let hex = ''
  const nibble = (value: number) =>
    Math.round(clamp(value / FINGERPRINT_STEP, 0, FINGERPRINT_LEVELS - 1)).toString(16)
  for (let by = 0; by < blocks; by += 1) {
    const y0 = Math.floor((by * height) / blocks)
    const y1 = Math.max(y0 + 1, Math.floor(((by + 1) * height) / blocks))
    for (let bx = 0; bx < blocks; bx += 1) {
      const x0 = Math.floor((bx * width) / blocks)
      const x1 = Math.max(x0 + 1, Math.floor(((bx + 1) * width) / blocks))
      let r = 0
      let g = 0
      let b = 0
      let count = 0
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * width + x) * 4
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          count += 1
        }
      }
      hex += nibble(r / count) + nibble(g / count) + nibble(b / count)
    }
  }
  return hex
}

function popcount32(value: number): number {
  let v = value - ((value >>> 1) & 0x55555555)
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333)
  v = (v + (v >>> 4)) & 0x0f0f0f0f
  return (v * 0x01010101) >>> 24
}

/** 两个十六进制指纹之间的比特差异数。 */
export function hammingDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a || !b || a.length !== b.length) return Math.max(a.length, b.length) * 4
  let distance = 0
  for (let i = 0; i < a.length; i += 8) {
    const av = parseInt(a.slice(i, i + 8).padEnd(8, '0'), 16)
    const bv = parseInt(b.slice(i, i + 8).padEnd(8, '0'), 16)
    distance += popcount32((av ^ bv) >>> 0)
  }
  return distance
}

function readNibbles(value: string): number[] | null {
  const nibbles: number[] = []
  for (let i = 0; i < value.length; i += 1) {
    const parsed = parseInt(value[i], 16)
    if (Number.isNaN(parsed)) return null
    nibbles.push(parsed)
  }
  return nibbles
}

/** 颜色指纹的欧氏距离，单位为量化级（0-15）。 */
export function colorDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY
  const left = readNibbles(a)
  const right = readNibbles(b)
  if (!left || !right) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let i = 0; i < left.length; i += 1) {
    const delta = left[i] - right[i]
    sum += delta * delta
  }
  return Math.sqrt(sum / left.length)
}

export interface ClassifyInput {
  name: string
  type: string
  width: number
  height: number
  whiteRatio: number
  edgeDensity: number
  brightness: number
  skinRatio: number
  centerSkinRatio: number
  greenRatio: number
  blueRatio: number
  warmRatio: number
  saturation: number
  contrast?: number
  colorfulness?: number
  darkRatio?: number
  skyRatio?: number
}

export interface Classification {
  album: AlbumId
  confidence: number
  albums: AlbumId[]
  scores: Partial<Record<AlbumId, number>>
}

const SCREENSHOT_NAME =
  /screenshot|screen[\s_-]?shot|截屏|截图|屏幕快照|录屏|snipaste|simulator[\s_-]?screen/i
const DOCUMENT_NAME =
  /scan|receipt|invoice|document|form|发票|票据|凭证|合同|账单|小票|收据|名片|报表|简历/i

/** 线性斜坡：value 从 from 到 to 时结果从 0 升到 1。 */
function ramp(value: number, from: number, to: number): number {
  if (to === from) return value >= to ? 1 : 0
  return clamp((value - from) / (to - from))
}

/** 只有这些类别允许作为副标签，避免「日常」等兜底类别扩散。 */
const SECONDARY_ALBUMS: AlbumId[] = ['nature', 'food', 'night', 'people']

/**
 * 多信号打分：每个类别独立计算 0-1 的可信度，主类别取最高分，
 * 高分的次要类别会一并保留，让一张照片可以同时出现在多个相册。
 */
export function classifyPhoto(input: ClassifyInput): Classification {
  const ratio = input.height / input.width
  const darkRatio = input.darkRatio ?? 0
  const skyRatio = input.skyRatio ?? 0
  const contrast = input.contrast ?? 0.24
  const colorfulness = input.colorfulness ?? 0.4
  const phoneShape = (ratio > 1.6 && ratio < 2.6) || (ratio > 0.38 && ratio < 0.63)
  const paperShape =
    (ratio > 1.24 && ratio < 1.58) || (ratio > 0.63 && ratio < 0.82)

  // 截图：文件名最可靠，其次是「浅色界面 + 丰富边缘 + 低饱和」的 UI 特征。
  const flatUi =
    ramp(input.whiteRatio, 0.12, 0.42) *
    ramp(input.edgeDensity, 0.03, 0.085) *
    (1 - ramp(input.saturation, 0.2, 0.45)) *
    (1 - ramp(colorfulness, 0.45, 0.75))
  const screenshot = SCREENSHOT_NAME.test(input.name)
    ? 0.97
    : clamp(0.92 * flatUi * (phoneShape ? 1 : 0.62))

  // 文档：纸面白底 + 文字边缘 + 低饱和，票证类文件名直接判定。
  const paperLike =
    ramp(input.whiteRatio, 0.24, 0.58) *
    ramp(input.edgeDensity, 0.035, 0.085) *
    (1 - ramp(input.saturation, 0.12, 0.32))
  const documents = DOCUMENT_NAME.test(input.name)
    ? 0.94
    : clamp(0.9 * paperLike + (paperShape && input.whiteRatio > 0.3 ? 0.12 : 0))

  // 夜景：亮度极低直接判定；否则用暗部占比与整体亮度共同评估。
  const night =
    input.brightness < 0.15
      ? 0.9
      : clamp(
          0.58 * ramp(0.3 - input.brightness, 0, 0.16) +
            0.5 * ramp(darkRatio, 0.4, 0.8) +
            (input.brightness < 0.24 ? 0.1 : 0),
        )

  // 人物：中央肤色是主证据，面部越居中越可信。
  const faceFactor = 1 - 0.5 * ramp(input.centerSkinRatio, 0.35, 0.55)
  const skinOverload =
    ramp(input.warmRatio, 0.5, 0.85) * ramp(input.saturation, 0.36, 0.55) * faceFactor
  const people = clamp(
    0.98 *
      ramp(input.centerSkinRatio, 0.2, 0.45) *
      (0.6 + 0.4 * ramp(input.skinRatio, 0.03, 0.18)) -
      skinOverload * 0.45,
  )

  // 风景：绿意、天空蓝、上部亮带与纹理共同决定。
  const nature = clamp(
    0.92 * ramp(input.greenRatio, 0.16, 0.44) +
      0.78 * ramp(input.blueRatio, 0.15, 0.4) +
      0.42 * ramp(skyRatio, 0.3, 0.72) * (0.6 + 0.4 * ramp(contrast, 0.14, 0.34)) +
      0.18 * ramp(input.edgeDensity, 0.07, 0.18),
  )

  // 美食：暖色高饱和为主体，蓝绿与天空特征明显时按风景处理。
  const foodGate =
    (1 - 0.7 * ramp(input.blueRatio, 0.12, 0.34)) *
    (1 - 0.6 * ramp(input.greenRatio, 0.12, 0.36)) *
    (1 - 0.5 * ramp(skyRatio, 0.35, 0.7))
  const food = clamp(
    0.95 *
      ramp(input.warmRatio, 0.24, 0.5) *
      (0.58 + 0.42 * ramp(input.saturation, 0.26, 0.45)) *
      foodGate *
      faceFactor +
      skinOverload * 0.5,
  )

  const scores: Record<AlbumId, number> = {
    screenshots: screenshot,
    documents,
    night,
    people,
    nature,
    food,
    moments: 0.4,
  }

  const ranked = (Object.keys(scores) as AlbumId[])
    .map((album) => ({ album, score: scores[album] }))
    .sort((a, b) => b.score - a.score)

  const primary = ranked[0]
  const confidence =
    primary.album === 'moments'
      ? clamp(0.5 + primary.score * 0.3, 0.5, 0.68)
      : clamp(0.58 + primary.score * 0.42, 0.6, 0.97)

  const albums: AlbumId[] = [primary.album]
  for (const candidate of ranked.slice(1)) {
    if (albums.length >= 3) break
    if (!SECONDARY_ALBUMS.includes(candidate.album)) continue
    if (candidate.score < 0.5) continue
    if (candidate.score < primary.score * 0.75) continue
    albums.push(candidate.album)
  }

  return { album: primary.album, confidence, albums, scores }
}

export function computeQuality(
  photo: Pick<
    PhotoMeta,
    | 'sharpness'
    | 'edgeDensity'
    | 'contrast'
    | 'width'
    | 'height'
    | 'brightness'
    | 'colorfulness'
  >,
): number {
  const sharpness = clamp(Math.sqrt(photo.sharpness / 900))
  const detail = clamp(photo.edgeDensity / 0.12)
  const contrast = clamp(photo.contrast / 0.26)
  const resolution = clamp(Math.min(photo.width, photo.height) / 1080)
  const exposure = 1 - Math.min(1, Math.abs(photo.brightness - 0.5) / 0.5)
  const color = clamp(photo.colorfulness / 0.55)
  const score =
    100 *
    (0.42 * sharpness +
      0.16 * detail +
      0.12 * contrast +
      0.14 * resolution +
      0.1 * exposure +
      0.06 * color)
  return Math.round(clamp(score, 1, 100))
}

export function detectIssues(
  photo: Pick<
    PhotoMeta,
    'album' | 'sharpness' | 'brightness' | 'width' | 'height' | 'quality'
  > & { albums?: AlbumId[] },
): Issue[] {
  const issues: Issue[] = []
  const albums = photo.albums?.length ? photo.albums : [photo.album]
  const isDocument = albums.some(
    (album) => album === 'documents' || album === 'screenshots',
  )

  if (!isDocument && photo.sharpness < BLUR_THRESHOLD) {
    issues.push({
      type: 'blurry',
      label: '画面模糊',
      detail: '对焦或手抖导致细节不足',
      severity: photo.sharpness < STRONG_BLUR_THRESHOLD ? 'high' : 'medium',
    })
  }

  if (!isDocument && photo.brightness < 0.12) {
    issues.push({
      type: 'dark',
      label: '曝光偏暗',
      detail: '暗部细节难以辨认',
      severity: photo.brightness < 0.075 ? 'high' : 'medium',
    })
  }

  if (!isDocument && photo.brightness > 0.92) {
    issues.push({
      type: 'overexposed',
      label: '曝光过度',
      detail: '高光区域丢失细节',
      severity: 'medium',
    })
  }

  if (!isDocument && Math.min(photo.width, photo.height) < LOW_RES_SHORT_SIDE) {
    issues.push({
      type: 'lowres',
      label: '分辨率偏低',
      detail: `短边仅 ${Math.min(photo.width, photo.height)}px`,
      severity: Math.min(photo.width, photo.height) < 480 ? 'high' : 'medium',
    })
  }

  return issues
}
