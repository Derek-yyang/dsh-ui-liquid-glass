/** Device-local persistence for the custom wallpaper image. IndexedDB because
 * images dwarf what localStorage or the Host settings document should carry;
 * being device-local is the accepted trade (the Host namespace stores only
 * the preset id). Every operation degrades to a no-op on failure — private
 * mode or blocked storage loses the image, never breaks the page. */

const DB_NAME = 'dsh-ui-liquid-glass'
const DB_VERSION = 1
const STORE = 'wallpaper'
const KEY = 'custom'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION)
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE)
    }
    open.onsuccess = () => { resolve(open.result) }
    open.onerror = () => { reject(open.error ?? new Error('indexedDB.open failed')) }
  })
}

function request<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => { resolve(request.result) }
    request.onerror = () => { reject(request.error ?? new Error('indexedDB request failed')) }
  })
}

/**
 * Read the stored custom image; undefined when none or storage unavailable.
 * @returns the stored image blob, or undefined when none was ever uploaded.
 */
export async function loadCustomWallpaper(): Promise<Blob | undefined> {
  try {
    const db = await openDb()
    const store = db.transaction(STORE).objectStore(STORE)
    return await request<Blob | undefined>(store.get(KEY))
  } catch {
    return undefined
  }
}

/**
 * Persist the custom image, replacing any previous one.
 * @param blob - the image bytes to store.
 * @returns resolves once the blob is written.
 */
export async function saveCustomWallpaper(blob: Blob): Promise<void> {
  const db = await openDb()
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
  await request(store.put(blob, KEY))
  db.close()
}
