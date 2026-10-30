import { rehighlight } from './markdown'
import type { StyleOptions } from './themes'

export type Ratio = '3:4' | '1:1' | '9:16'

export const RATIOS: { id: Ratio; name: string; height: number }[] = [
  { id: '3:4', name: '3:4 竖图', height: 720 },
  { id: '1:1', name: '1:1 方图', height: 540 },
  { id: '9:16', name: '9:16 长图', height: 960 },
]

export type CardBg = 'paper' | 'white' | 'grid' | 'tint' | 'night'

export const CARD_BGS: { id: CardBg; name: string; dark: boolean }[] = [
  { id: 'paper', name: '米白纸', dark: false },
  { id: 'white', name: '纯白', dark: false },
  { id: 'grid', name: '方格本', dark: false },
  { id: 'tint', name: '主色浅底', dark: false },
  { id: 'night', name: '夜读', dark: true },
]

/** 卡片按 540px 宽排版，导出时 2 倍像素即 1080px 宽 */
export const CARD_W = 540
export const PAD_X = 40
export const PAD_TOP = 52
export const PAD_BOTTOM = 76

export type CardPage =
  | { kind: 'cover'; title: string; subtitle: string }
  | { kind: 'body'; html: string }

type Shell = { outer: HTMLElement; inner: HTMLElement }
type Splitter = { units: Node[]; shell: () => Shell; lang?: string }

/** 段落按句子拆，超长的句子再按长度切，保证拆分粒度足够细 */
function tokenize(el: Element): Node[] {
  const units: Node[] = []
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) {
      units.push(node)
      continue
    }
    const pieces = (node as Text).data.match(/[^。！？!?；;，,、]+[。！？!?；;，,、”"’）)]*|[。！？!?；;，,、]+/g) || []
    for (const piece of pieces) {
      for (let i = 0; i < piece.length; i += 40) units.push(document.createTextNode(piece.slice(i, i + 40)))
    }
  }
  return units
}

function splitter(block: HTMLElement): Splitter | null {
  const tag = block.tagName
  const flat = (): Shell => {
    const outer = block.cloneNode(false) as HTMLElement
    return { outer, inner: outer }
  }
  if (tag === 'P') return { units: tokenize(block), shell: flat }
  if (tag === 'UL' || tag === 'OL') return { units: Array.from(block.children), shell: flat }
  if (tag === 'BLOCKQUOTE') {
    const kids = Array.from(block.children) as HTMLElement[]
    if (kids.length !== 1 || kids[0].tagName !== 'P') return { units: kids, shell: flat }
    const p = kids[0]
    return {
      units: tokenize(p),
      shell: () => {
        const outer = block.cloneNode(false) as HTMLElement
        const inner = p.cloneNode(false) as HTMLElement
        outer.appendChild(inner)
        return { outer, inner }
      },
    }
  }
  if (tag === 'PRE') {
    const code = block.querySelector('code')
    if (!code) return null
    const dots = block.querySelector('[data-dots]')
    const lines = (code.textContent || '').split('\n')
    return {
      lang: block.getAttribute('data-lang') || '',
      units: lines.map((line, i) => document.createTextNode(i < lines.length - 1 ? `${line}\n` : line)),
      shell: () => {
        const outer = block.cloneNode(false) as HTMLElement
        if (dots) outer.appendChild(dots.cloneNode(true))
        const inner = code.cloneNode(false) as HTMLElement
        outer.appendChild(inner)
        return { outer, inner }
      },
    }
  }
  if (tag === 'TABLE') {
    const head = block.querySelector('thead')
    const body = block.querySelector('tbody')
    if (!body) return null
    return {
      units: Array.from(body.children),
      shell: () => {
        const outer = block.cloneNode(false) as HTMLElement
        if (head) outer.appendChild(head.cloneNode(true))
        const inner = body.cloneNode(false) as HTMLElement
        outer.appendChild(inner)
        return { outer, inner }
      },
    }
  }
  return null
}

const isHeading = (el: Element | null) => !!el && /^H[1-6]$/.test(el.tagName)

/** 等图片加载完拿到真实尺寸，否则测量高度为 0 */
async function sizeImages(root: HTMLElement, maxH: number) {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          const probe = new Image()
          const done = () => {
            if (probe.naturalWidth) {
              img.setAttribute('width', String(probe.naturalWidth))
              img.setAttribute('height', String(probe.naturalHeight))
            }
            resolve()
          }
          probe.onload = done
          probe.onerror = done
          setTimeout(done, 4000)
          probe.src = img.getAttribute('src') || ''
        }),
    ),
  )
  for (const img of imgs) {
    img.style.maxHeight = `${Math.round(maxH * 0.85)}px`
    img.style.width = 'auto'
    img.style.objectFit = 'contain'
  }
}

export async function paginate(
  article: HTMLElement,
  o: { height: number; cover: boolean; style: StyleOptions },
): Promise<CardPage[]> {
  const width = CARD_W - PAD_X * 2
  const maxH = o.height - PAD_TOP - PAD_BOTTOM
  const pages: CardPage[] = []

  const blocks = Array.from(article.children) as HTMLElement[]
  if (o.cover && blocks[0]?.tagName === 'H1') {
    const title = blocks.shift()!.textContent?.trim() || ''
    let subtitle = ''
    const next = blocks[0]
    if (next?.tagName === 'P' && (next.textContent || '').trim().length <= 60) {
      subtitle = next.textContent!.trim()
      blocks.shift()
    }
    pages.push({ kind: 'cover', title, subtitle })
  }

  const host = document.createElement('div')
  host.style.cssText = 'position: fixed; left: -10000px; top: 0; visibility: hidden; pointer-events: none'
  document.body.appendChild(host)

  const newPage = () => {
    const el = article.cloneNode(false) as HTMLElement
    el.className = 'card-body'
    el.style.width = `${width}px`
    host.replaceChildren(el)
    return el
  }

  let page = newPage()
  const fits = () => page.offsetHeight <= maxH + 0.5
  const codePieces: { code: HTMLElement; lang: string }[] = []

  const flush = (carryHeading: boolean) => {
    let carry: Element | null = null
    if (carryHeading && page.children.length > 1 && isHeading(page.lastElementChild)) carry = page.lastElementChild
    carry?.remove()
    for (const { code, lang } of codePieces) {
      if (page.contains(code)) rehighlight(code, lang, o.style)
    }
    if (page.children.length) pages.push({ kind: 'body', html: page.outerHTML })
    page = newPage()
    if (carry) page.appendChild(carry)
  }

  try {
    const holder = document.createElement('div')
    holder.append(...blocks)
    host.appendChild(holder)
    await sizeImages(holder, maxH)
    holder.remove()
    page = newPage()

    for (const block of blocks) {
      if (block.tagName === 'HR') {
        flush(false)
        continue
      }
      page.appendChild(block)
      if (fits()) continue
      block.remove()

      const split = splitter(block)
      if (!split || split.units.length < 2) {
        // 整块放不下：换页；单独一页仍放不下就接受溢出
        if (page.children.length) flush(true)
        page.appendChild(block)
        continue
      }

      let piece = split.shell()
      const start = () => {
        piece = split.shell()
        page.appendChild(piece.outer)
        if (split.lang !== undefined) codePieces.push({ code: piece.inner, lang: split.lang })
      }
      start()
      for (const unit of split.units) {
        piece.inner.appendChild(unit)
        if (fits()) continue
        piece.inner.removeChild(unit)
        const pieceEmpty = !piece.inner.childNodes.length
        if (pieceEmpty) piece.outer.remove()
        // 当前页一个片段都放不下时，把孤立的标题一起带到下一页
        if (!pieceEmpty || page.children.length) flush(pieceEmpty)
        start()
        piece.inner.appendChild(unit)
      }
    }
    flush(false)
  } finally {
    host.remove()
  }
  return pages
}
