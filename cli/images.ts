import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

const MAX_BYTES = 8 * 1024 * 1024
const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

async function load(src: string, baseDir: string): Promise<{ data: Buffer; type: string }> {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'mopai' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const type = (res.headers.get('content-type') || '').split(';')[0]
    if (!type.startsWith('image/')) throw new Error(`不是图片（${type || '未知类型'}）`)
    return { data: Buffer.from(await res.arrayBuffer()), type }
  }
  const path = resolve(baseDir, decodeURI(src))
  const type = TYPES[extname(path).toLowerCase()]
  if (!type) throw new Error('不支持的图片格式')
  return { data: await readFile(path), type }
}

/**
 * 把 Markdown 里的图片（本地路径或网络地址）转成 data URL。
 * 这样卡片导出不受跨域限制，相对路径也能找到文件。
 */
export async function inlineImages(md: string, baseDir: string) {
  const warnings: string[] = []
  const srcs = new Set(Array.from(md.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g), (m) => m[1]))
  const map = new Map<string, string>()
  await Promise.all(
    Array.from(srcs)
      .filter((src) => !src.startsWith('data:'))
      .map(async (src) => {
        try {
          const { data, type } = await load(src, baseDir)
          if (data.length > MAX_BYTES) throw new Error('图片超过 8MB')
          map.set(src, `data:${type};base64,${data.toString('base64')}`)
        } catch (e) {
          warnings.push(`图片加载失败，已跳过：${src}（${(e as Error).message}）`)
        }
      }),
  )
  const out = md.replace(/(!\[[^\]]*\]\(\s*<?)([^)\s>]+)(>?(?:\s+"[^"]*")?\s*\))/g, (all, a, src, b) => (map.has(src) ? a + map.get(src) + b : all))
  return { md: out, warnings }
}
