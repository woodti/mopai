---
name: mopai
description: 把 Markdown 文章或 GitHub 仓库变成能直接发布的社交媒体内容：微信公众号排版（复制即可粘贴）、小红书图文卡片（PNG）、X / Twitter 推文串。用户想排版公众号文章、做小红书卡片或图文、把文章拆成推文串，或者推广开源项目、GitHub 仓库时使用。Use for WeChat Official Account formatting, Xiaohongshu (RedNote) carousel cards, X threads, or promoting a GitHub repository.
---

# 墨排 mopai

墨排把一篇 Markdown 渲染成三种可直接发布的格式。你负责**写好每个平台的文案**，墨排负责排版和出图。

## 调用方式

- 如果 MCP 工具 `mopai` 可用（`render_xiaohongshu_cards`、`render_wechat_article`、`render_x_thread`、`get_github_repo`），优先用它们。
- 否则用命令行：`npx -y mopai-cli`。需要 Node.js 18+；生成卡片和公众号排版需要本机有 Chrome 或 Edge。

```bash
npx -y mopai-cli post.md                       # 三种格式全部生成
npx -y mopai-cli post.md --only xhs            # 只要小红书卡片（wechat / xhs / x，逗号分隔）
npx -y mopai-cli repo owner/repo --md > draft.md   # 读取仓库，输出推广草稿
```

输出在 `./mopai-out/<标题>/`，也可以用 `-o <目录>` 指定。

## 流程

### 用户给了一篇文章

1. 文章不是文件的话，先写成 `<slug>.md`。
2. 判断目标平台。**同一篇长文不要直接做成小红书卡片**：长文会被拆成十几张密密麻麻的卡。先按下面的写作指南改写一版 `<slug>-xhs.md`，再渲染。公众号可以直接用原文。
3. 渲染，然后检查（见「交付前检查」）。

### 推广一个 GitHub 仓库

1. 运行 `npx -y mopai-cli repo owner/repo --md > draft.md`（或调用 `get_github_repo`）拿到仓库信息和草稿。草稿只是从 README 机械摘取的，**必须改写**，不能直接发。
2. 需要更多细节时，读 README 原文：`gh api repos/owner/repo/readme -H "Accept: application/vnd.github.raw"`，或者用 MCP 工具返回的 README。
3. 按平台各写一份：`promo-xhs.md`、`promo-wechat.md`、`promo-x.md`。三个平台的读者和节奏不同，不要共用一份。
4. 分别渲染：`npx -y mopai-cli promo-xhs.md --only xhs`，其他平台同理。
5. 交付前检查，然后把文件位置告诉用户。

## 写作指南

### 小红书卡片

- **6～9 张为宜**。一张卡讲一个要点，用单独一行 `---` 分页。
- **封面**：`# 标题` 不超过 16 个字，要有钩子，比如数字、痛点、反差或结果（如「3 分钟搞定公众号排版」）。标题下一行写一句不超过 20 字的副标题，它会显示在封面上。
- **内页**：每页一个 `## 小标题`，正文 3～5 行。口语化，少用术语；可以用少量 emoji 做视觉锚点，但不要每行都加。
- 重点用 `**加粗**`，渲染时会用主色突出。
- **最后一页**：写清楚怎么获取或怎么用（链接、搜索名），再加一句引导收藏或关注。
- 小红书笔记还需要一段正文（1000 字以内）和话题标签，这部分不进卡片。在回复里单独写给用户，让他发布时直接粘贴。

### 公众号

- 完整文章结构：开头引入（为什么值得看）→ 用 `## ` 分几节 → 结尾总结或行动号召。
- 代码块要标语言（` ```ts `），会自动高亮。
- 外链会自动转成文末脚注，正文里正常写链接就行。

### X 推文串

- **第一条是钩子**，单独看也要成立，让人想点开。
- 每条一个观点，用 `---` 强制分条。没有 `---` 时按 280 的加权长度自动拆，中文字符算 2。
- 链接放在最后一条：X 会降低带外链推文的推荐量。
- 面向英文读者时用英文写。`**粗体**` 会转成 Unicode 粗体字，只对英文和数字有效。
- 用户是 X Premium 会员、想发一整条长推时，加 `--premium`。

## 参数

| 参数 | 可选值 | 说明 |
| --- | --- | --- |
| `--theme` | `simple` `pill` `elegant` `marker` `geek` | 排版主题 |
| `--color` | `#RRGGBB` 或 `blue` `green` `orange` `red` `purple` `cyan` `gold` `black` | 主色 |
| `--ratio` | `3:4` `1:1` `9:16` | 卡片尺寸，小红书用 `3:4` |
| `--bg` | `paper` `white` `grid` `tint` `night` | 卡片背景 |
| `--author` | 文字 | 卡片署名，例如 `@用户名` |
| `--serif` / `--dark-code` | | 衬线字体 / 深色代码块 |
| `--premium` / `--no-number` | | X 长推 / 不加 1/n 编号 |
| `--no-brand` | | 卡片底部不显示「墨排」小字 |

风格建议：技术内容用 `geek` 加 `--dark-code`；干货或清单用 `marker` 或 `pill`，配 `paper` 或 `grid` 背景；想要高级感或夜读氛围用 `--bg night`。用户没指定时就用默认值，不要反复追问。

## 交付前检查

1. 用读图工具打开封面 `xiaohongshu/01.png`，再抽查一两张内页。看三点：标题是否过长换成了三行以上、内页是否太空（只有一两行）或太挤、有没有图片缺失。
2. 有问题就改 Markdown 重新渲染，比如合并太空的页，或拆开太挤的页。
3. 告诉用户：
   - **公众号**：用浏览器打开 `wechat.html`，点「复制到公众号」，再到公众号后台粘贴。
   - **小红书**：按 `01.png`、`02.png`… 的顺序上传，附上你写好的正文和话题标签。
   - **X**：`x-thread.txt` 里每条推文之间用分隔线隔开，按顺序发布，第一条之后的每条都回复上一条。

## 常见问题

- **「找不到可用的浏览器」**：运行 `npx playwright install chromium`，或者用环境变量 `MOPAI_CHROME` 指定 Chrome 路径。
- **GitHub 接口限流**（每小时 60 次）：设置 `GITHUB_TOKEN`。装了 gh 的话，可以 `export GITHUB_TOKEN=$(gh auth token)`。
- **图片**：Markdown 里的本地路径和网络图片会自动嵌入卡片，本地路径相对于 Markdown 文件所在的目录。粘贴到公众号时，嵌入的图片可能不会显示，需要提醒用户在后台重新插入。
