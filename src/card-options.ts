/** 卡片尺寸和背景选项。单独成文件，命令行校验参数时不必引入排版引擎。 */

export type Ratio = '3:4' | '1:1' | '9:16'

export const RATIOS: { id: Ratio; name: string; height: number }[] = [
  { id: '3:4', name: '3:4 竖图', height: 720 },
  { id: '1:1', name: '1:1 方图', height: 540 },
  { id: '9:16', name: '9:16 长图', height: 960 },
]

export type CardBg = 'paper' | 'white' | 'grid' | 'tint' | 'night'

export const CARD_BGS: { id: CardBg; name: string; dark: boolean }[] = [
  { id: 'paper', name: '米白纸', dark: false },
  { id: 'white', name: '纯白', dark: false },
  { id: 'grid', name: '方格本', dark: false },
  { id: 'tint', name: '主色浅底', dark: false },
  { id: 'night', name: '夜读', dark: true },
]
