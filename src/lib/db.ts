import type { AlbumId, PhotoMeta } from './types'

const DB_NAME = 'luma-photo-db'
const DB_VERSION = 3
const META_STORE = 'photos'
const BLOB_STORE = 'blobs'
const VECTOR_STORE = 'vectors'
const MEDIA_STORE = 'media'
const BGM_KEY = 'bgm'

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE)
      }
      if (!db.objectStoreNames.contains(VECTOR_STORE)) {
        db.createObjectStore(VECTOR_STORE)
      }
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开本地数据库'))
  })
  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('本地存储操作失败'))
  })
}

function txDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('本地存储写入失败'))
    transaction.onabort = () => reject(transaction.error ?? new Error('本地存储写入被中断'))
  })
}

export interface StoredPhoto {
  meta: PhotoMeta
  blob: Blob
}

/** 兼容 v1 数据结构：补出多相册字段并清理历史的手动标记。 */
function normalizeMeta(raw: PhotoMeta): PhotoMeta {
  const legacy = raw as PhotoMeta & { manualAlbum?: boolean }
  const stored: Partial<PhotoMeta> = raw
  const localAlbum = stored.localAlbum ?? raw.album ?? 'moments'
  const legacyLocal: AlbumId[] = stored.localAlbums ?? []
  const localAlbums = legacyLocal.length
    ? legacyLocal
    : raw.album && raw.album !== localAlbum
      ? [localAlbum, raw.album]
      : [localAlbum]
  const manualAlbums = stored.manualAlbums ?? (legacy.manualAlbum ? [raw.album] : [])
  const albumSource = stored.albumSource ?? (manualAlbums.length ? 'manual' : 'local')
  const storedAlbums: AlbumId[] = stored.albums ?? []
  const albums = storedAlbums.length
    ? storedAlbums
    : manualAlbums.length
      ? manualAlbums
      : localAlbums
  const { manualAlbum: _legacyFlag, ...rest } = legacy
  return {
    ...(rest as PhotoMeta),
    localAlbum: localAlbums[0] ?? localAlbum,
    localAlbums,
    manualAlbums,
    albums,
    album: albums[0] ?? localAlbum,
    albumSource,
    darkRatio: raw.darkRatio ?? 0,
    skyRatio: raw.skyRatio ?? 0,
  }
}

export async function loadLibrary(): Promise<StoredPhoto[]> {
  const db = await openDatabase()
  const transaction = db.transaction([META_STORE, BLOB_STORE], 'readonly')
  const metaRequest = transaction.objectStore(META_STORE).getAll() as IDBRequest<PhotoMeta[]>
  const keyRequest = transaction.objectStore(BLOB_STORE).getAllKeys()
  const blobRequest = transaction.objectStore(BLOB_STORE).getAll() as IDBRequest<Blob[]>
  const [metas, keys, blobs] = await Promise.all([
    requestToPromise(metaRequest),
    requestToPromise(keyRequest),
    requestToPromise(blobRequest),
  ])
  const blobMap = new Map(keys.map((key, index) => [String(key), blobs[index]]))
  return metas
    .map((meta) => ({ meta: normalizeMeta(meta), blob: blobMap.get(meta.id) }))
    .filter((entry): entry is StoredPhoto => entry.blob instanceof Blob)
}

export async function savePhoto(meta: PhotoMeta, blob: Blob): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction([META_STORE, BLOB_STORE], 'readwrite')
  transaction.objectStore(META_STORE).put(meta)
  transaction.objectStore(BLOB_STORE).put(blob, meta.id)
  await txDone(transaction)
}

export async function saveMeta(meta: PhotoMeta): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(META_STORE, 'readwrite')
  transaction.objectStore(META_STORE).put(meta)
  await txDone(transaction)
}

export async function deletePhotos(ids: string[]): Promise<void> {
  if (!ids.length) return
  const db = await openDatabase()
  const transaction = db.transaction([META_STORE, BLOB_STORE, VECTOR_STORE], 'readwrite')
  const metaStore = transaction.objectStore(META_STORE)
  const blobStore = transaction.objectStore(BLOB_STORE)
  const vectorStore = transaction.objectStore(VECTOR_STORE)
  ids.forEach((id) => {
    metaStore.delete(id)
    blobStore.delete(id)
    vectorStore.delete(id)
  })
  await txDone(transaction)
}

export async function saveVectors(
  entries: Array<{ id: string; vector: number[] }>,
): Promise<void> {
  if (!entries.length) return
  const db = await openDatabase()
  const transaction = db.transaction(VECTOR_STORE, 'readwrite')
  const store = transaction.objectStore(VECTOR_STORE)
  entries.forEach((entry) => store.put(entry.vector, entry.id))
  await txDone(transaction)
}

export async function loadVectors(): Promise<Map<string, number[]>> {
  const db = await openDatabase()
  const transaction = db.transaction(VECTOR_STORE, 'readonly')
  const store = transaction.objectStore(VECTOR_STORE)
  const keyRequest = store.getAllKeys()
  const valueRequest = store.getAll() as IDBRequest<number[][]>
  const [keys, values] = await Promise.all([
    requestToPromise(keyRequest),
    requestToPromise(valueRequest),
  ])
  return new Map(keys.map((key, index) => [String(key), values[index]]))
}

export async function clearVectors(ids?: string[]): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(VECTOR_STORE, 'readwrite')
  const store = transaction.objectStore(VECTOR_STORE)
  if (!ids || !ids.length) store.clear()
  else ids.forEach((id) => store.delete(id))
  await txDone(transaction)
}

export async function saveMetas(metas: PhotoMeta[]): Promise<void> {
  if (!metas.length) return
  const db = await openDatabase()
  const transaction = db.transaction(META_STORE, 'readwrite')
  const store = transaction.objectStore(META_STORE)
  metas.forEach((meta) => store.put(meta))
  await txDone(transaction)
}

export interface StoredBgm {
  blob: Blob
  name: string
}

/** 保存用户上传的背景音乐；传入 null 表示清除。 */
export async function saveBgmBlob(blob: Blob | null, name = ''): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(MEDIA_STORE, 'readwrite')
  const store = transaction.objectStore(MEDIA_STORE)
  if (blob) store.put({ blob, name }, BGM_KEY)
  else store.delete(BGM_KEY)
  await txDone(transaction)
}

export async function loadBgmBlob(): Promise<StoredBgm | null> {
  const db = await openDatabase()
  const transaction = db.transaction(MEDIA_STORE, 'readonly')
  const request = transaction.objectStore(MEDIA_STORE).get(BGM_KEY) as IDBRequest<
    StoredBgm | undefined
  >
  const stored = await requestToPromise(request)
  return stored && stored.blob instanceof Blob ? stored : null
}

export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const estimate = await navigator.storage.estimate()
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
  } catch {
    return null
  }
}
