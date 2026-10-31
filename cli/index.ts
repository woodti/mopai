import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fetchRepo, promoMarkdown } from '../src/repo'
import { Engine } from './engine'
import { BG_IDS, COLOR_NAMES, RATIO_IDS, THEME_IDS, toSettings } from './options'
import { ROOT } from './paths'
import { TARGETS, defaultOutDir, render, titleOf, type RenderResult, type Target } from './render'

const HELP = `墨排 mopai：Markdown → 公众号排版 / 小红书卡片 / X 推文串

用法
  mopai <文章.md>              生成全部三种格式（- 表示从标准输入读取）
  mopai repo <owner/repo>      从 GitHub 仓库生成推广素材
  mopai mcp                    启动 MCP 服务器，给 Claude、Cursor 等 AI 工具用

选项
  -o, --out <目录>             输出目录，默认 ./mopai-out/<标题>
  --only <格式>                只生成部分格式：wechat,xhs,x（逗号分隔）
  --theme <主题>               ${THEME_IDS.join(' | ')}
  --color <颜色>               #RRGGBB 或 ${Object.keys(COLOR_NAMES).join(' | ')}
  --ratio <尺寸>               小红书卡片：${RATIO_IDS.join(' | ')}
  --bg <背景>                  小红书卡片：${BG_IDS.join(' | ')}
  --author <署名>              卡片和推文上显示的名字
  --font-size <px>             公众号正文字号，默认 15
  --card-font-size <px>        卡片正文字号，默认 18
  --serif                      使用衬线字体
  --dark-code                  深色代码块
  --no-brand                   卡片底部不显示「墨排」小字
  --premium                    X 推文不拆分（Premium 长推）
  --no-number                  X 推文串不加 1/n 编号
  --md                         repo 命令只输出推广 Markdown，不渲染
  -h, --help                   显示帮助
  -v, --version                显示版本

示例
  npx mopai post.md
  npx mopai post.md --only xhs --theme marker --color orange --bg grid
  npx mopai repo woodti/mopai
  npx mopai repo https://github.com/vitejs/vite --md > promo.md
`

async function version() {
  return JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8')).version as string
}

async function readStdin() {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function report(r: RenderResult) {
  const rel = (p: string) => (p.startsWith(process.cwd()) ? `.${p.slice(process.cwd().length)}` : p)
  for (const w of r.warnings) console.error(`⚠ ${w}`)
  console.log(`\n✓ 已生成到 ${rel(r.outDir)}`)
  if (r.markdown) console.log(`  推广文案   ${rel(r.markdown)}（可以修改后用 mopai 重新生成）`)
  if (r.wechat) console.log(`  公众号     ${rel(r.wechat)}（用浏览器打开，点「复制到公众号」）`)
  if (r.cards.length) console.log(`  小红书     ${rel(r.cards[0].replace(/[/\\][^/\\]+$/, ''))}/ 共 ${r.cards.length} 张`)
  if (r.thread) console.log(`  X 推文串   ${rel(r.thread)} 共 ${r.tweets.length} 条`)
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      only: { type: 'string' },
      theme: { type: 'string' },
      color: { type: 'string' },
      ratio: { type: 'string' },
      bg: { type: 'string' },
      author: { type: 'string' },
      'font-size': { type: 'string' },
      'card-font-size': { type: 'string' },
      serif: { type: 'boolean' },
      'dark-code': { type: 'boolean' },
      'no-brand': { type: 'boolean' },
      premium: { type: 'boolean' },
      'no-number': { type: 'boolean' },
      md: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  })

  if (values.version) return console.log(await version())
  const [command, arg] = positionals
  if (values.help || !command) return console.log(HELP)

  if (command === 'mcp') {
    const { startMcp } = await import('./mcp')
    return startMcp(await version())
  }

  const settings = toSettings({
    theme: values.theme,
    color: values.color,
    ratio: values.ratio,
    bg: values.bg,
    author: values.author,
    fontSize: values['font-size'] ? Number(values['font-size']) : undefined,
    cardFontSize: values['card-font-size'] ? Number(values['card-font-size']) : undefined,
    serif: values.serif,
    darkCode: values['dark-code'],
    brand: values['no-brand'] ? false : undefined,
    premium: values.premium,
    numbering: values['no-number'] ? false : undefined,
  })
  const targets = values.only ? (values.only.split(',').map((t) => t.trim()) as Target[]) : TARGETS
  const bad = targets.find((t) => !TARGETS.includes(t))
  if (bad) throw new Error(`--only 只能是 ${TARGETS.join(',')}（收到 ${bad}）`)

  let source: string
  let name: string
  let baseDir = process.cwd()
  let saveMarkdown = false

  if (command === 'repo') {
    if (!arg) throw new Error('请提供仓库，例如：mopai repo woodti/mopai')
    console.error(`读取 GitHub 仓库 ${arg} …`)
    const info = await fetchRepo(arg, process.env.GITHUB_TOKEN)
    source = promoMarkdown(info)
    if (values.md) return process.stdout.write(source)
    name = info.name
    saveMarkdown = true
  } else {
    const file = command
    source = file === '-' ? await readStdin() : await readFile(file, 'utf8')
    if (file !== '-') baseDir = dirname(resolve(file))
    name = titleOf(source) || (file === '-' ? 'mopai' : basename(file, extname(file)))
  }

  let engine: Engine | undefined
  try {
    const result = await render(source, {
      targets,
      outDir: values.out || defaultOutDir(name),
      settings,
      baseDir,
      saveMarkdown,
      engine: async () => {
        if (!engine) {
          console.error('启动渲染引擎 …')
          engine = await Engine.start()
        }
        return engine
      },
    })
    report(result)
  } finally {
    await engine?.close()
  }
}

main().catch((e: Error) => {
  console.error(`✗ ${e.message}`)
  process.exit(1)
})
