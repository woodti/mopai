/**
 * 本地图片：存进 IndexedDB，Markdown 里只写短引用 img://<id>，
 * 渲染时换成 blob URL，复制到公众号时再转成 data URL。
 */

export const LOCAL_PREFIX = 'img://'
const MAX_SIDE = 1600

const memory = new Map<string, Blob>() // IndexedDB 不可用时的兜底
const urls = new Map<string, string>()

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('mopai', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('images')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = run(db.transaction('images', mode).objectStore('images'))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 大图缩到长边 1600px，避免卡片导出和公众号粘贴时体积过大 */
async function shrink(file: Blob): Promise<Blob> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88))
  return out && out.size < file.size ? out : file
}

export async function saveImage(file: Blob): Promise<string> {
  const blob = await shrink(file)
  const id = Math.random().toString(36).slice(2, 8)
  try {
    await tx('readwrite', (store) => store.put(blob, id))
  } catch {
    memory.set(id, blob)
  }
  urls.set(id, URL.createObjectURL(blob))
  return id
}

export function localIds(md: string) {
  return Array.from(md.matchAll(/img:\/\/([a-z0-9]+)/g), (m) => m[1])
}

/** 加载 Markdown 引用到的图片，返回是否有新加载的 */
export async function loadImages(ids: string[]): Promise<boolean> {
  let changed = false
  for (const id of ids) {
    if (urls.has(id)) continue
    let blob = memory.get(id)
    if (!blob) {
      try {
        blob = (await tx<Blob | undefined>('readonly', (store) => store.get(id))) || undefined
      } catch {
        // 读不到就当图片丢失
      }
    }
    if (blob) {
      urls.set(id, URL.createObjectURL(blob))
      changed = true
    }
  }
  return changed
}

export function resolveSrc(src: string) {
  if (!src.startsWith(LOCAL_PREFIX)) return src
  return urls.get(src.slice(LOCAL_PREFIX.length)) || ''
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** 把元素里的 blob 图片换成 data URL，返回替换的数量 */
export async function inlineBlobImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img[src^="blob:"]'))
  await Promise.all(
    imgs.map(async (img) => {
      const blob = await fetch(img.src).then((r) => r.blob())
      img.src = await toDataUrl(blob)
    }),
  )
  return imgs.length
}
