import { Lexer, type Token, type Tokens } from 'marked'

export type ThreadOptions = {
  /** 单条上限（加权字数）：免费用户 280，Premium 长推 25000 */
  limit: number
  numbering: boolean
  unicodeBold: boolean
  threadEmoji: boolean
}

export const URL_WEIGHT = 23
const URL_RE = /https?:\/\/[^\s)）\]】]+/g

/**
 * X 的加权计数（twitter-text 规则）：拉丁字母和常用标点算 1，
 * 中日韩文字和 emoji 算 2，链接一律算 23。
 */
export function weightedLength(text: string) {
  let total = 0
  const plain = text.replace(URL_RE, () => {
    total += URL_WEIGHT
    return ''
  })
  for (const ch of plain) {
    const c = ch.codePointAt(0)!
    const light = c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037)
    total += light ? 1 : 2
  }
  return total
}

/** Unicode 数学字母：X 不支持富文本，这是推文里显示粗体 / 斜体的通行做法。只对英文和数字有效。 */
function mathStyle(text: string, style: 'bold' | 'italic') {
  const upper = style === 'bold' ? 0x1d5d4 : 0x1d608
  const lower = style === 'bold' ? 0x1d5ee : 0x1d622
  return text.replace(/[A-Za-z0-9]/g, (ch) => {
    const c = ch.charCodeAt(0)
    if (c >= 65 && c <= 90) return String.fromCodePoint(upper + c - 65)
    if (c >= 97 && c <= 122) return String.fromCodePoint(lower + c - 97)
    return style === 'bold' ? String.fromCodePoint(0x1d7ec + c - 48) : ch
  })
}

function decode(s: string) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
}

function inline(tokens: Token[] | undefined, o: ThreadOptions): string {
  if (!tokens) return ''
  return tokens
    .map((t) => {
      switch (t.type) {
        case 'strong':
          return o.unicodeBold ? mathStyle(inline(t.tokens, o), 'bold') : inline(t.tokens, o)
        case 'em':
          return o.unicodeBold ? mathStyle(inline(t.tokens, o), 'italic') : inline(t.tokens, o)
        case 'del':
          return inline(t.tokens, o)
        case 'codespan':
          return decode(t.text)
        case 'br':
          return '\n'
        case 'link': {
          const text = inline(t.tokens, o).trim()
          return !text || text === t.href ? t.href : `${text} ${t.href}`
        }
        case 'image':
          return `［配图${t.text ? `：${t.text}` : ''}］`
        case 'html':
          return ''
        case 'text':
          return 'tokens' in t && t.tokens ? inline(t.tokens, o) : decode(t.text)
        default:
          return 'text' in t ? decode(String(t.text)) : ''
      }
    })
    .join('')
}

type Block = { text: string; heading?: boolean; breakBefore?: boolean }

function blocks(tokens: Token[], o: ThreadOptions): Block[] {
  const out: Block[] = []
  let pendingBreak = false
  const push = (b: Block) => {
    if (!b.text.trim()) return
    out.push({ ...b, breakBefore: pendingBreak })
    pendingBreak = false
  }
  for (const t of tokens) {
    switch (t.type) {
      case 'heading': {
        const text = inline(t.tokens, o).trim()
        push({ text: t.depth === 1 ? (o.unicodeBold ? mathStyle(text, 'bold') : text) : `▍${o.unicodeBold ? mathStyle(text, 'bold') : text}`, heading: true })
        break
      }
      case 'paragraph':
        push({ text: inline(t.tokens, o).trim() })
        break
      case 'list': {
        const list = t as Tokens.List
        const start = typeof list.start === 'number' ? list.start : 1
        const lines = list.items.map((item, i) => {
          const mark = item.task ? (item.checked ? '☑' : '☐') : list.ordered ? `${start + i}.` : '•'
          const body = item.tokens
            .map((sub) => (sub.type === 'list' ? '' : inline('tokens' in sub ? sub.tokens : undefined, o) || ('text' in sub ? decode(String(sub.text)) : '')))
            .join(' ')
            .trim()
          return `${mark} ${body}`
        })
        push({ text: lines.join('\n') })
        break
      }
      case 'blockquote':
        push({ text: `“${blocks((t as Tokens.Blockquote).tokens, o).map((b) => b.text).join('\n')}”` })
        break
      case 'code':
        push({ text: t.text })
        break
      case 'table': {
        const table = t as Tokens.Table
        const row = (cells: Tokens.TableCell[]) => cells.map((c) => inline(c.tokens, o).trim()).join(' | ')
        push({ text: [row(table.header), ...table.rows.map(row)].join('\n') })
        break
      }
      case 'hr':
        pendingBreak = true
        break
    }
  }
  return out
}

/** 按加权长度切开超长文本：先按行，再按句子，最后硬切 */
function splitLong(text: string, budget: number): string[] {
  if (weightedLength(text) <= budget) return [text]
  const lines = text.split('\n')
  if (lines.length > 1) return lines.flatMap((l) => splitLong(l, budget)).reduce(packer(budget, '\n'), [])
  const sentences = text.match(/[^。！？!?；;]+[。！？!?；;”"’）)]*\s*|[。！？!?；;]+/g) || [text]
  if (sentences.length > 1) return sentences.flatMap((s) => splitLong(s, budget)).reduce(packer(budget, ''), [])
  // 单句仍然超长：按字符硬切
  const out: string[] = []
  let cur = ''
  for (const ch of text) {
    if (weightedLength(cur + ch) > budget) {
      out.push(cur)
      cur = ''
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

function packer(budget: number, joiner: string) {
  return (acc: string[], piece: string) => {
    const last = acc[acc.length - 1]
    if (last !== undefined && weightedLength(last + joiner + piece) <= budget) acc[acc.length - 1] = last + joiner + piece
    else acc.push(piece)
    return acc
  }
}

export function toThread(md: string, o: ThreadOptions): string[] {
  const list = blocks(Lexer.lex(md, { gfm: true, breaks: true }), o)
  const split = o.limit < 1000
  // 给编号「 12/12」和首条「 🧵」留位置
  const reserve = split ? (o.numbering ? 7 : 0) + (o.threadEmoji ? 3 : 0) : 0
  const budget = o.limit - reserve

  const tweets: string[] = []
  let cur = ''
  const flush = () => {
    if (cur.trim()) tweets.push(cur.trim())
    cur = ''
  }

  for (let i = 0; i < list.length; i++) {
    const block = list[i]
    if (block.breakBefore) flush()
    let text = block.text
    // 标题和下一段绑在一起，避免标题孤零零挂在上一条末尾
    if (block.heading && list[i + 1] && !list[i + 1].breakBefore) {
      const joined = `${text}\n${list[i + 1].text}`
      const room = budget - weightedLength(text) - 1
      if (weightedLength(joined) <= budget || !split) {
        text = joined
        i++
      } else if (room > 60) {
        // 下一段太长：取开头一截跟标题放一起，剩下的留给后面
        const head = splitLong(list[i + 1].text, room)[0]
        text = `${text}\n${head}`
        list[i + 1] = { text: list[i + 1].text.slice(head.length).trimStart() }
      } else {
        flush()
      }
    }
    const next = cur ? `${cur}\n\n${text}` : text
    if (!split || weightedLength(next) <= budget) {
      cur = next
      continue
    }
    flush()
    const pieces = splitLong(text, budget)
    pieces.slice(0, -1).forEach((p) => tweets.push(p))
    cur = pieces[pieces.length - 1] ?? ''
  }
  flush()

  if (!split) return tweets.length ? [tweets.join('\n\n')] : []
  const n = tweets.length
  return tweets.map((t, i) => {
    let out = t
    if (i === 0 && o.threadEmoji && n > 1) out += ' 🧵'
    if (o.numbering && n > 1) out += `\n${i + 1}/${n}`
    return out
  })
}
