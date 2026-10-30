import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Download, FolderDown, LoaderCircle } from 'lucide-react'
import { toBlob } from 'html-to-image'
import JSZip from 'jszip'
import { renderArticle, titleOf } from './markdown'
import { CARD_BGS, CARD_W, PAD_TOP, PAD_X, RATIOS, paginate, type CardPage } from './cards'
import { alpha, type StyleOptions } from './themes'
import type { Settings } from './App'

const PREVIEW_W = 260

function background(s: Settings): CSSProperties {
  switch (s.cardBg) {
    case 'white':
      return { background: '#ffffff' }
    case 'grid':
      return {
        backgroundColor: '#fcfcfa',
        backgroundImage: 'linear-gradient(rgba(0,0,0,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }
    case 'tint':
      return { background: `linear-gradient(${alpha(s.primary, 0.09)}, ${alpha(s.primary, 0.09)}), #ffffff` }
    case 'night':
      return { background: '#1c1d22' }
    default:
      return { background: '#fbf7ef' }
  }
}

function coverSize(title: string, height: number) {
  const n = title.length
  const size = n <= 8 ? 56 : n <= 14 ? 48 : n <= 22 ? 42 : n <= 32 ? 36 : 30
  return Math.round(size * (height < 600 ? 0.86 : 1))
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function safeName(title: string) {
  return (title || '墨排卡片').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40)
}

export function CardsView({ md, s, imgVersion, onToast }: { md: string; s: Settings; imgVersion: number; onToast: (msg: string) => void }) {
  const [pages, setPages] = useState<CardPage[]>([])
  const [busy, setBusy] = useState(false)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  const height = RATIOS.find((r) => r.id === s.ratio)!.height
  const dark = CARD_BGS.find((b) => b.id === s.cardBg)!.dark
  const title = titleOf(md)

  useEffect(() => {
    let cancelled = false
    const style: StyleOptions = {
      theme: s.theme,
      primary: s.primary,
      fontSize: s.cardFontSize,
      serif: s.serif,
      macCode: s.macCode,
      codeDark: s.codeDark,
      dark,
      mode: 'card',
    }
    const t = setTimeout(async () => {
      const article = renderArticle(md, { ...style, linkFootnote: false })
      const result = await paginate(article, { height, cover: s.cover, style })
      if (!cancelled) setPages(result)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [md, s.theme, s.primary, s.cardFontSize, s.serif, s.macCode, s.codeDark, s.cover, dark, height, imgVersion])

  const shoot = (i: number) => {
    const node = cardRefs.current[i]
    if (!node) throw new Error('card not mounted')
    return toBlob(node, { pixelRatio: 2, skipFonts: true }).then((blob) => {
      if (!blob) throw new Error('empty image')
      return blob
    })
  }

  const exportOne = async (i: number) => {
    try {
      download(await shoot(i), `${safeName(title)}-${String(i + 1).padStart(2, '0')}.png`)
    } catch {
      onToast('导出失败，可能是图片不允许跨域')
    }
  }

  const exportAll = async () => {
    setBusy(true)
    try {
      const zip = new JSZip()
      for (let i = 0; i < pages.length; i++) {
        zip.file(`${String(i + 1).padStart(2, '0')}.png`, await shoot(i))
      }
      download(await zip.generateAsync({ type: 'blob' }), `${safeName(title)}.zip`)
      onToast(`已导出 ${pages.length} 张卡片`)
    } catch {
      onToast('导出失败，可能是图片不允许跨域')
    } finally {
      setBusy(false)
    }
  }

  const scale = PREVIEW_W / CARD_W
  const total = pages.length
  const muted = dark ? '#a1a1aa' : '#8a8a8a'
  const text = dark ? '#ececec' : '#232323'
  const font = s.serif ? `'Songti SC', 'Noto Serif SC', STSong, serif` : undefined

  return (
    <div className="cards-view">
      <div className="cards-bar">
        <span>
          共 <b>{total}</b> 张 · 导出尺寸 1080 × {height * 2}
        </span>
        <button className="btn primary" onClick={exportAll} disabled={busy || !total}>
          {busy ? <LoaderCircle size={16} className="spin" /> : <FolderDown size={16} />} 导出全部（ZIP）
        </button>
      </div>
      <div className="cards-grid">
        {pages.map((page, i) => (
          <div className="card-slot" key={i} style={{ width: PREVIEW_W, height: height * scale }}>
            <div className="card-scale" style={{ transform: `scale(${scale})` }}>
              <div
                className="card"
                ref={(el) => {
                  cardRefs.current[i] = el
                }}
                style={{ width: CARD_W, height, color: text, fontFamily: font, ...background(s) }}
              >
                {page.kind === 'cover' ? (
                  <div className="cover">
                    <i className="cover-bar" style={{ background: s.primary }} />
                    <h1 style={{ fontSize: coverSize(page.title, height), color: text }}>{page.title}</h1>
                    {page.subtitle && <p style={{ color: muted }}>{page.subtitle}</p>}
                    <div className="cover-foot" style={{ color: muted }}>
                      <span>{s.author}</span>
                      <span style={{ color: s.primary }}>滑动阅读 →</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="card-head" style={{ left: PAD_X, right: PAD_X, color: muted }}>
                      <i style={{ background: s.primary }} />
                      <span>{title}</span>
                    </div>
                    <div className="card-content" style={{ top: PAD_TOP, left: PAD_X }} dangerouslySetInnerHTML={{ __html: page.html }} />
                    <div className="card-foot" style={{ left: PAD_X, right: PAD_X, color: muted }}>
                      <span>{s.author}</span>
                      {s.pageNum && (
                        <span>
                          {String(i + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <button className="card-dl" onClick={() => exportOne(i)} title="下载这张">
              <Download size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
