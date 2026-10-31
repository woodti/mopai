import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { toThread } from '../src/tweets'
import { DEFAULTS, type Settings } from '../src/settings'
import type { Engine } from './engine'
import { inlineImages } from './images'

export type Target = 'wechat' | 'xhs' | 'x'
export const TARGETS: Target[] = ['wechat', 'xhs', 'x']

export type RenderResult = {
  outDir: string
  wechat?: string
  cards: string[]
  thread?: string
  tweets: string[]
  markdown?: string
  warnings: string[]
}

export function slugify(text: string) {
  return (
    text
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'mopai'
  )
}

export function titleOf(md: string) {
  return md.match(/^#\s+(.+)$/m)?.[1].trim() || ''
}

/** 默认输出到当前目录下的 mopai-out/；MCP 客户端的工作目录可能是 /，此时改用用户目录 */
export function defaultOutDir(name: string) {
  const base = process.cwd() === '/' ? homedir() : process.cwd()
  return join(base, 'mopai-out', slugify(name))
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 生成一个带「复制到公众号」按钮的本地页面，双击打开即可复制 */
function wechatPage(article: string, title: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || '公众号排版')} · 墨排</title>
<style>
  body { margin: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
  .bar { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; background: #fff; border-bottom: 1px solid #e4e4e7; }
  .bar span { font-size: 13px; color: #71717a; }
  .bar button { padding: 9px 16px; border: 0; border-radius: 8px; background: #18181b; color: #fff; font-size: 14px; cursor: pointer; }
  .page { max-width: 420px; margin: 24px auto 60px; padding: 24px 18px 40px; border-radius: 16px; background: #fff; box-shadow: 0 8px 28px rgba(0,0,0,.06); }
</style>
</head>
<body>
<div class="bar"><span>由墨排生成 · 点击按钮后去公众号后台粘贴</span><button id="copy">复制到公众号</button></div>
<div class="page" id="article">${article}</div>
<script>
document.getElementById('copy').onclick = async function () {
  var el = document.getElementById('article'), btn = this
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([el.innerHTML], { type: 'text/html' }),
      'text/plain': new Blob([el.innerText], { type: 'text/plain' })
    })])
  } catch (e) {
    var range = document.createRange(); range.selectNodeContents(el)
    var sel = getSelection(); sel.removeAllRanges(); sel.addRange(range)
    document.execCommand('copy'); sel.removeAllRanges()
  }
  btn.textContent = '已复制 ✓'
  setTimeout(function () { btn.textContent = '复制到公众号' }, 2000)
}
</script>
</body>
</html>
`
}

export async function render(
  source: string,
  o: {
    targets: Target[]
    outDir: string
    settings: Partial<Settings>
    baseDir: string
    engine: () => Promise<Engine>
    saveMarkdown?: boolean
  },
): Promise<RenderResult> {
  const s = { ...DEFAULTS, ...o.settings }
  const outDir = resolve(o.outDir)
  await mkdir(outDir, { recursive: true })
  const result: RenderResult = { outDir, cards: [], tweets: [], warnings: [] }

  if (o.saveMarkdown) {
    result.markdown = join(outDir, 'source.md')
    await writeFile(result.markdown, source)
  }

  if (o.targets.includes('x')) {
    result.tweets = toThread(source, { limit: s.xLimit, numbering: s.xNumber, unicodeBold: s.xBold, threadEmoji: s.xEmoji })
    result.thread = join(outDir, 'x-thread.txt')
    await writeFile(result.thread, result.tweets.join('\n\n----------\n\n') + '\n')
  }

  if (o.targets.includes('wechat') || o.targets.includes('xhs')) {
    const { md, warnings } = await inlineImages(source, o.baseDir)
    result.warnings.push(...warnings)
    const engine = await o.engine()
    if (o.targets.includes('wechat')) {
      result.wechat = join(outDir, 'wechat.html')
      await writeFile(result.wechat, wechatPage(await engine.wechat(md, s), titleOf(source)))
    }
    if (o.targets.includes('xhs')) {
      const dir = join(outDir, 'xiaohongshu')
      await mkdir(dir, { recursive: true })
      const pngs = await engine.cards(md, s)
      for (let i = 0; i < pngs.length; i++) {
        const file = join(dir, `${String(i + 1).padStart(2, '0')}.png`)
        await writeFile(file, pngs[i])
        result.cards.push(file)
      }
    }
  }
  return result
}
