<div align="center">

# 墨排 Mopai

**写一次 Markdown，同时发公众号和小红书。**

一键复制到微信公众号，样式不丢；同一篇文章自动分页，导出小红书图文卡片。

纯前端 · 不用注册 · 内容不上传 · MIT 开源

[在线使用](https://woodti.github.io/mopai/) · [English](#english)

</div>

<p align="center"><img src="docs/demo.gif" alt="墨排演示：写 Markdown，切换主题，复制到公众号，生成小红书卡片" width="900"></p>

## 功能

**公众号排版**

- 所有样式写成内联样式，粘贴到公众号后台不丢格式
- 5 套主题：简约、胶囊、雅致、马克笔、极客，主色随意换
- 代码块语法高亮，可选 Mac 风格窗口和深色配色，换行和缩进粘贴后保留
- 外链自动转为文末脚注（公众号正文里的外链点不开）
- 支持表格、任务列表、引用、图片说明

**小红书卡片**

- 按卡片高度自动分页：长段落按句子拆开，长代码按行拆开，长列表和表格按项拆开，序号跨页连续
- 第一个一级标题自动生成封面，下一行的短句作为副标题
- 3:4、1:1、9:16 三种尺寸，导出 1080px 宽高清 PNG
- 米白纸、纯白、方格本、主色浅底、夜读 5 种背景
- 单独一行 `---` 手动分页
- 单张下载或批量导出 ZIP

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

构建产物在 `dist/`，可以部署到任意静态托管（GitHub Pages、Vercel、Netlify、Cloudflare Pages、EdgeOne）。仓库已经带了 GitHub Pages 的 Actions 配置，推送到 `main` 后会自动部署。启用方法：仓库的 Settings → Pages → Source 选 **GitHub Actions**。

## 代码结构

| 文件 | 作用 |
| --- | --- |
| `src/markdown.ts` | Markdown → 带内联样式的 HTML：清理、代码高亮、脚注、公众号兼容处理 |
| `src/themes.ts` | 主题样式表、代码配色 |
| `src/cards.ts` | 小红书卡片分页引擎：在隐藏容器里实测高度，按块和句子拆分 |
| `src/CardsView.tsx` | 卡片渲染与 PNG / ZIP 导出 |
| `src/App.tsx` | 编辑器、预览、设置面板 |

## 加一套主题

在 `src/themes.ts` 的 `THEMES` 里加一项，再在 `buildStyles` 的 `switch` 里覆盖需要改的元素样式（`h1`、`h2`、`blockquote`、`strong` 等）。欢迎 PR。

## 已知限制

- 小红书卡片里的网络图片需要图源允许跨域，否则导出时图片会缺失
- 本地图片还不能直接粘贴到编辑器（在计划中）

## 路线图

- [ ] 粘贴 / 拖入本地图片
- [ ] 更多卡片模板
- [ ] 自定义 CSS 主题
- [ ] 数学公式、Mermaid 图表
- [ ] 可选 AI：自己填 Key，长文自动提炼成卡片

---

## English

**Mopai** turns one Markdown article into two outputs:

- **WeChat Official Account**: rich text with every style inlined, so it survives pasting into the WeChat editor. Includes 5 themes, syntax-highlighted code blocks, and external links converted to footnotes.
- **Xiaohongshu (RedNote) carousel cards**: content auto-paginated by measured height (paragraphs split by sentence, code by line, lists by item). Exports 1080px PNG files one at a time or as a ZIP.

Everything runs in the browser. Nothing is uploaded.

```bash
npm install && npm run dev
```

## License

[MIT](LICENSE)
