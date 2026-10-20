export type AlbumId =
  | 'people'
  | 'nature'
  | 'food'
  | 'night'
  | 'screenshots'
  | 'documents'
  | 'moments'

export interface AlbumMeta {
  id: AlbumId
  name: string
  tagline: string
  color: string
}

export const ALBUMS: AlbumMeta[] = [
  { id: 'people', name: '人物', tagline: '表情与身影', color: '#E5A57C' },
  { id: 'nature', name: '风景', tagline: '山川与天空', color: '#94CEA4' },
  { id: 'food', name: '美食', tagline: '热气腾腾的一餐', color: '#EFB35F' },
  { id: 'night', name: '夜景', tagline: '夜色与灯火', color: '#9099DE' },
  { id: 'screenshots', name: '截图', tagline: '界面与灵感碎片', color: '#9BBBD8' },
  { id: 'documents', name: '文档', tagline: '纸张与文字', color: '#CBC5B3' },
  { id: 'moments', name: '日常', tagline: '生活里的其他片段', color: '#BCA9E2' },
]

export const ALBUM_MAP: Record<AlbumId, AlbumMeta> = Object.fromEntries(
  ALBUMS.map((album) => [album.id, album]),
) as Record<AlbumId, AlbumMeta>

export interface PhotoStats {
  hash: string
  fingerprint: string
  brightness: number
  contrast: number
  saturation: number
  colorfulness: number
  sharpness: number
  edgeDensity: number
  whiteRatio: number
  greenRatio: number
  blueRatio: number
  warmRatio: number
  skinRatio: number
  centerSkinRatio: number
  darkRatio: number
  skyRatio: number
  palette: string[]
  dominant: string
}

export type AlbumSource = 'local' | 'cloud' | 'manual'

export interface CloudInsight {
  desc: string
  tags: string[]
  album: AlbumId | null
  albumConfidence: number
  albums: AlbumId[]
  advice: string
  model: string
  at: number
}

export interface PhotoMeta extends PhotoStats {
  id: string
  name: string
  type: string
  size: number
  width: number
  height: number
  takenAt: number
  addedAt: number
  album: AlbumId
  albumConfidence: number
  albums: AlbumId[]
  localAlbum: AlbumId
  localAlbums: AlbumId[]
  albumSource: AlbumSource
  manualAlbums: AlbumId[]
  quality: number
  favorite: boolean
  analyzed: boolean
  insight?: CloudInsight
}

export interface AnalysisResult extends PhotoStats {
  width: number
  height: number
}

export interface Issue {
  type: 'blurry' | 'dark' | 'overexposed' | 'lowres'
  label: string
  detail: string
  severity: 'high' | 'medium'
}

export type TabId = 'library' | 'albums' | 'cleanup' | 'slideshow'

export type ToastTone = 'default' | 'success' | 'warning'

export interface ToastMessage {
  id: number
  text: string
  tone: ToastTone
}
