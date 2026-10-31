import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright-core'
import type { Settings } from '../src/settings'
import { ROOT } from './paths'

const DIST = join(ROOT, 'dist')
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

/** 把打包好的网页版跑在本地端口上，无头浏览器从这里加载排版引擎 */
function serve(): Promise<{ server: Server; url: string }> {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent((req.url || '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '')
    try {
      const body = await readFile(join(DIST, path === '/' ? 'index.html' : path))
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      resolve({ server, url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}` })
    })
  })
}

async function launch(): Promise<Browser> {
  const attempts = [
    process.env.MOPAI_CHROME ? { executablePath: process.env.MOPAI_CHROME } : null,
    { channel: 'chrome' },
    { channel: 'msedge' },
    {}, // 用 npx playwright install chromium 装的浏览器
  ]
  for (const options of attempts) {
    if (!options) continue
    try {
      return await chromium.launch({ ...options, headless: true })
    } catch {
      // 换下一个
    }
  }
  throw new Error(
    '找不到可用的浏览器。生成小红书卡片和公众号排版需要 Chrome：\n' +
      '  · 安装 Google Chrome 或 Microsoft Edge，或\n' +
      '  · 运行 npx playwright install chromium，或\n' +
      '  · 用环境变量 MOPAI_CHROME 指定浏览器路径',
  )
}

/** headless.html 挂在 window 上的接口，见 src/headless.tsx */
type Api = {
  mopai?: {
    ready: boolean
    wechat(md: string, opts: Partial<Settings>): string
    cards(md: string, opts: Partial<Settings>): Promise<string[]>
  }
}

export class Engine {
  private constructor(
    private browser: Browser,
    private page: Page,
    private server: Server,
  ) {}

  static async start() {
    const [{ server, url }, browser] = await Promise.all([serve(), launch()])
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    await page.goto(`${url}/headless.html`)
    await page.waitForFunction(() => (window as unknown as Api).mopai?.ready)
    return new Engine(browser, page, server)
  }

  wechat(md: string, opts: Partial<Settings>) {
    return this.page.evaluate(([md, opts]) => (window as unknown as Api).mopai!.wechat(md, opts), [md, opts] as const)
  }

  async cards(md: string, opts: Partial<Settings>) {
    const urls = await this.page.evaluate(([md, opts]) => (window as unknown as Api).mopai!.cards(md, opts), [md, opts] as const)
    return urls.map((u) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'))
  }

  async close() {
    await this.browser.close().catch(() => undefined)
    this.server.close()
  }
}
