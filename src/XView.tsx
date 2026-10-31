import { useEffect, useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toThread, weightedLength } from './tweets'
import type { Settings } from './settings'

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.cssText = 'position: fixed; left: -10000px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

export function XView({ md, s, onToast }: { md: string; s: Settings; onToast: (msg: string) => void }) {
  const tweets = useMemo(
    () => toThread(md, { limit: s.xLimit, numbering: s.xNumber, unicodeBold: s.xBold, threadEmoji: s.xEmoji }),
    [md, s.xLimit, s.xNumber, s.xBold, s.xEmoji],
  )
  const [copied, setCopied] = useState<Set<number>>(new Set())
  // 内容一变，复制进度就作废
  useEffect(() => setCopied(new Set()), [tweets])

  const name = s.author.replace(/^@/, '') || '你的名字'
  const handle = s.author ? `@${s.author.replace(/^@/, '')}` : '@handle'

  const copyOne = async (i: number) => {
    if (!(await copyText(tweets[i]))) return onToast('复制失败，请手动选中文字复制')
    setCopied((prev) => new Set(prev).add(i))
    onToast(tweets.length > 1 ? `已复制第 ${i + 1} 条，共 ${tweets.length} 条` : '已复制，去 X 粘贴发布')
  }

  const copyAll = async () => {
    if (await copyText(tweets.join('\n\n'))) onToast(`已复制全部 ${tweets.length} 条`)
  }

  return (
    <div className="x-view">
      <div className="cards-bar">
        <span>
          共 <b>{tweets.length}</b> 条{s.xLimit < 1000 ? ' · 单条上限 280' : ' · Premium 长推'}
          {tweets.length > 1 && ` · 已复制 ${copied.size}/${tweets.length}`}
        </span>
        <button className="btn" onClick={copyAll} disabled={!tweets.length}>
          <Copy size={16} /> 复制全部
        </button>
      </div>
      <ol className="thread">
        {tweets.map((text, i) => {
          const len = weightedLength(text)
          const over = len > s.xLimit
          return (
            <li key={i} className={`tweet ${copied.has(i) ? 'done' : ''}`}>
              <div className="tweet-side">
                <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
                {i < tweets.length - 1 && <i className="tweet-line" />}
              </div>
              <div className="tweet-main">
                <div className="tweet-head">
                  <b>{name}</b>
                  <span>{handle}</span>
                </div>
                <p className="tweet-text">{text}</p>
                <div className="tweet-foot">
                  <span className={over ? 'over' : ''}>
                    {len} / {s.xLimit < 1000 ? s.xLimit : '25000'}
                  </span>
                  <button className={`btn small ${copied.has(i) ? 'copied' : ''}`} onClick={() => copyOne(i)}>
                    {copied.has(i) ? <Check size={14} /> : <Copy size={14} />}
                    {copied.has(i) ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
