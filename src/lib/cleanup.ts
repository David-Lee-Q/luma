import {
  DUPLICATE_COLOR,
  DUPLICATE_DISTANCE,
  FINGERPRINT_HEX_LENGTH,
  HASH_HEX_LENGTH,
  SIMILAR_COLOR,
  SIMILAR_DISTANCE,
  colorDistance,
  detectIssues,
  hammingDistance,
} from './analysis'
import type { Issue, PhotoMeta } from './types'

export interface DuplicateGroup {
  key: string
  photos: PhotoMeta[]
  keeperId: string
  kind: 'duplicate' | 'similar'
  maxDistance: number
  savedBytes: number
}

export interface IssuePhoto {
  photo: PhotoMeta
  issues: Issue[]
}

export interface CleanupPlan {
  groups: DuplicateGroup[]
  issuePhotos: IssuePhoto[]
  suggestedIds: string[]
  recommendedCount: number
  reclaimableBytes: number
  duplicatePhotoCount: number
}

function isFingerprinted(photo: PhotoMeta): boolean {
  return (
    typeof photo.hash === 'string' &&
    typeof photo.fingerprint === 'string' &&
    photo.hash.length === HASH_HEX_LENGTH &&
    photo.fingerprint.length === FINGERPRINT_HEX_LENGTH
  )
}

/** 同时比较感知哈希与颜色指纹，避免低纹理画面被误判成相似。 */
export function isSimilar(a: PhotoMeta, b: PhotoMeta, kind: 'duplicate' | 'similar'): boolean {
  const hash = hammingDistance(a.hash, b.hash)
  const color = colorDistance(a.fingerprint, b.fingerprint)
  if (kind === 'duplicate') {
    return hash <= DUPLICATE_DISTANCE && color <= DUPLICATE_COLOR
  }
  return hash <= SIMILAR_DISTANCE && color <= SIMILAR_COLOR
}

function keeperScore(photo: PhotoMeta): number {
  return photo.quality * 1000 + Math.min(photo.width * photo.height, 24_000_000) / 1000
}

/**
 * 贪心聚类：每张照片只与簇代表（画质最佳者）比较。
 * 这样可以避免“A 像 B、B 像 C 就判定 A 像 C”的传递性串联。
 */
export function findDuplicateGroups(photos: PhotoMeta[]): DuplicateGroup[] {
  const candidates = photos
    .filter(isFingerprinted)
    .sort((a, b) => keeperScore(b) - keeperScore(a))

  const clusters: Array<{ keeper: PhotoMeta; members: PhotoMeta[] }> = []
  candidates.forEach((photo) => {
    const cluster = clusters.find((entry) => isSimilar(entry.keeper, photo, 'similar'))
    if (cluster) cluster.members.push(photo)
    else clusters.push({ keeper: photo, members: [photo] })
  })

  const groups: DuplicateGroup[] = []
  clusters.forEach(({ keeper, members }) => {
    if (members.length < 2) return
    let maxDistance = 0
    let allDuplicates = true
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        maxDistance = Math.max(maxDistance, hammingDistance(members[i].hash, members[j].hash))
        if (!isSimilar(members[i], members[j], 'duplicate')) allDuplicates = false
      }
    }
    groups.push({
      key: members
        .map((photo) => photo.id)
        .sort()
        .join('|'),
      photos: members,
      keeperId: keeper.id,
      kind: allDuplicates ? 'duplicate' : 'similar',
      maxDistance,
      savedBytes: members
        .filter((photo) => photo.id !== keeper.id)
        .reduce((sum, photo) => sum + photo.size, 0),
    })
  })

  return groups.sort((a, b) => b.savedBytes - a.savedBytes)
}

export function buildCleanupPlan(
  photos: PhotoMeta[],
  keeperOverrides: Record<string, string> = {},
): CleanupPlan {
  const groups = findDuplicateGroups(photos).map((group) => {
    const override = keeperOverrides[group.key]
    if (!override || !group.photos.some((photo) => photo.id === override)) return group
    return {
      ...group,
      keeperId: override,
      savedBytes: group.photos
        .filter((photo) => photo.id !== override)
        .reduce((sum, photo) => sum + photo.size, 0),
    }
  })

  const duplicateDeletes = new Set<string>()
  groups.forEach((group) => {
    if (group.kind !== 'duplicate') return
    group.photos.forEach((photo) => {
      if (photo.id !== group.keeperId) duplicateDeletes.add(photo.id)
    })
  })

  const issuePhotos: IssuePhoto[] = photos
    .map((photo) => ({ photo, issues: detectIssues(photo) }))
    .filter((entry) => entry.issues.length > 0)
    .sort((a, b) => {
      const weight = (entry: IssuePhoto) =>
        entry.issues.reduce((sum, issue) => sum + (issue.severity === 'high' ? 2 : 1), 0)
      return weight(b) - weight(a) || a.photo.quality - b.photo.quality
    })

  const suggested = new Set<string>(duplicateDeletes)
  issuePhotos.forEach((entry) => suggested.add(entry.photo.id))

  const reclaimableBytes = photos
    .filter((photo) => suggested.has(photo.id))
    .reduce((sum, photo) => sum + photo.size, 0)

  return {
    groups,
    issuePhotos,
    suggestedIds: [...suggested],
    recommendedCount: suggested.size,
    reclaimableBytes,
    duplicatePhotoCount: duplicateDeletes.size,
  }
}
