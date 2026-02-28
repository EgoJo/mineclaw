/**
 * Pixel Sprite System
 * 直接移植自 pixel-agents 的精灵系统
 * - 16x24 像素点阵角色，4方向，多帧行走动画
 * - getCachedSprite: SpriteData → HTMLCanvasElement（像素放大缓存）
 * - resolveTemplate: 调色板替换
 * - flipHorizontal: 左右镜像生成左向精灵
 */

export type SpriteData = string[][]

// ── Sprite Cache (pixel-agents spriteCache.ts 移植) ──────────────

const zoomCaches = new Map<number, WeakMap<SpriteData, HTMLCanvasElement>>()

export function getCachedSprite(sprite: SpriteData, zoom: number): HTMLCanvasElement {
  let cache = zoomCaches.get(zoom)
  if (!cache) {
    cache = new WeakMap()
    zoomCaches.set(zoom, cache)
  }
  const cached = cache.get(sprite)
  if (cached) return cached

  const rows = sprite.length
  const cols = sprite[0]?.length ?? 0
  const canvas = document.createElement('canvas')
  canvas.width = cols * zoom
  canvas.height = rows * zoom
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = sprite[r][c]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(c * zoom, r * zoom, zoom, zoom)
    }
  }

  cache.set(sprite, canvas)
  return canvas
}

/** Generate a 1px white outline SpriteData (for selected/hovered characters) */
export function getOutlineSprite(sprite: SpriteData): SpriteData {
  const rows = sprite.length
  const cols = sprite[0]?.length ?? 0
  const outline: string[][] = []
  for (let r = 0; r < rows + 2; r++) {
    outline.push(new Array<string>(cols + 2).fill(''))
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!sprite[r][c]) continue
      const er = r + 1, ec = c + 1
      if (!outline[er - 1][ec]) outline[er - 1][ec] = '#FFFFFF'
      if (!outline[er + 1][ec]) outline[er + 1][ec] = '#FFFFFF'
      if (!outline[er][ec - 1]) outline[er][ec - 1] = '#FFFFFF'
      if (!outline[er][ec + 1]) outline[er][ec + 1] = '#FFFFFF'
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (sprite[r][c]) outline[r + 1][c + 1] = ''
    }
  }
  return outline
}

// ── Character Palettes (pixel-agents CHARACTER_PALETTES 移植) ────

export interface CharPalette {
  skin: string; shirt: string; pants: string; hair: string; shoes: string
}

export const CHARACTER_PALETTES: CharPalette[] = [
  { skin: '#FFCC99', shirt: '#4488CC', pants: '#334466', hair: '#553322', shoes: '#222222' },
  { skin: '#FFCC99', shirt: '#CC4444', pants: '#333333', hair: '#FFD700', shoes: '#222222' },
  { skin: '#DEB887', shirt: '#44AA66', pants: '#334444', hair: '#222222', shoes: '#333333' },
  { skin: '#FFCC99', shirt: '#AA55CC', pants: '#443355', hair: '#AA4422', shoes: '#222222' },
  { skin: '#DEB887', shirt: '#CCAA33', pants: '#444433', hair: '#553322', shoes: '#333333' },
  { skin: '#FFCC99', shirt: '#FF8844', pants: '#443322', hair: '#111111', shoes: '#222222' },
  { skin: '#F4C2A1', shirt: '#E84393', pants: '#222244', hair: '#4A0E8F', shoes: '#333333' },
  { skin: '#DEB887', shirt: '#00CED1', pants: '#1A3A3A', hair: '#8B4513', shoes: '#222222' },
  { skin: '#FFCC99', shirt: '#32CD32', pants: '#1A3A1A', hair: '#2F4F4F', shoes: '#333333' },
  { skin: '#C68642', shirt: '#FF6347', pants: '#3A1A1A', hair: '#1C1C1C', shoes: '#222222' },
]

// ── Template System (pixel-agents resolveTemplate 移植) ──────────

const _ = '' // transparent
const H = 'hair', K = 'skin', S = 'shirt', P = 'pants', O = 'shoes', E = '#FFFFFF'
const A = 'accent1', B = 'accent2' // accent colors for occupation-specific details
type TC = typeof H | typeof K | typeof S | typeof P | typeof O | typeof E | typeof A | typeof B | typeof _

function resolveTemplate(template: TC[][], palette: CharPalette): SpriteData {
  const opal = palette as OccupationPalette
  return template.map(row => row.map(cell => {
    if (cell === _) return ''
    if (cell === E) return E
    if (cell === H) return palette.hair
    if (cell === K) return palette.skin
    if (cell === S) return palette.shirt
    if (cell === P) return palette.pants
    if (cell === O) return palette.shoes
    if (cell === A) return opal.accent1 ?? palette.shirt
    if (cell === B) return opal.accent2 ?? palette.hair
    return cell
  }))
}

function flipHorizontal(template: TC[][]): TC[][] {
  return template.map(row => [...row].reverse())
}

// ── Character Sprite Templates (16x24, 直接移植自 pixel-agents) ──

// DOWN WALK
const CHAR_WALK_DOWN_1: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,E,K,K,E,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,O,O,_,_,_,_,_,O,O,_,_,_],
  [_,_,_,_,O,O,_,_,_,_,_,O,O,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

const CHAR_WALK_DOWN_2: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,E,K,K,E,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

const CHAR_WALK_DOWN_3: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,E,K,K,E,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,O,O,_,_,_,_,_,_,P,P,_,_,_],
  [_,_,_,O,O,_,_,_,_,_,_,P,P,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// UP WALK
const CHAR_WALK_UP_1: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,O,O,_,_,_,_,_,_,O,O,_,_,_],
  [_,_,_,O,O,_,_,_,_,_,_,O,O,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

const CHAR_WALK_UP_2: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

const CHAR_WALK_UP_3: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,O,O,_,_,_,_,_,_,P,P,_,_,_],
  [_,_,_,O,O,_,_,_,_,_,_,P,P,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// RIGHT WALK
const CHAR_WALK_RIGHT_1: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,E,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,K,S,S,S,S,K,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,P,P,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,_,_,O,O,_,_,_],
  [_,_,_,_,_,O,O,_,_,_,_,O,O,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

const CHAR_WALK_RIGHT_2: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,E,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,K,S,S,S,S,K,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,P,P,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,_,O,O,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,_,O,O,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

const CHAR_WALK_RIGHT_3: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,E,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,K,S,S,S,S,K,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,P,P,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// IDLE (standing still, facing down)
const CHAR_IDLE_DOWN: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,E,K,K,E,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// SLEEPING (lying down)
const CHAR_SLEEP: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,H,H,H,H,_,_,_,_,_,_,_,_,_,_,_],
  [H,H,H,H,H,H,_,_,_,_,_,_,_,_,_,_],
  [K,K,K,K,K,K,S,S,S,S,S,S,P,P,P,_],
  [K,E,K,K,K,K,S,S,S,S,S,S,P,P,P,_],
  [K,K,K,K,K,K,S,S,S,S,S,S,P,P,O,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// ── Character Sprite Resolution ──────────────────────────────────

export type Direction = 'down' | 'up' | 'right' | 'left'
export type CharState = 'idle' | 'walk' | 'sleep'

export interface CharacterSprites {
  walk: Record<Direction, [SpriteData, SpriteData, SpriteData, SpriteData]>
  idle: Record<Direction, SpriteData>
  sleep: SpriteData
}

const spriteCache2 = new Map<number, CharacterSprites>()

export function getCharacterSprites(paletteIndex: number): CharacterSprites {
  const cached = spriteCache2.get(paletteIndex)
  if (cached) return cached

  const pal = CHARACTER_PALETTES[paletteIndex % CHARACTER_PALETTES.length]
  const r = (t: TC[][]) => resolveTemplate(t, pal)
  const rf = (t: TC[][]) => resolveTemplate(flipHorizontal(t), pal)

  const sprites: CharacterSprites = {
    walk: {
      down:  [r(CHAR_WALK_DOWN_1),  r(CHAR_WALK_DOWN_2),  r(CHAR_WALK_DOWN_3),  r(CHAR_WALK_DOWN_2)],
      up:    [r(CHAR_WALK_UP_1),    r(CHAR_WALK_UP_2),    r(CHAR_WALK_UP_3),    r(CHAR_WALK_UP_2)],
      right: [r(CHAR_WALK_RIGHT_1), r(CHAR_WALK_RIGHT_2), r(CHAR_WALK_RIGHT_3), r(CHAR_WALK_RIGHT_2)],
      left:  [rf(CHAR_WALK_RIGHT_1),rf(CHAR_WALK_RIGHT_2),rf(CHAR_WALK_RIGHT_3),rf(CHAR_WALK_RIGHT_2)],
    },
    idle: {
      down:  r(CHAR_IDLE_DOWN),
      up:    r(CHAR_WALK_UP_2),
      right: r(CHAR_WALK_RIGHT_2),
      left:  rf(CHAR_WALK_RIGHT_2),
    },
    sleep: r(CHAR_SLEEP),
  }

  spriteCache2.set(paletteIndex, sprites)
  return sprites
}

export function getFrameSprite(sprites: CharacterSprites, state: CharState, dir: Direction, frame: number): SpriteData {
  if (state === 'sleep') return sprites.sleep
  if (state === 'idle') return sprites.idle[dir]
  return sprites.walk[dir][frame % 4]
}

// ── Occupation-based Character Palettes ─────────────────────────────────────
// 10种深圳特色职业角色，每种有独特的颜色方案

export type OccupationType =
  | 'delivery_rider' | 'programmer' | 'urban_uncle' | 'electronics_vendor'
  | 'white_collar' | 'startup_founder' | 'drifter' | 'square_dance_auntie'
  | 'security_guard' | 'jogger' | 'default'

export interface OccupationPalette extends CharPalette {
  accent1?: string
  accent2?: string
  label: string
}

export const OCCUPATION_PALETTES: Record<OccupationType, OccupationPalette> = {
  delivery_rider: {
    skin: '#FFCC99', shirt: '#1A6FD4', pants: '#1A1A2E',
    hair: '#FFD700', shoes: '#111111',
    accent1: '#FFD700', accent2: '#FF6600', label: '外卖骑手'
  },
  programmer: {
    skin: '#F0D0B0', shirt: '#2D2D3A', pants: '#1A1A2A',
    hair: '#111111', shoes: '#222222',
    accent1: '#4A90D9', accent2: '#8B6914', label: '程序员'
  },
  urban_uncle: {
    skin: '#C8884A', shirt: '#F5F5F0', pants: '#3A5A7A',
    hair: '#1A1A1A', shoes: '#8B7355',
    accent1: '#CCCCCC', accent2: '#FFFFFF', label: '城中村大叔'
  },
  electronics_vendor: {
    skin: '#FFCC99', shirt: '#2A5A2A', pants: '#1A2A1A',
    hair: '#1A1A1A', shoes: '#222222',
    accent1: '#C0C0C0', accent2: '#FFD700', label: '华强北商人'
  },
  white_collar: {
    skin: '#FFCC99', shirt: '#1A1A3A', pants: '#0A0A1A',
    hair: '#1A1A1A', shoes: '#0A0A0A',
    accent1: '#C0C0C0', accent2: '#FFFFFF', label: '白领'
  },
  startup_founder: {
    skin: '#FFCC99', shirt: '#4A7A9B', pants: '#2A3A4A',
    hair: '#5A3A1A', shoes: '#8B8B8B',
    accent1: '#C0C0C0', accent2: '#FF6B6B', label: '创业者'
  },
  drifter: {
    skin: '#DEB887', shirt: '#8B7355', pants: '#5A4A3A',
    hair: '#2A1A0A', shoes: '#4A3A2A',
    accent1: '#6B4A2A', accent2: '#4CAF50', label: '深漂青年'
  },
  square_dance_auntie: {
    skin: '#DEB887', shirt: '#FF69B4', pants: '#CC44AA',
    hair: '#1A1A1A', shoes: '#FF1493',
    accent1: '#FF69B4', accent2: '#333333', label: '广场舞大妈'
  },
  security_guard: {
    skin: '#C8884A', shirt: '#2A3A5A', pants: '#1A2A3A',
    hair: '#1A1A1A', shoes: '#1A1A1A',
    accent1: '#2A3A5A', accent2: '#888888', label: '保安'
  },
  jogger: {
    skin: '#FFCC99', shirt: '#CCFF00', pants: '#1A1A1A',
    hair: '#1A1A1A', shoes: '#FF6600',
    accent1: '#333333', accent2: '#CCFF00', label: '跑步者'
  },
  default: {
    skin: '#FFCC99', shirt: '#4488CC', pants: '#334466',
    hair: '#553322', shoes: '#222222',
    accent1: '#FFFFFF', accent2: '#CCCCCC', label: '居民'
  },
}

export function getOccupationPalette(occupation?: string): CharPalette {
  const key = (occupation || 'default') as OccupationType
  return OCCUPATION_PALETTES[key] ?? OCCUPATION_PALETTES.default
}

export function getOccupationLabel(occupation?: string): string {
  const key = (occupation || 'default') as OccupationType
  return (OCCUPATION_PALETTES[key] ?? OCCUPATION_PALETTES.default).label
}

// ── Occupation-specific sprite templates ──────────────────────────────────
// Delivery rider: yellow helmet (A=accent1=#FFD700) + blue jacket (S)
// 16x24 grid, A=helmet/accent, B=backpack/box
const DELIVERY_WALK_DOWN_1: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,A,A,A,A,A,A,_,_,_,_,_],
  [_,_,_,_,A,A,A,A,A,A,A,A,_,_,_,_],
  [_,_,_,_,A,A,K,K,K,K,A,A,_,_,_,_],
  [_,_,_,_,A,A,K,E,E,K,A,A,_,_,_,_],
  [_,_,_,_,_,A,K,K,K,K,A,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,O,O,_,_,_,_,_,O,O,_,_,_],
  [_,_,_,_,O,O,_,_,_,_,_,O,O,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]
const DELIVERY_WALK_DOWN_2: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,A,A,A,A,A,A,_,_,_,_,_],
  [_,_,_,_,A,A,A,A,A,A,A,A,_,_,_,_],
  [_,_,_,_,A,A,K,K,K,K,A,A,_,_,_,_],
  [_,_,_,_,A,A,K,E,E,K,A,A,_,_,_,_],
  [_,_,_,_,_,A,K,K,K,K,A,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]
const DELIVERY_WALK_DOWN_3: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,A,A,A,A,A,A,_,_,_,_,_],
  [_,_,_,_,A,A,A,A,A,A,A,A,_,_,_,_],
  [_,_,_,_,A,A,K,K,K,K,A,A,_,_,_,_],
  [_,_,_,_,A,A,K,E,E,K,A,A,_,_,_,_],
  [_,_,_,_,_,A,K,K,K,K,A,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,O,O,_,_,_,_,_,_,P,P,_,_,_],
  [_,_,_,O,O,_,_,_,_,_,_,P,P,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// Programmer: dark hoodie with cap (A=cap=#1A1A2A)
const PROGRAMMER_WALK_DOWN_1: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,A,A,A,A,A,A,_,_,_,_,_],
  [_,_,_,_,A,A,A,A,A,A,A,A,_,_,_,_],
  [_,_,_,_,A,A,H,H,H,H,A,A,_,_,_,_],
  [_,_,_,_,_,A,K,K,K,K,A,_,_,_,_,_],
  [_,_,_,_,_,_,K,E,K,E,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,O,O,_,_,_,_,_,O,O,_,_,_],
  [_,_,_,_,O,O,_,_,_,_,_,O,O,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]
const PROGRAMMER_WALK_DOWN_2: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,A,A,A,A,A,A,_,_,_,_,_],
  [_,_,_,_,A,A,A,A,A,A,A,A,_,_,_,_],
  [_,_,_,_,A,A,H,H,H,H,A,A,_,_,_,_],
  [_,_,_,_,_,A,K,K,K,K,A,_,_,_,_,_],
  [_,_,_,_,_,_,K,E,K,E,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,_,O,O,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]
const PROGRAMMER_WALK_DOWN_3: TC[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,A,A,A,A,A,A,_,_,_,_,_],
  [_,_,_,_,A,A,A,A,A,A,A,A,_,_,_,_],
  [_,_,_,_,A,A,H,H,H,H,A,A,_,_,_,_],
  [_,_,_,_,_,A,K,K,K,K,A,_,_,_,_,_],
  [_,_,_,_,_,_,K,E,K,E,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,_,_,S,S,S,S,_,_,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  [_,_,_,_,K,S,S,S,S,S,S,K,_,_,_,_],
  [_,_,_,_,_,S,S,S,S,S,S,_,_,_,_,_],
  [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
  [_,_,_,O,O,_,_,_,_,_,_,P,P,_,_,_],
  [_,_,_,O,O,_,_,_,_,_,_,P,P,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// Occupation-based sprite cache (by occupation key)
const occupationSpriteCache = new Map<string, CharacterSprites>()

export function getOccupationSprites(occupation?: string): CharacterSprites {
  const key = occupation || 'default'
  const cached = occupationSpriteCache.get(key)
  if (cached) return cached

  const pal = getOccupationPalette(occupation)
  const r = (t: TC[][]) => resolveTemplate(t, pal)
  const rf = (t: TC[][]) => resolveTemplate(flipHorizontal(t), pal)

  // Use occupation-specific templates for distinctive characters
  let downFrames: [TC[][], TC[][], TC[][], TC[][]] = [CHAR_WALK_DOWN_1, CHAR_WALK_DOWN_2, CHAR_WALK_DOWN_3, CHAR_WALK_DOWN_2]
  if (key === 'delivery_rider') {
    downFrames = [DELIVERY_WALK_DOWN_1, DELIVERY_WALK_DOWN_2, DELIVERY_WALK_DOWN_3, DELIVERY_WALK_DOWN_2]
  } else if (key === 'programmer') {
    downFrames = [PROGRAMMER_WALK_DOWN_1, PROGRAMMER_WALK_DOWN_2, PROGRAMMER_WALK_DOWN_3, PROGRAMMER_WALK_DOWN_2]
  }

  const sprites: CharacterSprites = {
    walk: {
      down:  [r(downFrames[0]), r(downFrames[1]), r(downFrames[2]), r(downFrames[3])],
      up:    [r(CHAR_WALK_UP_1),    r(CHAR_WALK_UP_2),    r(CHAR_WALK_UP_3),    r(CHAR_WALK_UP_2)],
      right: [r(CHAR_WALK_RIGHT_1), r(CHAR_WALK_RIGHT_2), r(CHAR_WALK_RIGHT_3), r(CHAR_WALK_RIGHT_2)],
      left:  [rf(CHAR_WALK_RIGHT_1),rf(CHAR_WALK_RIGHT_2),rf(CHAR_WALK_RIGHT_3),rf(CHAR_WALK_RIGHT_2)],
    },
    idle: {
      down:  r(key === 'delivery_rider' ? DELIVERY_WALK_DOWN_2 : key === 'programmer' ? PROGRAMMER_WALK_DOWN_2 : CHAR_IDLE_DOWN),
      up:    r(CHAR_WALK_UP_2),
      right: r(CHAR_WALK_RIGHT_2),
      left:  rf(CHAR_WALK_RIGHT_2),
    },
    sleep: r(CHAR_SLEEP),
  }

  occupationSpriteCache.set(key, sprites)
  return sprites
}
