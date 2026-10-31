import type { CardBg, Ratio } from './cards'
import { COLORS, type ThemeId } from './themes'

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
  /** 卡片底部的「墨排」小字 */
  brand: boolean
  xLimit: number
  xNumber: boolean
  xBold: boolean
  xEmoji: boolean
}

export const DEFAULTS: Settings = {
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
  brand: true,
  xLimit: 280,
  xNumber: true,
  xBold: true,
  xEmoji: true,
}
