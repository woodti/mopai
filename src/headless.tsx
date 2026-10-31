/**
 * 无头渲染入口：命令行和 MCP 用无界面浏览器打开 headless.html，
 * 调用 window.mopai 上的函数，和网页版共用同一套排版引擎。
 */
import { createRoot } from 'react-dom/client'
import { toPng } from 'html-to-image'
import { renderArticle } from './markdown'
import { CARD_BGS } from './cards'
import { CardsView } from './CardsView'
import { DEFAULTS, type Settings } from './settings'
import './styles.css'

function wechat(md: string, opts: Partial<Settings> = {}) {
  const s = { ...DEFAULTS, ...opts }
  return renderArticle(md, {
    theme: s.theme,
    primary: s.primary,
    fontSize: s.fontSize,
    serif: s.serif,
    macCode: s.macCode,
    codeDark: s.codeDark,
    linkFootnote: s.linkFootnote,
    dark: false,
    mode: 'wechat',
  }).outerHTML
}

async function waitImages(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll('img')).map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
  )
}

async function cards(md: string, opts: Partial<Settings> = {}): Promise<string[]> {
  const s = { ...DEFAULTS, ...opts }
  if (!CARD_BGS.some((b) => b.id === s.cardBg)) throw new Error(`未知的卡片背景：${s.cardBg}`)
  const host = document.getElementById('root')!
  host.replaceChildren()
  const mount = document.createElement('div')
  host.appendChild(mount)
  const root = createRoot(mount)
  try {
    await new Promise<number>((resolve) => {
      root.render(<CardsView md={md} s={s} imgVersion={0} onToast={() => undefined} onReady={resolve} />)
    })
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await waitImages(mount)
    const nodes = Array.from(mount.querySelectorAll<HTMLElement>('.card'))
    const out: string[] = []
    for (const node of nodes) out.push(await toPng(node, { pixelRatio: 2, skipFonts: true }))
    return out
  } finally {
    root.unmount()
    mount.remove()
  }
}

declare global {
  interface Window {
    mopai: { wechat: typeof wechat; cards: typeof cards; ready: boolean }
  }
}

window.mopai = { wechat, cards, ready: true }
