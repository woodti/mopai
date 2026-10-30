import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BookOpen, Copy, FileUp, Github, ImagePlus, Images, MessageSquareText, RotateCcw } from 'lucide-react'
import { renderArticle } from './markdown'
import { CARD_BGS, RATIOS, type CardBg, type Ratio } from './cards'
import { COLORS, THEMES, type ThemeId } from './themes'
import { SAMPLE } from './sample'
import { LOCAL_PREFIX, inlineBlobImages, loadImages, localIds, saveImage } from './images'
import { CardsView } from './CardsView'
import { XView } from './XView'

export type Settings = {
  theme: ThemeId
  primary: string
  fontSize: number
  serif: boolean
  macCode: boolean
  codeDark: boolean
  linkFootnote: boolean
  ratio: Ratio
  cardBg: CardBg
  cardFontSize: number
  cover: boolean
  author: string
  pageNum: boolean
  xLimit: number
  xNumber: boolean
  xBold: boolean
  xEmoji: boolean
}

type Mode = 'wechat' | 'cards' | 'x'

const DEFAULTS: Settings = {
  theme: 'simple',
  primary: COLORS[0],
  fontSize: 15,
  serif: false,
  macCode: true,
  codeDark: false,
  linkFootnote: true,
  ratio: '3:4',
  cardBg: 'paper',
  cardFontSize: 18,
  cover: true,
  author: '',
  pageNum: true,
  xLimit: 280,
  xNumber: true,
  xBold: true,
  xEmoji: true,
}

const REPO = 'https://github.com/woodti/mopai'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 隐私模式等情况下无法保存，忽略
  }
}

function loadMarkdown() {
  try {
    return localStorage.getItem('mopai:md') ?? SAMPLE
  } catch {
    return SAMPLE
  }
}

/** 中文按字、英文按词计数 */
function countWords(md: string) {
  const cjk = md.match(/[一-鿿]/g)?.length ?? 0
  const latin = md.replace(/[一-鿿]/g, ' ').match(/[A-Za-z0-9]+/g)?.length ?? 0
  return cjk + latin
}

async function copyRich(el: HTMLElement) {
  const html = el.innerHTML
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([el.innerText], { type: 'text/plain' }),
        }),
      ])
      return true
    } catch {
      // 回退到选区复制
    }
  }
  const selection = window.getSelection()
  if (!selection) return false
  const range = document.createRange()
  range.selectNodeContents(el)
  selection.removeAllRanges()
  selection.addRange(range)
  const ok = document.execCommand('copy')
  selection.removeAllRanges()
  return ok
}

export default function App() {
  const [md, setMd] = useState(loadMarkdown)
  const [s, setS] = useState<Settings>(() => load('mopai:settings', DEFAULTS))
  const [mode, setMode] = useState<Mode>('wechat')
  const [toast, setToast] = useState('')
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const [imgVersion, setImgVersion] = useState(0)

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setS((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    const t = setTimeout(() => save('mopai:md', md), 300)
    return () => clearTimeout(t)
  }, [md])
  useEffect(() => save('mopai:settings', JSON.stringify(s)), [s])
  useEffect(() => {
    let cancelled = false
    loadImages(localIds(md)).then((changed) => {
      if (changed && !cancelled) setImgVersion((v) => v + 1)
    })
    return () => {
      cancelled = true
    }
  }, [md])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const wechatHtml = useMemo(
    () =>
      mode === 'wechat'
        ? renderArticle(md, {
            theme: s.theme,
            primary: s.primary,
            fontSize: s.fontSize,
            serif: s.serif,
            macCode: s.macCode,
            codeDark: s.codeDark,
            linkFootnote: s.linkFootnote,
            dark: false,
            mode: 'wechat',
          }).outerHTML
        : '',
    [md, s, mode, imgVersion],
  )

  const words = useMemo(() => countWords(md), [md])

  const copy = async () => {
    const article = articleRef.current
    if (!article) return
    // 本地图片是 blob URL，粘贴到别处就失效了，复制前转成 data URL
    const holder = document.createElement('div')
    holder.style.cssText = 'position: fixed; left: -10000px; top: 0'
    holder.innerHTML = article.innerHTML
    document.body.appendChild(holder)
    try {
      const local = await inlineBlobImages(holder)
      const ok = await copyRich(holder)
      if (!ok) setToast('复制失败，请手动全选预览区复制')
      else if (local) setToast('已复制。如果本地图片没有显示，请在公众号后台重新插入')
      else setToast('已复制，去公众号后台直接粘贴')
    } finally {
      holder.remove()
    }
  }

  /** 在光标处插入文本 */
  const insertText = (text: string) => {
    const el = editorRef.current
    const a = el ? el.selectionStart : md.length
    const b = el ? el.selectionEnd : md.length
    setMd((prev) => prev.slice(0, a) + text + prev.slice(b))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(a + text.length, a + text.length)
    })
  }

  const insertImages = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length) return false
    setToast('正在处理图片…')
    const ids = await Promise.all(images.map(saveImage))
    await loadImages(ids)
    insertText(ids.map((id) => `\n![](${LOCAL_PREFIX}${id})\n`).join(''))
    setToast(`已插入 ${ids.length} 张图片`)
    return true
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    if (!/\.(md|markdown|txt)$/i.test(file.name) && !file.type.startsWith('text/')) {
      setToast('请选择 .md 或 .txt 文件')
      return
    }
    setMd(await file.text())
    setToast(`已导入 ${file.name}`)
  }

  const syncScroll = () => {
    const ed = editorRef.current
    const pv = previewRef.current
    if (!ed || !pv || mode !== 'wechat') return
    const ratio = ed.scrollTop / Math.max(1, ed.scrollHeight - ed.clientHeight)
    pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const el = e.currentTarget
    const { selectionStart: a, selectionEnd: b } = el
    const next = md.slice(0, a) + '  ' + md.slice(b)
    setMd(next)
    requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">墨</span>
          <strong>墨排</strong>
          <span className="tagline">Markdown 一键排版公众号 · 小红书卡片 · X 推文</span>
        </div>
        <div className="mode-tabs" role="tablist">
          <button className={mode === 'wechat' ? 'active' : ''} onClick={() => setMode('wechat')}>
            <MessageSquareText size={16} /> 公众号
          </button>
          <button className={mode === 'cards' ? 'active' : ''} onClick={() => setMode('cards')}>
            <Images size={16} /> 小红书卡片
          </button>
          <button className={mode === 'x' ? 'active' : ''} onClick={() => setMode('x')}>
            <span className="x-logo">𝕏</span> X 推文
          </button>
        </div>
        <div className="actions">
          <a className="btn ghost icon-only" href={REPO} target="_blank" rel="noreferrer" title="GitHub">
            <Github size={18} />
          </a>
          {mode === 'wechat' && (
            <button className="btn primary" onClick={copy}>
              <Copy size={16} /> 复制到公众号
            </button>
          )}
        </div>
      </header>

      <main className="workspace">
        <section
          className="pane editor-pane"
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault()
            const files = Array.from(e.dataTransfer.files)
            if (!(await insertImages(files))) importFile(files[0])
          }}
        >
          <div className="pane-head">
            <span>
              Markdown <em>{words} 字</em>
            </span>
            <div className="pane-tools">
              <button className="btn ghost small" onClick={() => imageRef.current?.click()} title="插入本地图片，也可以直接粘贴或拖进来">
                <ImagePlus size={14} /> 图片
              </button>
              <button className="btn ghost small" onClick={() => fileRef.current?.click()} title="导入 .md 文件，也可以直接拖进来">
                <FileUp size={14} /> 导入
              </button>
              <button
                className="btn ghost small"
                onClick={() => {
                  if (md === SAMPLE || confirm('用示例文章替换当前内容？')) setMd(SAMPLE)
                }}
              >
                <RotateCcw size={14} /> 示例
              </button>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  insertImages(Array.from(e.target.files || []))
                  e.target.value = ''
                }}
              />
              <input
                ref={fileRef}
                type="file"
                accept=".md,.markdown,.txt,text/*"
                hidden
                onChange={(e) => {
                  importFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
          </div>
          <textarea
            ref={editorRef}
            className="editor"
            value={md}
            spellCheck={false}
            onChange={(e) => setMd(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files)
              if (files.some((f) => f.type.startsWith('image/'))) {
                e.preventDefault()
                insertImages(files)
              }
            }}
            placeholder="在这里写 Markdown，可以拖入 .md 文件，也可以直接粘贴图片"
          />
        </section>

        <section className="pane preview-pane" ref={previewRef}>
          {mode === 'wechat' ? (
            <div className="phone">
              <div className="phone-article" ref={articleRef} dangerouslySetInnerHTML={{ __html: wechatHtml }} />
            </div>
          ) : mode === 'cards' ? (
            <CardsView md={md} s={s} imgVersion={imgVersion} onToast={setToast} />
          ) : (
            <XView md={md} s={s} onToast={setToast} />
          )}
        </section>

        <aside className="pane settings">
          {mode === 'x' ? (
            <>
              <Group title="单条上限">
                <Seg
                  value={s.xLimit}
                  options={[
                    { value: 280, label: '280 字（拆成推文串）' },
                    { value: 25000, label: 'Premium 长推' },
                  ]}
                  onChange={(v) => set('xLimit', v)}
                />
              </Group>
              <Group title="显示名">
                <input className="text-input" value={s.author} maxLength={24} placeholder="例如 @your_handle" onChange={(e) => set('author', e.target.value)} />
              </Group>
              <Group title="选项">
                <Toggle label="粗体 / 斜体转 Unicode" hint="X 不支持富文本，用数学字母模拟粗体，只对英文和数字有效" checked={s.xBold} onChange={(v) => set('xBold', v)} />
                {s.xLimit < 1000 && (
                  <>
                    <Toggle label="末尾编号 1/n" checked={s.xNumber} onChange={(v) => set('xNumber', v)} />
                    <Toggle label="首条加 🧵" checked={s.xEmoji} onChange={(v) => set('xEmoji', v)} />
                  </>
                )}
              </Group>
              <p className="hint">
                <BookOpen size={14} />
                按 X 规则计数：中文和 emoji 算 2，链接固定算 23。单独一行 --- 强制分条。图片会标成「配图」，发布时手动添加，也可以用小红书卡片当配图。
              </p>
            </>
          ) : (
            <>
              <Group title="主题">
                <div className="theme-grid">
                  {THEMES.map((t) => (
                    <button key={t.id} className={`theme-btn ${s.theme === t.id ? 'active' : ''}`} onClick={() => set('theme', t.id)}>
                      <b>{t.name}</b>
                      <span>{t.desc}</span>
                    </button>
                  ))}
                </div>
              </Group>

              <Group title="主色">
                <div className="swatches">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      className={`swatch ${s.primary === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => set('primary', c)}
                      aria-label={c}
                    />
                  ))}
                  <label className="swatch custom" title="自定义颜色">
                    <input type="color" value={s.primary} onChange={(e) => set('primary', e.target.value)} />
                  </label>
                </div>
              </Group>

              {mode === 'wechat' ? (
                <Group title="正文字号">
                  <Seg value={s.fontSize} options={[14, 15, 16, 17].map((v) => ({ value: v, label: `${v}px` }))} onChange={(v) => set('fontSize', v)} />
                </Group>
              ) : (
                <>
                  <Group title="卡片尺寸">
                    <Seg value={s.ratio} options={RATIOS.map((r) => ({ value: r.id, label: r.name }))} onChange={(v) => set('ratio', v)} />
                  </Group>
                  <Group title="卡片背景">
                    <Seg value={s.cardBg} options={CARD_BGS.map((b) => ({ value: b.id, label: b.name }))} onChange={(v) => set('cardBg', v)} />
                  </Group>
                  <Group title="卡片字号">
                    <Seg value={s.cardFontSize} options={[16, 18, 20, 22].map((v) => ({ value: v, label: ['小', '中', '大', '特大'][(v - 16) / 2] }))} onChange={(v) => set('cardFontSize', v)} />
                  </Group>
                  <Group title="署名">
                    <input className="text-input" value={s.author} maxLength={24} placeholder="例如 @你的小红书名" onChange={(e) => set('author', e.target.value)} />
                  </Group>
            </>
          )}

          <Group title="字体">
            <Seg value={s.serif} options={[{ value: false, label: '无衬线' }, { value: true, label: '衬线（宋体）' }]} onChange={(v) => set('serif', v)} />
          </Group>

          <Group title="选项">
            <Toggle label="Mac 风格代码块" checked={s.macCode} onChange={(v) => set('macCode', v)} />
            <Toggle label="深色代码块" checked={s.codeDark} onChange={(v) => set('codeDark', v)} />
            {mode === 'wechat' ? (
              <Toggle label="外链转文末脚注" hint="公众号正文里的外链点不开" checked={s.linkFootnote} onChange={(v) => set('linkFootnote', v)} />
            ) : (
              <>
                <Toggle label="一级标题做封面" checked={s.cover} onChange={(v) => set('cover', v)} />
                <Toggle label="显示页码" checked={s.pageNum} onChange={(v) => set('pageNum', v)} />
              </>
            )}
          </Group>

          <p className="hint">
            <BookOpen size={14} />
            {mode === 'wechat'
              ? '可以直接粘贴或拖入本地图片。复制时会一并带上，如果公众号里没显示，就在后台重新插入。'
              : '单独一行 --- 可以手动分页。本地图片可以直接粘贴；网络图片需要图源允许跨域才能导出。'}
          </p>
            </>
          )}
        </aside>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="group">
      <h4>{title}</h4>
      {children}
    </div>
  )
}

function Seg<T extends string | number | boolean>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle" title={hint}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  )
}
