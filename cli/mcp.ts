import { readFile } from 'node:fs/promises'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { fetchRepo, promoMarkdown } from '../src/repo'
import { Engine } from './engine'
import { BG_IDS, COLOR_NAMES, RATIO_IDS, THEME_IDS, toSettings, type StyleArgs } from './options'
import { TARGETS, defaultOutDir, render, titleOf, type RenderResult, type Target } from './render'

const MARKDOWN_TIPS =
  'Markdown tips: the first "# H1" becomes the cover card, and a short line right after it becomes the cover subtitle. ' +
  'Put "---" on its own line to force a new card or tweet. Images can be URLs or local paths (resolved against base_dir).'

const style = {
  theme: z.enum(THEME_IDS).optional().describe('Layout theme: simple, pill, elegant, marker, or geek'),
  color: z.string().optional().describe(`Accent color, as #RRGGBB or one of ${Object.keys(COLOR_NAMES).join(', ')}`),
  author: z.string().optional().describe('Signature shown on cards, for example @yourname'),
}
const cardStyle = {
  ratio: z.enum(RATIO_IDS).optional().describe('Card aspect ratio. Defaults to 3:4, the usual Xiaohongshu format'),
  background: z.enum(BG_IDS).optional().describe('Card background: paper, white, grid, tint, or night (dark)'),
}
const output = {
  out_dir: z.string().optional().describe('Output directory. Defaults to ./mopai-out/<title>'),
  base_dir: z.string().optional().describe('Directory used to resolve relative image paths in the markdown'),
}

type Args = StyleArgs & { background?: string; out_dir?: string; base_dir?: string; premium?: boolean; numbering?: boolean }

function settingsOf(a: Args) {
  return toSettings({ ...a, bg: a.background })
}

function summary(r: RenderResult) {
  const lines = [`Output directory: ${r.outDir}`]
  if (r.markdown) lines.push(`Source markdown: ${r.markdown}`)
  if (r.wechat) lines.push(`WeChat article: ${r.wechat} (open it in a browser and click 复制到公众号, then paste into the WeChat editor)`)
  if (r.cards.length) lines.push(`Xiaohongshu cards (${r.cards.length}):`, ...r.cards.map((c) => `  ${c}`))
  if (r.thread) lines.push(`X thread (${r.tweets.length} tweets): ${r.thread}`)
  if (r.warnings.length) lines.push('Warnings:', ...r.warnings.map((w) => `  ${w}`))
  return lines.join('\n')
}

async function coverPreview(r: RenderResult) {
  if (!r.cards.length) return []
  return [{ type: 'image' as const, data: (await readFile(r.cards[0])).toString('base64'), mimeType: 'image/png' }]
}

export async function startMcp(version: string) {
  let engine: Promise<Engine> | undefined
  // 同一个页面上的渲染不能并发，排队执行
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }
  const getEngine = () => (engine ??= Engine.start().catch((e) => {
    engine = undefined
    throw e
  }))

  const run = (md: string, targets: Target[], a: Args, saveMarkdown = false) =>
    serial(() =>
      render(md, {
        targets,
        outDir: a.out_dir || defaultOutDir(titleOf(md) || 'mopai'),
        settings: settingsOf(a),
        baseDir: a.base_dir || process.cwd(),
        engine: getEngine,
        saveMarkdown,
      }),
    )

  const server = new McpServer({ name: 'mopai', version })

  server.registerTool(
    'get_github_repo',
    {
      title: 'Read a GitHub repository',
      description:
        'Fetch a public GitHub repository: its metadata (stars, language, license, topics), the README, and an auto-generated promo draft in markdown. ' +
        'Use this before writing promotional posts for an open-source project. Rewrite the draft in your own words for the target audience, then pass it to the render tools. ' +
        MARKDOWN_TIPS,
      inputSchema: { repo: z.string().describe('owner/repo or a github.com URL') },
    },
    async ({ repo }) => {
      const info = await fetchRepo(repo, process.env.GITHUB_TOKEN)
      const { readme, ...meta } = info
      const text = [
        '## Metadata',
        JSON.stringify(meta, null, 2),
        '## Promo draft (markdown, ready to render)',
        promoMarkdown(info),
        '## README',
        readme.length > 20000 ? `${readme.slice(0, 20000)}\n\n…(truncated)` : readme,
      ].join('\n\n')
      return { content: [{ type: 'text', text }] }
    },
  )

  server.registerTool(
    'render_xiaohongshu_cards',
    {
      title: 'Render Xiaohongshu cards',
      description:
        'Turn markdown into a carousel of Xiaohongshu (RedNote) image cards. Content is paginated automatically by measured height, and the cards are exported as 1080px-wide PNG files. ' +
        'Returns the file paths plus a preview of the cover card. ' +
        MARKDOWN_TIPS,
      inputSchema: { markdown: z.string(), ...style, ...cardStyle, ...output },
    },
    async (a) => {
      const r = await run(a.markdown, ['xhs'], a)
      return { content: [{ type: 'text', text: summary(r) }, ...(await coverPreview(r))] }
    },
  )

  server.registerTool(
    'render_wechat_article',
    {
      title: 'Format a WeChat article',
      description:
        'Format markdown for a WeChat Official Account (公众号) article. Every style is inlined so it survives pasting into the WeChat editor, code is syntax-highlighted, and external links become footnotes. ' +
        'Writes an HTML file with a copy button. Tell the user to open it and click the button.',
      inputSchema: {
        markdown: z.string(),
        ...style,
        font_size: z.number().int().min(12).max(20).optional().describe('Body font size in px. Defaults to 15'),
        ...output,
      },
    },
    async (a) => {
      const r = await run(a.markdown, ['wechat'], { ...a, fontSize: a.font_size })
      return { content: [{ type: 'text', text: summary(r) }] }
    },
  )

  server.registerTool(
    'render_x_thread',
    {
      title: 'Split into an X thread',
      description:
        "Split markdown into an X (Twitter) thread using X's weighted character count (CJK characters and emoji count as 2, URLs as 23, 280 per tweet). " +
        'Bold and italic text become Unicode bold characters, and tweets are numbered 1/n. Returns every tweet, ready to post.',
      inputSchema: {
        markdown: z.string(),
        premium: z.boolean().optional().describe('X Premium long post: produce a single post instead of a thread'),
        numbering: z.boolean().optional().describe('Append 1/n to each tweet. Defaults to true'),
        author: style.author,
        out_dir: output.out_dir,
      },
    },
    async (a) => {
      const r = await run(a.markdown, ['x'], a)
      const tweets = r.tweets.map((t, i) => `### Tweet ${i + 1}\n${t}`).join('\n\n')
      return { content: [{ type: 'text', text: `${summary(r)}\n\n${tweets}` }] }
    },
  )

  server.registerTool(
    'promote_github_repo',
    {
      title: 'Generate promo materials for a GitHub repository',
      description:
        'One step from a GitHub repository to promotional materials: Xiaohongshu cards, a WeChat article, and an X thread, all built from the README. ' +
        'For better copy, call get_github_repo first, rewrite the draft, and then use the render_* tools instead.',
      inputSchema: {
        repo: z.string().describe('owner/repo or a github.com URL'),
        targets: z.array(z.enum(['wechat', 'xhs', 'x'])).optional().describe('Which outputs to generate. Defaults to all three'),
        ...style,
        ...cardStyle,
        out_dir: output.out_dir,
      },
    },
    async (a) => {
      const info = await fetchRepo(a.repo, process.env.GITHUB_TOKEN)
      const md = promoMarkdown(info)
      const r = await run(md, a.targets?.length ? a.targets : TARGETS, { ...a, out_dir: a.out_dir || defaultOutDir(info.name) }, true)
      const tweets = r.tweets.length ? `\n\nFirst tweet:\n${r.tweets[0]}` : ''
      return { content: [{ type: 'text', text: summary(r) + tweets }, ...(await coverPreview(r))] }
    },
  )

  const shutdown = async () => {
    if (engine) await (await engine.catch(() => undefined))?.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.stdin.on('close', shutdown)

  await server.connect(new StdioServerTransport())
  console.error(`mopai MCP server ${version} 已启动`)
}
