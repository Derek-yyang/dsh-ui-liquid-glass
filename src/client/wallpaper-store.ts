/** Device-local persistence for custom wallpaper images. IndexedDB because
 * images dwarf what localStorage or the Host settings document should carry;
 * being device-local is the accepted trade (the Host namespace stores only
 * the preset id). Every read degrades to empty on failure — private mode or
 * blocked storage loses the images, never breaks the page. */

import { WALLPAPER_PRESETS, type WallpaperPreset } from '../tokens.ts'

const DB_NAME = 'dsh-ui-liquid-glass'
const DB_VERSION = 2
const LEGACY_STORE = 'wallpaper'
const LEGACY_KEY = 'custom'
const STORE = 'gallery'

/** One custom wallpaper stored on this device. */
export interface GalleryRecord {
  /** Opaque id used in the Host preset field as `c_<id>`. */
  id: string
  /** Image bytes. */
  blob: Blob
  /** Upload time, milliseconds since epoch; gallery order is oldest first. */
  createdAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION)
    open.onupgradeneeded = (event) => {
      const db = open.result
      const tx = open.transaction
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      if (event.oldVersion < 2 && tx !== null && db.objectStoreNames.contains(LEGACY_STORE)) {
        const legacy = tx.objectStore(LEGACY_STORE)
        const gallery = tx.objectStore(STORE)
        const get = legacy.get(LEGACY_KEY)
        get.onsuccess = () => {
          const blob = get.result
          if (!(blob instanceof Blob)) return
          gallery.put({ id: 'legacy', blob, createdAt: 0 })
        }
      }
    }
    open.onsuccess = () => { resolve(open.result) }
    open.onerror = () => { reject(open.error ?? new Error('indexedDB.open failed')) }
  })
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => { resolve(req.result) }
    req.onerror = () => { reject(req.error ?? new Error('indexedDB request failed')) }
  })
}

/** Mint a short id safe in a Host preset string. */
function mintId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Load every custom wallpaper, oldest first. Empty when none or storage fails.
 * @returns the gallery records.
 */
export async function loadGallery(): Promise<GalleryRecord[]> {
  try {
    const db = await openDb()
    const store = db.transaction(STORE).objectStore(STORE)
    const rows = await request<GalleryRecord[]>(store.getAll())
    db.close()
    return [...rows].sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return []
  }
}

/**
 * Persist a new custom image and return its record.
 * @param blob - the image bytes to store.
 * @returns the stored record.
 */
export async function addGalleryImage(blob: Blob): Promise<GalleryRecord> {
  const record: GalleryRecord = { id: mintId(), blob, createdAt: Date.now() }
  const db = await openDb()
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
  await request(store.put(record))
  db.close()
  return record
}

/**
 * Delete one custom image.
 * @param id - gallery record id.
 * @returns resolves once the record is gone (or was already absent).
 */
export async function removeGalleryImage(id: string): Promise<void> {
  const db = await openDb()
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
  await request(store.delete(id))
  db.close()
}

/**
 * Host preset id for a gallery record.
 * @param id - gallery record id.
 * @returns the preset string stored in the Host document.
 */
export function customPresetId(id: string): `c_${string}` {
  return `c_${id}`
}

/**
 * Parse a Host preset id that names a gallery record.
 * @param preset - Host preset field.
 * @returns the gallery id, or undefined when the preset is not a custom tile.
 */
export function galleryIdFromPreset(preset: string): string | undefined {
  if (preset === 'custom') return 'legacy'
  if (preset.startsWith('c_')) return preset.slice(2)
  return undefined
}

/**
 * Long-press cycle: built-ins in `WALLPAPER_PRESETS` order, then every
 * device-local custom id oldest-first. An unknown or retired Host id
 * (`collage`, a deleted `c_*`) is treated as `ridge` so the next press
 * always lands on a live tile.
 * @param current - the active Host preset id.
 * @param galleryIds - custom image ids currently on this device, oldest first.
 * @returns the next preset in the cycle.
 */
export function nextWallpaperPreset(
  current: string,
  galleryIds: readonly string[],
): WallpaperPreset {
  const ring: WallpaperPreset[] = [
    ...WALLPAPER_PRESETS,
    ...galleryIds.map(id => customPresetId(id)),
  ]
  const index = ring.indexOf(current as WallpaperPreset)
  const from = index === -1 ? 0 : index
  return ring[(from + 1) % ring.length] ?? WALLPAPER_PRESETS[0]
}
