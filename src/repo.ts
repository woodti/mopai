/**
 * GitHub 仓库 → 推广用 Markdown。浏览器和 Node（命令行 / MCP）共用，只依赖 fetch。
 */

export type RepoInfo = {
  owner: string
  name: string
  fullName: string
  url: string
  description: string
  homepage: string
  stars: number
  forks: number
  language: string
  license: string
  topics: string[]
  branch: string
  readme: string
}

export function parseRepo(input: string): { owner: string; name: string } | null {
  const s = input.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i) || s.match(/^([\w.-]+)\/([\w.-]+)$/)
  return m ? { owner: m[1], name: m[2] } : null
}

export async function fetchRepo(input: string, token?: string): Promise<RepoInfo> {
  const parsed = parseRepo(input)
  if (!parsed) throw new Error(`无法识别的仓库：${input}（支持 owner/repo 或 GitHub 链接）`)
  const base = `https://api.github.com/repos/${parsed.owner}/${parsed.name}`
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const metaRes = await fetch(base, { headers })
  if (metaRes.status === 404) throw new Error(`仓库不存在或不是公开仓库：${parsed.owner}/${parsed.name}`)
  if (metaRes.status === 403 || metaRes.status === 429) throw new Error('GitHub 接口请求太频繁（未登录每小时 60 次），请稍后再试，或设置 GITHUB_TOKEN')
  if (!metaRes.ok) throw new Error(`读取仓库失败：HTTP ${metaRes.status}`)
  const meta = await metaRes.json()

  const readmeRes = await fetch(`${base}/readme`, { headers: { ...headers, Accept: 'application/vnd.github.raw' } })
  const readme = readmeRes.ok ? await readmeRes.text() : ''

  return {
    owner: meta.owner.login,
    name: meta.name,
    fullName: meta.full_name,
    url: meta.html_url,
    description: meta.description || '',
    homepage: meta.homepage || '',
    stars: meta.stargazers_count,
    forks: meta.forks_count,
    language: meta.language || '',
    license: meta.license?.spdx_id && meta.license.spdx_id !== 'NOASSERTION' ? meta.license.spdx_id : '',
    topics: meta.topics || [],
    branch: meta.default_branch || 'HEAD',
    readme,
  }
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n)
}

type Section = { title: string; body: string }

/** 去掉徽章、HTML 块、目录等推广用不上的东西，相对路径图片改成绝对地址 */
function cleanReadme(md: string, info: RepoInfo) {
  const raw = `https://raw.githubusercontent.com/${info.owner}/${info.name}/${info.branch}/`
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(img)\b[^>]*src="([^"]+)"[^>]*>/gi, (_, _tag, src) => `\n![](${src})\n`)
    .replace(/<\/?(p|div|a|br|picture|source|h\d|sup|sub|details|summary|b|strong|em|span|table|tr|td|th|tbody|thead)\b[^>]*>/gi, '')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '') // 带链接的徽章
    .replace(/!\[[^\]]*\]\((https?:\/\/(img\.shields\.io|badgen\.net|badge\.fury\.io|github\.com\/[^)]+\/(workflows|actions)\/)[^)]*)\)/g, '') // 裸徽章
    .replace(/!\[([^\]]*)\]\((?!https?:|data:)\.?\/?([^)\s]+)\)/g, (_, alt, path) => `![${alt}](${raw}${path})`)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function splitSections(md: string): { intro: string; sections: Section[] } {
  const parts = md.split(/^##\s+/m)
  const intro = parts[0].replace(/^#\s+.*$/m, '').trim()
  const sections = parts.slice(1).map((p) => {
    const nl = p.indexOf('\n')
    return { title: (nl < 0 ? p : p.slice(0, nl)).trim(), body: nl < 0 ? '' : p.slice(nl + 1).trim() }
  })
  return { intro, sections }
}

const PICKS: { re: RegExp; emoji: string }[] = [
  { re: /feature|highlight|功能|特性|特色|亮点|why|优势|what|介绍|about|overview|概述/i, emoji: '✨' },
  { re: /quick\s*start|getting\s*started|install|快速|开始|安装|上手|部署/i, emoji: '🚀' },
  { re: /usage|use|example|demo|使用|用法|示例|演示/i, emoji: '🛠' },
]
const SKIP = /建议|suggest|反馈|feedback|issue|问题|bug|licen[cs]e|协议|contribut|贡献|sponsor|赞助|star\s*history|致谢|thank|acknowledg|changelog|更新日志|faq|toc|目录|contents|author|作者|联系|contact|community|社区|roadmap|路线/i

const isList = (line: string) => /^\s*([-*+]|\d+\.)\s/.test(line)
const isLabel = (block: string) => !block.includes('\n') && block.trim().length <= 30 && /^(\*\*.+\*\*|__.+__)[:：]?$/.test(block.trim())

/** 去掉末尾以冒号结尾的半句（后面的内容已被截掉） */
function dropDangling(text: string) {
  return text.replace(/[^\n.。!?！？]*[:：]\s*$/, '').trim()
}

/**
 * 截短一个章节：按块处理，列表最多 5 项（不含子项），代码最多 10 行，
 * 整节约 500 字。跳过图片、表格、引用和 HTML。
 */
function trimSection(body: string, budget = 500) {
  const blocks: string[] = []
  const lines = body.split('\n')
  for (let i = 0; i < lines.length; ) {
    const line = lines[i]
    if (/^\s*(```|~~~)/.test(line)) {
      const fence = line.trim().slice(0, 3)
      const code = [line]
      i++
      while (i < lines.length && !lines[i].trim().startsWith(fence)) code.push(lines[i++])
      i++
      blocks.push(code.length > 11 ? [...code.slice(0, 11), '# …', fence].join('\n') : [...code, fence].join('\n'))
      continue
    }
    if (!line.trim() || /^#{3,}\s/.test(line)) {
      i++
      continue
    }
    const group = [line]
    i++
    if (isList(line)) {
      while (i < lines.length && (isList(lines[i]) || /^\s{2,}\S/.test(lines[i]))) group.push(lines[i++])
      blocks.push(group.filter((l) => !/^\s{2,}/.test(l)).slice(0, 5).join('\n'))
      continue
    }
    while (i < lines.length && lines[i].trim() && !isList(lines[i]) && !/^\s*(```|~~~|#)/.test(lines[i])) group.push(lines[i++])
    blocks.push(group.join('\n'))
  }

  const out: string[] = []
  let used = 0
  for (const block of blocks) {
    const t = block.trim()
    if (/^(!\[|\||>|<)/.test(t)) continue
    // 只有链接的导航行（[在线使用](…) · [English](#…)）
    if (!t.replace(/!?\[[^\]]*\]\([^)]*\)/g, '').replace(/[\s·|•/、,，-]/g, '')) continue
    if (used > 0 && used + t.length > budget) break
    out.push(t)
    used += t.length
  }
  while (out.length && isLabel(out[out.length - 1])) out.pop()
  if (out.length) out[out.length - 1] = dropDangling(out[out.length - 1]) || out[out.length - 1]
  return out.filter(Boolean).join('\n\n')
}

function shortDescription(desc: string) {
  if (desc.length <= 60) return desc
  const first = desc.split(/[：:。.!！?？]/)[0].trim()
  return first.length >= 6 && first.length <= 60 ? first : `${desc.slice(0, 56)}…`
}

function firstImage(md: string) {
  return md.match(/!\[[^\]]*\]\((https?:[^)\s]+)\)/)?.[1] || ''
}

/** 生成推广 Markdown：封面 → 简介 → 功能 → 快速开始 → 项目地址，用 --- 分页 */
export function promoMarkdown(info: RepoInfo): string {
  const cleaned = cleanReadme(info.readme, info)
  const { intro, sections } = splitSections(cleaned)
  const lines: string[] = []

  // 封面副标题要短（≤ 60 字），完整描述放到下一页
  const desc = info.description.trim()
  const short = shortDescription(desc)
  lines.push(`# ${info.name}`, '')
  if (short) lines.push(short, '')

  const facts = [`⭐ ${formatCount(info.stars)} Star`, info.language, info.license && `${info.license} 开源`].filter(Boolean)
  const introText = trimSection(intro, 400)
  const shot = firstImage(cleaned)
  lines.push('## 📌 这是什么', '')
  if (desc && desc !== short) lines.push(desc, '')
  lines.push(facts.join(' · '), '')
  if (introText) lines.push(introText, '')
  if (shot) lines.push(`![](${shot})`, '')

  const used = new Set<Section>()
  for (const pick of PICKS) {
    const section = sections.find((sec) => !used.has(sec) && !SKIP.test(sec.title) && pick.re.test(sec.title) && sec.body.trim())
    if (!section) continue
    used.add(section)
    const body = trimSection(section.body)
    if (!body) continue
    const title = section.title.replace(/^[^\p{L}\p{N}]+/u, '').trim()
    lines.push('---', '', `## ${pick.emoji} ${title}`, '', body, '')
  }

  lines.push('---', '', '## 🔗 项目地址', '', info.url, '')
  if (info.homepage && info.homepage !== info.url) lines.push(`在线体验：${info.homepage}`, '')
  if (info.topics.length) lines.push(info.topics.slice(0, 5).map((t) => `#${t}`).join(' '), '')
  lines.push('觉得有用的话，欢迎点个 Star ⭐', '')

  return lines.join('\n')
}
