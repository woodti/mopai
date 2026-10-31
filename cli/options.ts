import { COLORS, THEMES, type ThemeId } from '../src/themes'
import { CARD_BGS, RATIOS, type CardBg, type Ratio } from '../src/card-options'
import type { Settings } from '../src/settings'

export const THEME_IDS = THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]]
export const RATIO_IDS = RATIOS.map((r) => r.id) as [Ratio, ...Ratio[]]
export const BG_IDS = CARD_BGS.map((b) => b.id) as [CardBg, ...CardBg[]]
export const COLOR_NAMES: Record<string, string> = {
  blue: COLORS[0],
  green: COLORS[1],
  orange: COLORS[2],
  red: COLORS[3],
  purple: COLORS[4],
  cyan: COLORS[5],
  gold: COLORS[6],
  black: COLORS[7],
}

export type StyleArgs = {
  theme?: string
  color?: string
  ratio?: string
  bg?: string
  author?: string
  fontSize?: number
  cardFontSize?: number
  serif?: boolean
  darkCode?: boolean
  brand?: boolean
  premium?: boolean
  numbering?: boolean
}

function pick<T extends string>(name: string, value: string | undefined, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined
  if (!allowed.includes(value as T)) throw new Error(`${name} 只能是：${allowed.join(', ')}（收到 ${value}）`)
  return value as T
}

export function toSettings(a: StyleArgs): Partial<Settings> {
  const s: Partial<Settings> = {}
  const theme = pick('theme', a.theme, THEME_IDS)
  if (theme) s.theme = theme
  if (a.color !== undefined) {
    const color = COLOR_NAMES[a.color.toLowerCase()] || a.color
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`color 需要是 #RRGGBB 或 ${Object.keys(COLOR_NAMES).join('/')}（收到 ${a.color}）`)
    s.primary = color
  }
  const ratio = pick('ratio', a.ratio, RATIO_IDS)
  if (ratio) s.ratio = ratio
  const bg = pick('bg', a.bg, BG_IDS)
  if (bg) s.cardBg = bg
  if (a.author !== undefined) s.author = a.author
  if (a.fontSize) s.fontSize = Math.min(20, Math.max(12, a.fontSize))
  if (a.cardFontSize) s.cardFontSize = Math.min(26, Math.max(14, a.cardFontSize))
  if (a.serif !== undefined) s.serif = a.serif
  if (a.darkCode !== undefined) s.codeDark = a.darkCode
  if (a.brand !== undefined) s.brand = a.brand
  if (a.premium !== undefined) s.xLimit = a.premium ? 25000 : 280
  if (a.numbering !== undefined) s.xNumber = a.numbering
  return s
}
