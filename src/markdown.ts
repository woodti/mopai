import { Marked } from 'marked'
import hljs from 'highlight.js/lib/common'
import { resolveSrc } from './images'
import { HEADING_PREFIX, buildStyles, codePalette, type StyleMap, type StyleOptions } from './themes'

export type RenderOptions = StyleOptions & {
  /** 外链转为文末脚注（公众号正文不允许外链） */
  linkFootnote: boolean
}

const marked = new Marked({ gfm: true, breaks: true })
marked.use({
  renderer: {
    code({ text, lang }) {
      const language = (lang || '').trim().split(/\s+/)[0].toLowerCase()
      return `<pre data-lang="${escapeHtml(language)}"><code>${highlight(text, language)}</code></pre>\n`
    },
  },
})

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function highlight(code: string, lang: string) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    } catch {
      // 退回纯文本
    }
  }
  return escapeHtml(code)
}

const BLOCKED = 'script, style, iframe, object, embed, link, meta, form, input:not([type="checkbox"]), textarea, button, select'

/** 去掉脚本和事件属性。导入的 .md 文件可能来自别人，内嵌 HTML 不可信。 */
function sanitize(root: ParentNode) {
  root.querySelectorAll(BLOCKED).forEach((el) => el.remove())
  root.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on') || name === 'class' || name === 'id') el.removeAttribute(attr.name)
      else if ((name === 'href' || name === 'src') && /^(javascript|vbscript|data:text)/.test(value)) el.removeAttribute(attr.name)
    }
  })
}

function span(doc: Document, style: string, text: string) {
  const el = doc.createElement('span')
  el.setAttribute('style', style)
  el.textContent = text
  return el
}

function keyOf(el: Element) {
  const tag = el.tagName.toLowerCase()
  const parent = el.parentElement?.tagName.toLowerCase()
  if (tag === 'code' && parent === 'pre') return 'pre code'
  if (tag === 'p' && parent === 'blockquote') return 'blockquote p'
  return tag
}

/** 把主题样式写进 style 属性。已有的内联样式写在后面，优先级更高。 */
export function applyStyles(root: Element, styles: StyleMap, codeDark: boolean) {
  const colors = codePalette(codeDark).colors
  const all = [root, ...Array.from(root.querySelectorAll('*'))]
  for (const el of all) {
    const own = el.getAttribute('style') || ''
    const hl = el.getAttribute('data-hl')
    if (hl) {
      const color = colors[hl] || colors[hl.split('.')[0]]
      const extra = hl === 'comment' || hl === 'quote' ? '; font-style: italic' : ''
      if (color) el.setAttribute('style', `color: ${color}${extra}`)
      continue
    }
    const theme = styles[keyOf(el)]
    if (theme && !el.hasAttribute('data-styled')) {
      el.setAttribute('style', own ? `${theme}; ${own}` : theme)
      el.setAttribute('data-styled', '')
    }
  }
}

/** highlight.js 输出的是 class，转成 data-hl 以便内联上色（class 会被清掉）。 */
function markHighlight(root: ParentNode) {
  root.querySelectorAll('span[class^="hljs-"]').forEach((el) => {
    const cls = el.getAttribute('class')!.split(/\s+/)[0].replace(/^hljs-/, '')
    el.setAttribute('data-hl', cls)
    el.removeAttribute('class')
  })
}

function macDots(doc: Document) {
  const wrap = doc.createElement('span')
  wrap.setAttribute('data-dots', '')
  for (const color of ['#ff5f56', '#ffbd2e', '#27c93f']) {
    const dot = doc.createElement('span')
    dot.setAttribute('style', `display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; background: ${color}`)
    wrap.appendChild(dot)
  }
  return wrap
}

/** 公众号粘贴时会吞掉代码里的换行和连续空格，换成 <br> 和 &nbsp; */
function hardenCode(code: Element) {
  const doc = code.ownerDocument
  const walker = doc.createTreeWalker(code, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  while (walker.nextNode()) texts.push(walker.currentNode as Text)
  for (const node of texts) {
    const parts = node.data.replace(/\t/g, '    ').split('\n')
    const frag = doc.createDocumentFragment()
    parts.forEach((part, i) => {
      if (i > 0) frag.appendChild(doc.createElement('br'))
      if (part) frag.appendChild(doc.createTextNode(part.replace(/ /g, ' ')))
    })
    node.replaceWith(frag)
  }
}

function isWechatLink(href: string) {
  return /^https?:\/\/mp\.weixin\.qq\.com\//.test(href)
}

/**
 * Markdown → 带内联样式的 <section>。
 * 返回的元素属于一个惰性文档（图片不会加载、脚本不会执行），调用方按需插入页面。
 */
export function renderArticle(md: string, o: RenderOptions): HTMLElement {
  const styles = buildStyles(o)
  const tpl = document.createElement('template')
  tpl.innerHTML = marked.parse(md, { async: false }) as string
  const frag = tpl.content
  const doc = frag.ownerDocument

  // 先把高亮 class 转成 data-hl，再清理（清理会删除所有 class）
  markHighlight(frag)
  sanitize(frag)

  // 任务列表：公众号会删掉 input
  frag.querySelectorAll('li > input[type="checkbox"]').forEach((input) => {
    const box = span(doc, styles.check, input.hasAttribute('checked') ? '☑' : '☐')
    input.replaceWith(box)
    const li = box.parentElement!
    li.setAttribute('style', 'list-style-type: none; margin-left: -1.3em')
  })

  // 有序列表写死序号，卡片分页拆开后编号仍然连续
  frag.querySelectorAll('ol').forEach((ol) => {
    let n = Number(ol.getAttribute('start') || 1)
    Array.from(ol.children).forEach((li) => li.setAttribute('value', String(n++)))
  })

  const prefixes = HEADING_PREFIX[o.theme] || {}
  for (const [tag, text] of Object.entries(prefixes)) {
    frag.querySelectorAll(tag).forEach((h) => h.prepend(span(doc, styles.prefix, text)))
  }

  // 本地图片 img://id → blob URL；找不到时留个占位提示
  frag.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || ''
    const resolved = resolveSrc(src)
    if (resolved) img.setAttribute('src', resolved)
    else img.replaceWith(span(doc, styles.caption, '［图片已丢失，请重新插入］'))
  })

  // 图片说明文字
  frag.querySelectorAll('img').forEach((img) => {
    const alt = (img.getAttribute('title') || img.getAttribute('alt') || '').trim()
    if (!alt || /^(image|图片|img)$/i.test(alt)) return
    const anchor = img.parentElement?.tagName === 'A' ? img.parentElement : img
    anchor.after(span(doc, styles.caption, alt))
  })

  if (o.linkFootnote) {
    const notes: { text: string; href: string }[] = []
    frag.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href')!
      if (isWechatLink(href) || href.startsWith('#')) return
      const text = a.textContent || ''
      const replacement = doc.createElement('span')
      replacement.setAttribute('style', styles.a)
      replacement.append(...Array.from(a.childNodes))
      a.replaceWith(replacement)
      if (text.trim() === href.trim()) return
      let index = notes.findIndex((n) => n.href === href)
      if (index < 0) index = notes.push({ text, href }) - 1
      replacement.after(span(doc, styles.sup, `[${index + 1}]`))
    })
    if (notes.length) {
      const title = doc.createElement('p')
      title.setAttribute('style', styles.fnTitle)
      title.textContent = '参考链接'
      frag.appendChild(title)
      notes.forEach((n, i) => {
        const item = doc.createElement('p')
        item.setAttribute('style', styles.fnItem)
        item.textContent = `[${i + 1}] ${n.text}: ${n.href}`
        frag.appendChild(item)
      })
    }
  }

  frag.querySelectorAll('pre').forEach((pre) => {
    if (o.macCode) pre.prepend(macDots(doc))
  })

  const root = doc.createElement('section')
  root.setAttribute('style', styles.base)
  root.appendChild(frag)
  applyStyles(root, styles, o.codeDark)
  root.querySelectorAll('[data-dots]').forEach((el) => el.setAttribute('style', styles.dots))

  if (o.mode === 'wechat') {
    root.querySelectorAll('pre code').forEach(hardenCode)
    root.querySelectorAll('table').forEach((table) => {
      const wrap = doc.createElement('section')
      wrap.setAttribute('style', styles.tableWrap)
      table.replaceWith(wrap)
      wrap.appendChild(table)
      table.setAttribute('style', `${styles.table}; margin: 0`)
    })
  }
  root.querySelectorAll('[data-styled]').forEach((el) => el.removeAttribute('data-styled'))
  return root
}

/** 卡片分页后重新高亮被拆开的代码片段 */
export function rehighlight(code: Element, lang: string, o: StyleOptions) {
  code.innerHTML = highlight((code.textContent || '').replace(/\n$/, ''), lang)
  markHighlight(code)
  applyStyles(code, {}, o.codeDark)
}

export function titleOf(md: string) {
  const m = md.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : ''
}
