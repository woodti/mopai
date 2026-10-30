export type ThemeId = 'simple' | 'pill' | 'elegant' | 'marker' | 'geek'

export const THEMES: { id: ThemeId; name: string; desc: string }[] = [
  { id: 'simple', name: '简约', desc: '下划线标题，干净耐读' },
  { id: 'pill', name: '胶囊', desc: '色块标题，层次分明' },
  { id: 'elegant', name: '雅致', desc: '居中标题，文艺留白' },
  { id: 'marker', name: '马克笔', desc: '荧光笔划重点' },
  { id: 'geek', name: '极客', desc: '等宽标题，技术文风' },
]

export const COLORS = ['#2563eb', '#0f9d76', '#f97316', '#e11d48', '#7c3aed', '#0891b2', '#ca8a04', '#18181b']

export type StyleOptions = {
  theme: ThemeId
  primary: string
  fontSize: number
  serif: boolean
  codeDark: boolean
  macCode: boolean
  /** 深色背景（小红书夜读卡片） */
  dark: boolean
  mode: 'wechat' | 'card'
}

export type StyleMap = Record<string, string>

export const MONO = `Menlo, Monaco, Consolas, 'SF Mono', 'Courier New', monospace`
const SANS = `-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`
const SERIF = `'Songti SC', 'Noto Serif SC', 'Source Han Serif SC', STSong, SimSun, serif`

export function alpha(hex: string, a: number) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** highlight.js 的 class → 颜色。公众号会去掉 class，所以要内联成 color。 */
const CODE_LIGHT = {
  bg: '#f6f8fa',
  text: '#24292e',
  colors: {
    keyword: '#d73a49', 'selector-tag': '#d73a49', 'meta-keyword': '#d73a49', doctag: '#d73a49',
    string: '#032f62', regexp: '#032f62', 'selector-attr': '#032f62', 'selector-pseudo': '#032f62',
    comment: '#6a737d', quote: '#6a737d', meta: '#6a737d',
    number: '#005cc5', literal: '#005cc5', attr: '#005cc5', attribute: '#005cc5', variable: '#005cc5', 'template-variable': '#005cc5',
    title: '#6f42c1', 'title.function_': '#6f42c1', 'title.class_': '#6f42c1', section: '#6f42c1',
    built_in: '#e36209', type: '#e36209', params: '#24292e', symbol: '#e36209', 'selector-class': '#6f42c1', 'selector-id': '#6f42c1',
    tag: '#22863a', name: '#22863a', bullet: '#735c0f', addition: '#22863a', deletion: '#b31d28',
  } as Record<string, string>,
}

const CODE_DARK = {
  bg: '#282c34',
  text: '#abb2bf',
  colors: {
    keyword: '#c678dd', 'selector-tag': '#e06c75', 'meta-keyword': '#c678dd', doctag: '#c678dd',
    string: '#98c379', regexp: '#98c379', 'selector-attr': '#d19a66', 'selector-pseudo': '#d19a66',
    comment: '#7f848e', quote: '#7f848e', meta: '#61afef',
    number: '#d19a66', literal: '#56b6c2', attr: '#d19a66', attribute: '#d19a66', variable: '#e06c75', 'template-variable': '#e06c75',
    title: '#61afef', 'title.function_': '#61afef', 'title.class_': '#e6c07b', section: '#e06c75',
    built_in: '#e6c07b', type: '#e6c07b', params: '#abb2bf', symbol: '#56b6c2', 'selector-class': '#e6c07b', 'selector-id': '#61afef',
    tag: '#e06c75', name: '#e06c75', bullet: '#61afef', addition: '#98c379', deletion: '#e06c75',
  } as Record<string, string>,
}

export function codePalette(dark: boolean) {
  return dark ? CODE_DARK : CODE_LIGHT
}

/** 标题前缀符号，由渲染器作为 span 插入（公众号不支持伪元素） */
export const HEADING_PREFIX: Partial<Record<ThemeId, Record<string, string>>> = {
  pill: { h3: '◆' },
  geek: { h2: '##', h3: '###' },
}

export function buildStyles(o: StyleOptions): StyleMap {
  const p = o.primary
  const text = o.dark ? '#ececec' : '#2b2b2b'
  const muted = o.dark ? '#a1a1aa' : '#6b6b6b'
  const line = o.dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)'
  const soft = alpha(p, o.dark ? 0.2 : 0.08)
  const code = codePalette(o.codeDark)
  const font = o.serif ? SERIF : SANS
  const card = o.mode === 'card'

  const s: StyleMap = {
    base: `font-family: ${font}; font-size: ${o.fontSize}px; line-height: 1.8; color: ${text}; letter-spacing: 0.5px; word-break: break-word; text-align: left`,
    h1: `font-size: 1.6em; font-weight: bold; line-height: 1.4; margin: 1.2em 0 1em; text-align: center; color: ${text}`,
    h2: `font-size: 1.3em; font-weight: bold; line-height: 1.5; margin: 2em 0 1em; padding-bottom: 6px; border-bottom: 2px solid ${p}; color: ${text}`,
    h3: `font-size: 1.15em; font-weight: bold; line-height: 1.5; margin: 1.6em 0 0.8em; padding-left: 10px; border-left: 4px solid ${p}; color: ${text}`,
    h4: `font-size: 1.05em; font-weight: bold; line-height: 1.5; margin: 1.4em 0 0.6em; color: ${p}`,
    h5: `font-size: 1em; font-weight: bold; margin: 1.2em 0 0.6em; color: ${text}`,
    h6: `font-size: 1em; font-weight: bold; margin: 1.2em 0 0.6em; color: ${muted}`,
    p: `margin: 1em 0; line-height: 1.8; color: ${text}`,
    blockquote: `margin: 1.4em 0; padding: 12px 16px; border-left: 4px solid ${p}; background: ${soft}; border-radius: 0 6px 6px 0; color: ${muted}`,
    'blockquote p': `margin: 0.3em 0; color: ${muted}`,
    ul: `margin: 1em 0; padding-left: 1.6em; list-style-type: disc; color: ${text}`,
    ol: `margin: 1em 0; padding-left: 1.6em; list-style-type: decimal; color: ${text}`,
    li: `margin: 0.4em 0; line-height: 1.8; color: ${text}`,
    strong: `font-weight: bold; color: ${p}`,
    em: `font-style: italic`,
    del: `text-decoration: line-through; color: ${muted}`,
    a: `color: ${p}; text-decoration: none; border-bottom: 1px solid ${alpha(p, 0.4)}`,
    code: `font-family: ${MONO}; font-size: 0.88em; padding: 2px 5px; margin: 0 2px; border-radius: 4px; background: ${soft}; color: ${p}`,
    pre: `margin: 1.4em 0; padding: 14px 16px; border-radius: 8px; background: ${code.bg}; overflow-x: auto; font-size: 0.85em; line-height: 1.65; text-align: left`,
    'pre code': `display: block; font-family: ${MONO}; font-size: inherit; color: ${code.text}; background: none; padding: 0; margin: 0; white-space: ${card ? 'pre-wrap' : 'pre'}; word-break: ${card ? 'break-all' : 'normal'}`,
    dots: `display: block; margin-bottom: 10px; line-height: 0`,
    hr: `margin: 2em 0; border: 0; border-top: 1px solid ${line}; height: 0`,
    img: `display: block; max-width: 100%; height: auto; margin: 1.2em auto; border-radius: 8px`,
    caption: `display: block; text-align: center; font-size: 0.85em; color: ${muted}; margin: -0.6em 0 1.2em`,
    table: `width: 100%; border-collapse: collapse; margin: 1.4em 0; font-size: 0.92em`,
    tableWrap: `overflow-x: auto; margin: 1.4em 0`,
    th: `padding: 8px 10px; border: 1px solid ${line}; background: ${soft}; font-weight: bold; text-align: left; color: ${text}`,
    td: `padding: 8px 10px; border: 1px solid ${line}; color: ${text}`,
    prefix: `color: ${p}; margin-right: 8px`,
    check: `color: ${p}; margin-right: 6px`,
    sup: `color: ${p}; font-size: 0.75em; margin-left: 2px`,
    fnTitle: `margin: 2.4em 0 0.8em; padding-top: 12px; border-top: 1px solid ${line}; font-size: 0.9em; font-weight: bold; color: ${muted}`,
    fnItem: `margin: 0.3em 0; font-size: 0.8em; line-height: 1.6; color: ${muted}; word-break: break-all`,
  }

  switch (o.theme) {
    case 'pill':
      s.h1 = `font-size: 1.6em; font-weight: bold; line-height: 1.4; margin: 1.2em 0 1em; text-align: center; color: ${p}`
      s.h2 = `display: table; margin: 2em auto 1.2em; padding: 6px 18px; font-size: 1.2em; font-weight: bold; line-height: 1.5; color: #fff; background: ${p}; border-radius: 8px`
      s.h3 = `font-size: 1.12em; font-weight: bold; line-height: 1.5; margin: 1.6em 0 0.8em; color: ${p}`
      s.blockquote = `margin: 1.4em 0; padding: 14px 18px; border-radius: 10px; background: ${soft}; color: ${muted}`
      break
    case 'elegant':
      s.h1 = `font-size: 1.55em; font-weight: normal; letter-spacing: 3px; line-height: 1.5; margin: 1.2em 0 1.2em; text-align: center; color: ${text}`
      s.h2 = `display: table; margin: 2.4em auto 1.2em; padding: 0 6px 8px; font-size: 1.22em; font-weight: bold; letter-spacing: 2px; line-height: 1.5; text-align: center; border-bottom: 1px solid ${p}; color: ${text}`
      s.h3 = `font-size: 1.1em; font-weight: bold; letter-spacing: 1px; line-height: 1.5; margin: 1.8em 0 0.8em; text-align: center; color: ${p}`
      s.blockquote = `margin: 1.6em 0; padding: 14px 8px; border-top: 1px solid ${line}; border-bottom: 1px solid ${line}; text-align: center; font-style: italic; color: ${muted}`
      s.strong = `font-weight: bold; color: ${text}; border-bottom: 1px solid ${p}`
      s.hr = `margin: 2.4em auto; border: 0; border-top: 1px solid ${p}; width: 30%; height: 0`
      break
    case 'marker':
      s.h2 = `display: table; margin: 2em 0 1em; padding: 0 4px; font-size: 1.3em; font-weight: bold; line-height: 1.5; color: ${text}; background: linear-gradient(transparent 55%, ${alpha(p, 0.35)} 55%)`
      s.strong = `font-weight: bold; color: ${text}; background: linear-gradient(transparent 60%, ${alpha(p, 0.3)} 60%)`
      s.blockquote = `margin: 1.4em 0; padding: 12px 16px; border-left: 4px solid ${alpha(p, 0.6)}; background: ${alpha(p, o.dark ? 0.16 : 0.06)}; color: ${muted}`
      break
    case 'geek':
      s.h1 = `font-size: 1.5em; font-weight: bold; line-height: 1.4; margin: 1.2em 0 1em; font-family: ${MONO}; color: ${text}`
      s.h2 = `font-size: 1.22em; font-weight: bold; line-height: 1.5; margin: 2em 0 1em; font-family: ${MONO}; color: ${text}`
      s.h3 = `font-size: 1.08em; font-weight: bold; line-height: 1.5; margin: 1.6em 0 0.8em; font-family: ${MONO}; color: ${text}`
      s.blockquote = `margin: 1.4em 0; padding: 10px 16px; border: 1px dashed ${alpha(p, 0.6)}; border-radius: 6px; color: ${muted}`
      s.strong = `font-weight: bold; color: ${p}`
      s.hr = `margin: 2em 0; border: 0; border-top: 1px dashed ${line}; height: 0`
      break
  }

  if (card) {
    // 卡片空间有限：收紧段距和标题间距（后写的声明覆盖前面）
    s.base += '; line-height: 1.7'
    s.p += '; margin: 0.6em 0'
    s.h2 += '; margin-top: 1.1em; margin-bottom: 0.7em'
    s.h3 += '; margin-top: 1em; margin-bottom: 0.6em'
    s.li += '; margin: 0.25em 0'
    s.pre += '; margin: 0.9em 0'
    s.blockquote += '; margin: 0.9em 0'
  }
  return s
}
