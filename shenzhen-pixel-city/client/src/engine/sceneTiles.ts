/**
 * 深圳像素城市 - 瓦片地图系统 v3.0
 * 设计哲学：参考图风格的俯视角像素城市
 * - 精细建筑立面：空调外机、晾衣物、窗户、天台水箱
 * - 行道树：圆形多层次树冠，密集排列
 * - 停放车辆：俯视角小轿车
 * - 场景扩大到 36x24 格，支持拖拽滚动
 */

import type { SpriteData } from './spriteSystem'

// ── Tile Types ────────────────────────────────────────────────────
export type TileType =
  | 'road_h'
  | 'road_v'
  | 'road_cross'
  | 'sidewalk'
  | 'sidewalk_edge'
  | 'grass'
  | 'grass_lush'
  | 'water'
  | 'water_edge'
  | 'concrete'
  | 'tile_plaza'
  | 'building'
  | 'park_path'
  | 'fence_green'
  | 'alley'

export const TILE_COLORS: Record<TileType, { base: string; detail?: string; line?: string; line2?: string }> = {
  road_h:        { base: '#484848', detail: '#525252', line: '#FFCC00', line2: '#FFFFFF' },
  road_v:        { base: '#484848', detail: '#525252', line: '#FFCC00', line2: '#FFFFFF' },
  road_cross:    { base: '#484848', detail: '#525252', line: '#FFFFFF' },
  sidewalk:      { base: '#A09080', detail: '#B0A090', line: '#888070' },
  sidewalk_edge: { base: '#888070', detail: '#706858', line: '#C0B0A0' },
  grass:         { base: '#3A6A28', detail: '#4A7A34', line: '#2E5420' },
  grass_lush:    { base: '#2A5A1A', detail: '#3A6A24', line: '#1E4414' },
  water:         { base: '#1A3A5A', detail: '#1E4468', line: '#2A5A8A' },
  water_edge:    { base: '#2A4A6A', detail: '#3A5A7A', line: '#4A7AAA' },
  concrete:      { base: '#686860', detail: '#747468', line: '#585850' },
  tile_plaza:    { base: '#C0B090', detail: '#D0C0A0', line: '#A09070' },
  building:      { base: '#1A1A20', detail: '#1A1A20' },
  park_path:     { base: '#8A6A40', detail: '#9A7A50', line: '#7A5A30' },
  fence_green:   { base: '#3A6A28', detail: '#4A7A34', line: '#1A4A10' },
  alley:         { base: '#383830', detail: '#404038', line: '#303028' },
}

const _ = ''

const R  : TileType = 'road_h'
const V  : TileType = 'road_v'
const X  : TileType = 'road_cross'
const S  : TileType = 'sidewalk'
const E  : TileType = 'sidewalk_edge'
const G  : TileType = 'grass'
const GL : TileType = 'grass_lush'
const W  : TileType = 'water'
const WE : TileType = 'water_edge'
const C  : TileType = 'concrete'
const P  : TileType = 'tile_plaza'
const B  : TileType = 'building'
const PP : TileType = 'park_path'
const FG : TileType = 'fence_green'
const AL : TileType = 'alley'

const VILLAGE_MAP: TileType[][] = [
  [B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B, B, B, B, B, AL, AL, B, B, B, B, B, B, B, B],
  [AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL],
  [AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL, AL],
  [C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C],
  [FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG, FG],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G]
]

const TECH_MAP: TileType[][] = [
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G]
]

const CBD_MAP: TileType[][] = [
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P],
  [P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P],
  [P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P]
]

const HUAQIANG_MAP: TileType[][] = [
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B]
]

const DONGMEN_MAP: TileType[][] = [
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C],
  [C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S]
]

const APARTMENT_MAP: TileType[][] = [
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  [S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G]
]

const PARK_MAP: TileType[][] = [
  [GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL, GL],
  [GL, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, GL],
  [GL, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, GL],
  [GL, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, GL],
  [GL, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, GL],
  [GL, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, GL],
  [GL, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, GL],
  [PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP],
  [PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP, PP],
  [GL, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, GL],
  [GL, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, GL],
  [WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE, WE],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W]
]


// ── Pixel Sprites ─────────────────────────────────────────────────

/** 城中村握手楼（俯视角，精细版 32x48）*/
export const VILLAGE_BUILDING: SpriteData = (() => {
  const WL = '#C8C8B8'  // 外墙浅色
  const WD = '#A8A898'  // 外墙深色
  const WS = '#B8B8A8'  // 外墙中间色
  const WN = '#989888'  // 外墙污迹
  const WT = '#D8D8C8'  // 外墙高光
  const WI = '#4A6080'  // 窗户玻璃（深蓝灰）
  const WF = '#3A5070'  // 窗框
  const WH = '#6A90B0'  // 窗户高光
  const AC = '#E0E0D8'  // 空调外机白
  const AG = '#C0C0B8'  // 空调格栅
  const AB = '#A0A098'  // 空调底座
  const RO = '#886644'  // 屋顶（红棕）
  const RT = '#AA8866'  // 屋顶高光
  const RS = '#664422'  // 屋顶阴影
  const TK = '#707070'  // 水箱（深灰）
  const TL = '#909090'  // 水箱高光
  const TS = '#505050'  // 水箱阴影
  const DR = '#2A2A2A'  // 车库门（深色）
  const DL = '#3A3A3A'  // 车库门格栅
  const DH = '#4A4A4A'  // 车库门高光
  const CL = '#CC4444'  // 晾衣物（红）
  const CB = '#4444CC'  // 晾衣物（蓝）
  const CW = '#CCCCCC'  // 晾衣物（白）
  const WR = '#886644'  // 晾衣杆（棕）

  const rows: string[][] = []

  // 天台 (4行)
  rows.push([RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO])
  rows.push([RT,RT,RT,TK,TK,TL,TK,RO,RO,RO,RO,RO,RO,RO,RO,RO,TK,TK,TL,TK,RO,RO,RO,RO,RO,RO,RO,TK,TK,TL,TK,RT])
  rows.push([RO,RO,RO,TK,TS,TK,TK,RO,RO,RO,RO,RO,RO,RO,RO,RO,TK,TS,TK,TK,RO,RO,RO,RO,RO,RO,RO,TK,TS,TK,TK,RO])
  rows.push([RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS])

  // 7层楼，每层6行（更高更精细）
  for (let floor = 0; floor < 7; floor++) {
    const alt = floor % 2 === 0
    const hasClothes = floor === 2 || floor === 4
    // 楼层顶部横梁
    rows.push([WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD])
    // 窗户行1（窗框顶）
    rows.push([WS,WF,WF,WF,WF,WF,WS,WF,WF,WF,WF,WF,WS,WF,WF,WF,WF,WF,WS,WF,WF,WF,WF,WF,WS,WF,WF,WF,WF,WF,WS,WS])
    // 窗户行2（玻璃上半）
    rows.push([WS,WF,WH,WI,WH,WF,WS,WF,WH,WI,WH,WF,WS,WF,WH,WI,WH,WF,WS,WF,WH,WI,WH,WF,WS,WF,WH,WI,WH,WF,WS,WS])
    // 窗户行3（玻璃下半）+ 空调
    if (alt) {
      rows.push([WS,WF,WI,WI,WI,WF,WS,WF,WI,WI,WI,WF,WS,WF,WI,WI,WI,WF,WS,WF,WI,WI,WI,WF,WS,WF,WI,WI,WI,WF,AC,AG])
    } else {
      rows.push([WS,WF,WI,WI,WI,WF,WS,WF,WI,WI,WI,WF,WS,WF,WI,WI,WI,WF,WS,WF,WI,WI,WI,WF,WS,AC,AG,AG,AC,WS,AB,WS])
    }
    // 晾衣物行（部分楼层）
    if (hasClothes) {
      rows.push([WS,WR,CL,CW,CB,WR,WS,WR,CW,CL,CW,WR,WS,WR,CB,CW,CL,WR,WS,WR,CL,CB,CW,WR,WS,WR,CW,CL,CB,WR,WS,WS])
    } else {
      rows.push([alt?WN:WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,WL,alt?WN:WL])
    }
    // 楼层底部
    rows.push([WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD])
  }

  // 底层（车库门）4行
  rows.push([WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD])
  rows.push([WS,DR,DH,DL,DL,DL,DR,WS,DR,DH,DL,DL,DR,WS,DR,DH,DL,DL,DL,DR,WS,DR,DH,DL,DL,DR,WS,DR,DH,DL,DR,WS])
  rows.push([WS,DR,DL,DL,DL,DL,DR,WS,DR,DL,DL,DL,DR,WS,DR,DL,DL,DL,DL,DR,WS,DR,DL,DL,DL,DR,WS,DR,DL,DL,DR,WS])
  rows.push([WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD])

  return rows
})()

/** 科技园玻璃幕墙写字楼（俯视角，精细版 32x46）*/
export const OFFICE_TOWER: SpriteData = (() => {
  const WL = '#B8C8D8'
  const WD = '#8899AA'
  const GL = '#AACCEE'
  const GD = '#7799BB'
  const GH = '#CCEEFF'
  const GS = '#99BBDD'
  const FR = '#445566'
  const RO = '#667788'
  const RT = '#889AAA'
  const RS = '#445566'
  const AC = '#E0E8F0'
  const AG = '#C0C8D0'
  const AB = '#A0A8B0'
  const LB = '#FFEE88'  // 大堂灯光

  const rows: string[][] = []

  // 屋顶设备层 (4行)
  rows.push([RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO])
  rows.push([RT,RT,RT,AC,AG,AC,RT,RT,RT,RT,RT,RT,RT,RT,RT,RT,RT,RT,AC,AG,AC,RT,RT,RT,RT,RT,RT,AC,AG,AC,RT,RT])
  rows.push([RO,RO,RO,AC,AG,AC,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,RO,AC,AG,AC,RO,RO,RO,RO,RO,RO,AC,AG,AC,RO,RO])
  rows.push([RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS,RS])

  // 8层玻璃幕墙，每层5行
  for (let floor = 0; floor < 8; floor++) {
    const alt = floor % 2 === 0
    rows.push([FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR])
    rows.push([FR,GH,GH,GL,FR,GH,GH,GL,FR,GH,GH,GL,FR,GH,GH,GL,FR,GH,GH,GL,FR,GH,GH,GL,FR,GH,GH,GL,FR,GH,GH,FR])
    rows.push([FR,alt?GD:GL,GL,alt?GD:GL,FR,alt?GD:GL,GL,alt?GD:GL,FR,alt?GD:GL,GL,alt?GD:GL,FR,alt?GD:GL,GL,alt?GD:GL,FR,alt?GD:GL,GL,alt?GD:GL,FR,alt?GD:GL,GL,alt?GD:GL,FR,alt?GD:GL,GL,alt?GD:GL,FR,alt?GD:GL,GL,FR])
    rows.push([FR,GS,GS,GS,FR,GS,GS,GS,FR,GS,GS,GS,FR,GS,GS,GS,FR,GS,GS,GS,FR,GS,GS,GS,FR,GS,GS,GS,FR,GS,GS,FR])
    rows.push([WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD])
  }

  // 底层大堂 (2行)
  rows.push([FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR,FR])
  rows.push([WL,GH,GH,GH,GH,GH,WL,GH,GH,GH,GH,GH,WL,GH,GH,GH,GH,GH,WL,GH,GH,GH,GH,GH,WL,GH,GH,GH,GH,GH,WL,WL])

  return rows
})()

/** 行道树（圆形树冠，俯视角，精细版 18x20）*/
export const STREET_TREE: SpriteData = (() => {
  const T1 = '#1A4A0A'
  const T2 = '#2A6A18'
  const T3 = '#3A8A28'
  const T4 = '#4AA038'
  const T5 = '#5AB848'
  const T6 = '#6ACC58'
  const T7 = '#7AE068'  // 最亮高光
  const TR = '#5A3A1A'
  const SH = '#1A3A08'
  const _ = ''
  return [
    [_,  _,  _,  _,  _,  T1, T1, T1, T1, T1, T1, T1, _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  T1, T2, T3, T3, T3, T3, T3, T2, T1, _,  _,  _,  _,  _],
    [_,  _,  _,  T1, T2, T3, T4, T5, T5, T5, T4, T3, T2, T1, _,  _,  _,  _],
    [_,  _,  T1, T2, T3, T4, T5, T6, T7, T6, T5, T4, T3, T2, T1, _,  _,  _],
    [_,  T1, T2, T3, T4, T5, T6, T7, T7, T7, T6, T5, T4, T3, T2, T1, _,  _],
    [_,  T1, T2, T3, T5, T6, T7, T7, T7, T7, T7, T6, T5, T3, T2, T1, _,  _],
    [T1, T2, T3, T4, T5, T7, T7, T7, T7, T7, T7, T7, T5, T4, T3, T2, T1, _],
    [T1, T2, T3, T4, T5, T6, T7, T7, T7, T7, T7, T6, T5, T4, T3, T2, T1, _],
    [T1, T2, T3, T4, T5, T6, T6, T7, T7, T7, T6, T6, T5, T4, T3, T2, T1, _],
    [T1, T2, T3, T4, T4, T5, T6, T6, T6, T6, T5, T4, T4, T4, T3, T2, T1, _],
    [_,  T1, T2, T3, T4, T4, T5, T5, T5, T5, T4, T4, T3, T3, T2, T1, _,  _],
    [_,  T1, T2, T3, T3, T4, T4, T4, T4, T4, T4, T3, T3, T3, T2, T1, _,  _],
    [_,  _,  T1, T2, T3, T3, SH, SH, SH, SH, T3, T3, T2, T2, T1, _,  _,  _],
    [_,  _,  _,  T1, T2, T2, SH, SH, SH, SH, T2, T2, T1, _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  TR, TR, TR, TR, _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  TR, TR, TR, TR, _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  TR, TR, TR, TR, _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  TR, TR, TR, TR, _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
  ]
})()

/** 灌木丛（不规则绿色团块）14x10 */
export const BUSH_CLUSTER: SpriteData = (() => {
  const B1 = '#1A4A0A'
  const B2 = '#2A6A18'
  const B3 = '#3A8028'
  const B4 = '#4A9838'
  const B5 = '#5AAA48'
  const B6 = '#6ABB58'
  const _ = ''
  return [
    [_,  B1, B2, B3, B2, B1, _,  _,  B1, B2, B3, B1, _,  _],
    [B1, B2, B3, B4, B5, B3, B2, B1, B2, B3, B4, B2, B1, _],
    [B2, B3, B4, B5, B6, B4, B3, B2, B3, B4, B5, B3, B2, B1],
    [B2, B3, B4, B5, B5, B4, B4, B3, B4, B5, B4, B3, B2, B1],
    [B2, B3, B4, B5, B4, B4, B3, B4, B5, B4, B3, B2, B1, _],
    [B1, B2, B3, B4, B3, B3, B2, B3, B4, B3, B2, B1, _,  _],
    [_,  B1, B2, B3, B2, B2, B1, B2, B3, B2, B1, _,  _,  _],
    [_,  _,  B1, B2, B1, B1, _,  B1, B2, B1, _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
  ]
})()

/** 停放的小轿车（俯视角，精细版 16x10）*/
export const PARKED_CAR_WHITE: SpriteData = (() => {
  const CB = '#E8E8E8'
  const CS = '#C8C8C8'
  const CD = '#A8A8A8'
  const CW = '#7A9AB8'
  const CG = '#5A7A98'
  const CT = '#282828'
  const CH = '#F8F8F8'
  const CR = '#FF4444'
  const CF = '#FFFF88'
  const CM = '#888888'  // 车身中间
  const _ = ''
  return [
    [_,  CT, CT, CT, CD, CD, CD, CD, CD, CD, CD, CD, CT, CT, CT, _],
    [CT, CD, CS, CB, CB, CB, CB, CB, CB, CB, CB, CB, CB, CS, CD, CT],
    [CT, CS, CB, CW, CG, CW, CH, CH, CH, CH, CW, CG, CW, CB, CS, CT],
    [CT, CS, CB, CW, CG, CW, CH, CH, CH, CH, CW, CG, CW, CB, CS, CT],
    [CT, CS, CB, CB, CB, CB, CB, CB, CB, CB, CB, CB, CB, CB, CS, CT],
    [CT, CS, CM, CM, CM, CM, CM, CM, CM, CM, CM, CM, CM, CM, CS, CT],
    [CT, CD, CS, CF, CB, CB, CB, CB, CB, CB, CB, CB, CR, CS, CD, CT],
    [_,  CT, CT, CT, CD, CD, CD, CD, CD, CD, CD, CD, CT, CT, CT, _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
  ]
})()

/** 停放的小轿车（深色款 16x10）*/
export const PARKED_CAR_DARK: SpriteData = (() => {
  const CB = '#383838'
  const CS = '#282828'
  const CD = '#181818'
  const CW = '#5A7A9A'
  const CG = '#3A5A7A'
  const CT = '#101010'
  const CH = '#6A8AAA'
  const CR = '#FF4444'
  const CF = '#FFFF88'
  const CM = '#484848'
  const _ = ''
  return [
    [_,  CT, CT, CT, CD, CD, CD, CD, CD, CD, CD, CD, CT, CT, CT, _],
    [CT, CD, CS, CB, CB, CB, CB, CB, CB, CB, CB, CB, CB, CS, CD, CT],
    [CT, CS, CB, CW, CG, CW, CH, CH, CH, CH, CW, CG, CW, CB, CS, CT],
    [CT, CS, CB, CW, CG, CW, CH, CH, CH, CH, CW, CG, CW, CB, CS, CT],
    [CT, CS, CB, CB, CB, CB, CB, CB, CB, CB, CB, CB, CB, CB, CS, CT],
    [CT, CS, CM, CM, CM, CM, CM, CM, CM, CM, CM, CM, CM, CM, CS, CT],
    [CT, CD, CS, CF, CB, CB, CB, CB, CB, CB, CB, CB, CR, CS, CD, CT],
    [_,  CT, CT, CT, CD, CD, CD, CD, CD, CD, CD, CD, CT, CT, CT, _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
  ]
})()

/** 绿色护栏（水平，10x5）*/
export const GREEN_FENCE_H: SpriteData = [
  ['#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10'],
  ['#2A6A20','#1A4A10','#2A6A20','#1A4A10','#2A6A20','#1A4A10','#2A6A20','#1A4A10','#2A6A20','#1A4A10'],
  ['#3A7A30','#1A4A10','#3A7A30','#1A4A10','#3A7A30','#1A4A10','#3A7A30','#1A4A10','#3A7A30','#1A4A10'],
  ['#2A6A20','#1A4A10','#2A6A20','#1A4A10','#2A6A20','#1A4A10','#2A6A20','#1A4A10','#2A6A20','#1A4A10'],
  ['#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10','#1A4A10'],
]

/** 路灯（精细版 10x22）*/
export const STREET_LAMP: SpriteData = (() => {
  const _ = ''
  const LA = '#CCCCAA'  // 灯臂
  const LH = '#FFEE88'  // 灯光
  const LL = '#FFDD44'  // 灯光核心
  const PL = '#888888'  // 灯柱
  const PD = '#666666'  // 灯柱阴影
  const PB = '#555555'  // 灯柱底座
  return [
    [_,  _,  _,  LA, LA, LA, LA, LA, _,  _],
    [_,  _,  LA, LH, LH, LH, LH, LH, LA, _],
    [_,  _,  LA, LH, LL, LL, LH, LH, LA, _],
    [_,  _,  LA, LH, LH, LH, LH, LH, LA, _],
    [_,  _,  _,  LA, LA, PL, LA, LA, _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  _,  _,  _,  _,  PL, PD, _,  _,  _],
    [_,  PB, PB, PB, PB, PB, PB, PB, PB, _],
    [_,  PB, PD, PD, PD, PD, PD, PD, PB, _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _],
  ]
})()

/** 垃圾桶（蓝色，精细版 8x10）*/
export const TRASH_BIN: SpriteData = (() => {
  const _ = ''
  return [
    [_,  '#1A4A9A','#2A5AAA','#2A5AAA','#2A5AAA','#2A5AAA','#1A4A9A',_],
    ['#1A4A9A','#3A6ABB','#5A8ADD','#5A8ADD','#5A8ADD','#5A8ADD','#3A6ABB','#1A4A9A'],
    ['#2A5AAA','#4A7ACC','#6A9AEE','#6A9AEE','#6A9AEE','#6A9AEE','#4A7ACC','#2A5AAA'],
    ['#2A5AAA','#4A7ACC','#5A8ADD','#5A8ADD','#5A8ADD','#5A8ADD','#4A7ACC','#2A5AAA'],
    ['#2A5AAA','#4A7ACC','#5A8ADD','#5A8ADD','#5A8ADD','#5A8ADD','#4A7ACC','#2A5AAA'],
    ['#2A5AAA','#4A7ACC','#5A8ADD','#5A8ADD','#5A8ADD','#5A8ADD','#4A7ACC','#2A5AAA'],
    ['#2A5AAA','#3A6ABB','#4A7ACC','#4A7ACC','#4A7ACC','#4A7ACC','#3A6ABB','#2A5AAA'],
    [_,  '#1A4A9A','#2A5AAA','#2A5AAA','#2A5AAA','#2A5AAA','#1A4A9A',_],
    [_,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _],
  ]
})()

/** 便利店（精细版 20x16）*/
export const CONVENIENCE_STORE: SpriteData = (() => {
  const WL = '#EEEEEE'
  const WD = '#CCCCCC'
  const RC = '#EE3333'
  const RD = '#BB1111'
  const YL = '#FFEE44'
  const GL = '#88CCFF'
  const GD = '#5599CC'
  const GH = '#AADDFF'
  const DR = '#444444'
  const DH = '#666666'
  const _ = ''
  return [
    [_,  RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, _],
    [RC, RC, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, RC, RC],
    [RC, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, RC],
    [RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC],
    [WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL],
    [WL, WD, GH, GL, GL, GD, WD, WL, WL, WL, WL, WL, WD, GH, GL, GL, GD, WD, WL, WL],
    [WL, WD, GL, GL, GL, GD, WD, WL, WL, WL, WL, WL, WD, GL, GL, GL, GD, WD, WL, WL],
    [WL, WD, GL, GL, GL, GD, WD, WL, WL, WL, WL, WL, WD, GL, GL, GL, GD, WD, WL, WL],
    [WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL, WL],
    [WL, WD, GH, GL, GL, GD, WD, WL, WL, WL, WL, WL, WD, GH, GL, GL, GD, WD, WL, WL],
    [WL, WD, GL, GL, GL, GD, WD, WL, WL, WL, WL, WL, WD, GL, GL, GL, GD, WD, WL, WL],
    [WL, WL, WL, WL, WL, WL, WL, DR, DH, DR, DH, DR, WL, WL, WL, WL, WL, WL, WL, WL],
    [WL, WL, WL, WL, WL, WL, WL, DR, DH, DR, DH, DR, WL, WL, WL, WL, WL, WL, WL, WL],
    [WL, WL, WL, WL, WL, WL, WL, DR, DH, DR, DH, DR, WL, WL, WL, WL, WL, WL, WL, WL],
    [WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD],
    [WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD],
  ]
})()

/** 地铁站入口（精细版 24x14）*/
export const METRO_ENTRANCE: SpriteData = (() => {
  const BC = '#1144AA'
  const BL = '#2255CC'
  const BH = '#3366DD'
  const WC = '#AABBDD'
  const YL = '#FFDD00'
  const DD = '#0A2255'
  const _ = ''
  return [
    [_,  _,  _,  BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, _,  _,  _],
    [_,  _,  BC, BC, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, BC, BC, _,  _],
    [_,  BC, BC, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, BC, BC, _],
    [_,  BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, BC, _],
    [BC, BC, BL, BH, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BH, BL, BC, BC],
    [BC, BL, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, BL, BC],
    [BC, BL, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, BL, BC],
    [BC, BL, WC, WC, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, WC, WC, BL, BC],
    [BC, BL, WC, WC, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, WC, WC, BL, BC],
    [BC, BL, WC, WC, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, WC, WC, BL, BC],
    [BC, BC, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BL, BC, BC],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
  ]
})()

/** 华强北电子大厦招牌（精细版 40x12）*/
export const HUAQIANG_SIGN: SpriteData = (() => {
  const RC = '#EE1111', YL = '#FFEE00', WC = '#FFFFFF', DD = '#222222', RD = '#AA0000'
  return [
    [DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD],
    [DD,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,DD],
    [DD,RC,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,RC,DD],
    [DD,RC,YL,WC,WC,YL,WC,WC,WC,YL,WC,YL,WC,YL,YL,WC,YL,YL,WC,WC,WC,YL,WC,YL,WC,YL,YL,WC,YL,YL,WC,WC,WC,YL,WC,WC,WC,YL,RC,DD],
    [DD,RC,YL,WC,WC,YL,WC,YL,WC,YL,WC,YL,WC,YL,YL,WC,YL,YL,WC,YL,YL,YL,WC,YL,WC,YL,YL,WC,YL,YL,WC,YL,YL,YL,WC,YL,WC,YL,RC,DD],
    [DD,RC,YL,WC,WC,YL,WC,WC,WC,YL,WC,YL,WC,YL,YL,WC,YL,YL,WC,WC,YL,YL,WC,YL,WC,YL,YL,WC,YL,YL,WC,WC,YL,YL,WC,WC,WC,YL,RC,DD],
    [DD,RC,YL,WC,WC,YL,WC,YL,YL,YL,WC,YL,WC,YL,YL,WC,YL,YL,WC,YL,YL,YL,WC,YL,WC,YL,YL,WC,YL,YL,WC,YL,YL,YL,WC,YL,WC,YL,RC,DD],
    [DD,RC,YL,WC,WC,YL,WC,YL,YL,YL,WC,WC,WC,YL,YL,WC,YL,YL,WC,WC,WC,YL,WC,WC,WC,YL,YL,WC,YL,YL,WC,WC,WC,YL,WC,YL,WC,YL,RC,DD],
    [DD,RC,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,YL,RC,DD],
    [DD,RD,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RD,DD],
    [DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD],
    [DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD,DD],
  ]
})()

/** 老街红灯笼（精细版 8x14）*/
export const RED_LANTERN: SpriteData = (() => {
  const _ = ''
  return [
    [_,  _,  '#CC2200','#CC2200','#CC2200','#CC2200',_,  _],
    [_,  '#CC2200','#FF4400','#FF6600','#FF6600','#FF4400','#CC2200',_],
    ['#CC2200','#FF4400','#FF7700','#FF9900','#FF9900','#FF7700','#FF4400','#CC2200'],
    ['#CC2200','#FF4400','#FF7700','#FF9900','#FF9900','#FF7700','#FF4400','#CC2200'],
    ['#CC2200','#FF5500','#FF8800','#FFAA00','#FFAA00','#FF8800','#FF5500','#CC2200'],
    ['#CC2200','#FF5500','#FF8800','#FFAA00','#FFAA00','#FF8800','#FF5500','#CC2200'],
    ['#CC2200','#FF4400','#FF7700','#FF9900','#FF9900','#FF7700','#FF4400','#CC2200'],
    ['#CC2200','#FF4400','#FF6600','#FF6600','#FF6600','#FF6600','#FF4400','#CC2200'],
    [_,  '#CC2200','#FF4400','#FF4400','#FF4400','#FF4400','#CC2200',_],
    [_,  _,  '#AA1100','#AA1100','#AA1100','#AA1100',_,  _],
    [_,  _,  '#FFDD00','#FFDD00','#FFDD00','#FFDD00',_,  _],
    [_,  _,  '#FFDD00','#FFDD00','#FFDD00','#FFDD00',_,  _],
    [_,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _],
  ]
})()

/** 公园大树（精细版 16x20）*/
export const PARK_TREE: SpriteData = (() => {
  const T1 = '#1A4A08', T2 = '#2A6A14', T3 = '#3A8A24', T4 = '#4AA034'
  const T5 = '#5AB844', T6 = '#6ACC54', T7 = '#7AE064'
  const TR = '#5A3A1A', SH = '#142A06'
  const _ = ''
  return [
    [_,  _,  _,  _,  _,  T1, T1, T1, T1, T1, _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  T1, T2, T3, T3, T3, T2, T1, _,  _,  _,  _,  _],
    [_,  _,  _,  T1, T2, T3, T4, T5, T5, T4, T3, T2, T1, _,  _,  _],
    [_,  _,  T1, T2, T3, T4, T5, T6, T7, T6, T5, T4, T3, T2, T1, _],
    [_,  T1, T2, T3, T4, T5, T6, T7, T7, T7, T6, T5, T4, T3, T2, T1],
    [_,  T1, T2, T3, T5, T6, T7, T7, T7, T7, T7, T6, T5, T3, T2, T1],
    [T1, T2, T3, T4, T5, T7, T7, T7, T7, T7, T7, T7, T5, T4, T3, T2],
    [T1, T2, T3, T4, T5, T6, T7, T7, T7, T7, T7, T6, T5, T4, T3, T2],
    [T1, T2, T3, T4, T5, T6, T6, T7, T7, T7, T6, T6, T5, T4, T3, T2],
    [T1, T2, T3, T4, T4, T5, T6, T6, T6, T6, T5, T4, T4, T4, T3, T2],
    [_,  T1, T2, T3, T4, T4, T5, T5, T5, T5, T4, T4, T3, T3, T2, T1],
    [_,  T1, T2, T3, T3, T4, T4, T4, T4, T4, T4, T3, T3, T3, T2, T1],
    [_,  _,  T1, T2, T3, T3, SH, SH, SH, SH, T3, T3, T2, T2, T1, _],
    [_,  _,  _,  T1, T2, T2, SH, SH, SH, SH, T2, T2, T1, _,  _,  _],
    [_,  _,  _,  _,  _,  _,  TR, TR, TR, TR, _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  TR, TR, TR, TR, _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  TR, TR, TR, TR, _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  TR, TR, TR, TR, _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
  ]
})()

/** 深圳湾海滨栈道（精细版 28x10）*/
export const BOARDWALK: SpriteData = (() => {
  const WD = '#8B6914', WL = '#A07820', RC = '#CC8833', BL = '#1A3A6A', WV = '#2A5A9A'
  const WH = '#B08830'  // 木板高光
  return [
    [WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD],
    [WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL],
    [RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC],
    [WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD],
    [WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL,WD,WL,WL],
    [RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC,RC],
    [WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD,WL,WH,WD],
    [BL,WV,BL,WV,BL,WV,BL,WV,BL,WV,BL,WV,BL,WV,BL,WV,BL,WV,BL,WV,BL,WV,BL,WV,BL,WV,BL,WV],
    [BL,BL,WV,BL,BL,WV,BL,BL,WV,BL,BL,WV,BL,BL,WV,BL,BL,WV,BL,BL,WV,BL,BL,WV,BL,BL,WV,BL],
    [BL,WV,WV,BL,WV,WV,BL,WV,WV,BL,WV,WV,BL,WV,WV,BL,WV,WV,BL,WV,WV,BL,WV,WV,BL,WV,WV,BL],
  ]
})()

/** 公园凉亭（精细版 24x16）*/
export const PAVILION: SpriteData = (() => {
  const RC = '#CC4422', DD = '#8B2200', YL = '#FFDD88', GC = '#446644', WC = '#CCAA66'
  const RH = '#EE6644'  // 屋顶高光
  const _ = ''
  return [
    [_,  _,  _,  _,  _,  RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, RC, _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  RC, RC, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, RC, RC, RC, _,  _,  _,  _,  _],
    [_,  _,  _,  RC, DD, RH, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, RH, DD, RC, _,  _,  _,  _,  _],
    [_,  _,  RC, DD, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, YL, DD, RC, _,  _,  _,  _],
    [_,  RC, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, RC, _,  _,  _],
    [RC, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, DD, RC, _,  _],
    [WC, GC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, GC, WC, _,  _],
    [WC, GC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, GC, WC, _,  _],
    [WC, GC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, GC, WC, _,  _],
    [WC, GC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, GC, WC, _,  _],
    [WC, GC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, GC, WC, _,  _],
    [WC, GC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, GC, WC, _,  _],
    [WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, WC, _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
    [_,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _],
  ]
})()

// ── Scene Object Config ───────────────────────────────────────────
export interface SceneObject {
  sprite: SpriteData
  col: number
  row: number
  zY?: number
}

export interface SceneConfig {
  name: string
  cols: number
  rows: number
  tilemap: TileType[][]
  objects: SceneObject[]
  ambientColor: string
  lightColor: string
  walkableRowStart: number
}

export const SCENE_CONFIGS: Record<string, SceneConfig> = {
  '宝安城中村': {
    name: '宝安城中村',
    cols: 36, rows: 24,
    tilemap: VILLAGE_MAP,
    ambientColor: '#FF9F43',
    lightColor: '#FFAA55',
    walkableRowStart: 14,
    objects: [
      // 第一排握手楼（row 0）- 5栋，每7列一栋
      { sprite: VILLAGE_BUILDING, col: 0, row: 0 },
      { sprite: VILLAGE_BUILDING, col: 7, row: 0 },
      { sprite: VILLAGE_BUILDING, col: 14, row: 0 },
      { sprite: VILLAGE_BUILDING, col: 21, row: 0 },
      { sprite: VILLAGE_BUILDING, col: 28, row: 0 },
      // 第二排握手楼（row 8）- 4栋，错开排列
      { sprite: VILLAGE_BUILDING, col: 3, row: 8 },
      { sprite: VILLAGE_BUILDING, col: 10, row: 8 },
      { sprite: VILLAGE_BUILDING, col: 17, row: 8 },
      { sprite: VILLAGE_BUILDING, col: 24, row: 8 },
      // 小巷树木（row 6）
      { sprite: STREET_TREE, col: 1, row: 6 },
      { sprite: STREET_TREE, col: 5, row: 6 },
      { sprite: STREET_TREE, col: 12, row: 6 },
      { sprite: STREET_TREE, col: 19, row: 6 },
      { sprite: STREET_TREE, col: 26, row: 6 },
      { sprite: STREET_TREE, col: 33, row: 6 },
      // 灌木丛（建筑前绿化）
      { sprite: BUSH_CLUSTER, col: 0, row: 12 },
      { sprite: BUSH_CLUSTER, col: 4, row: 12 },
      { sprite: BUSH_CLUSTER, col: 8, row: 12 },
      { sprite: BUSH_CLUSTER, col: 13, row: 12 },
      { sprite: BUSH_CLUSTER, col: 17, row: 12 },
      { sprite: BUSH_CLUSTER, col: 21, row: 12 },
      { sprite: BUSH_CLUSTER, col: 25, row: 12 },
      { sprite: BUSH_CLUSTER, col: 29, row: 12 },
      { sprite: BUSH_CLUSTER, col: 33, row: 12 },
      // 行道树（沿人行道密集排列）
      { sprite: STREET_TREE, col: 0, row: 13 },
      { sprite: STREET_TREE, col: 3, row: 13 },
      { sprite: STREET_TREE, col: 6, row: 13 },
      { sprite: STREET_TREE, col: 9, row: 13 },
      { sprite: STREET_TREE, col: 12, row: 13 },
      { sprite: STREET_TREE, col: 15, row: 13 },
      { sprite: STREET_TREE, col: 18, row: 13 },
      { sprite: STREET_TREE, col: 21, row: 13 },
      { sprite: STREET_TREE, col: 24, row: 13 },
      { sprite: STREET_TREE, col: 27, row: 13 },
      { sprite: STREET_TREE, col: 30, row: 13 },
      { sprite: STREET_TREE, col: 33, row: 13 },
      // 对面行道树
      { sprite: STREET_TREE, col: 1, row: 20 },
      { sprite: STREET_TREE, col: 5, row: 20 },
      { sprite: STREET_TREE, col: 9, row: 20 },
      { sprite: STREET_TREE, col: 13, row: 20 },
      { sprite: STREET_TREE, col: 17, row: 20 },
      { sprite: STREET_TREE, col: 21, row: 20 },
      { sprite: STREET_TREE, col: 25, row: 20 },
      { sprite: STREET_TREE, col: 29, row: 20 },
      { sprite: STREET_TREE, col: 33, row: 20 },
      // 路灯
      { sprite: STREET_LAMP, col: 4, row: 14 },
      { sprite: STREET_LAMP, col: 12, row: 14 },
      { sprite: STREET_LAMP, col: 20, row: 14 },
      { sprite: STREET_LAMP, col: 28, row: 14 },
      // 便利店
      { sprite: CONVENIENCE_STORE, col: 5, row: 15 },
      { sprite: CONVENIENCE_STORE, col: 18, row: 15 },
      { sprite: CONVENIENCE_STORE, col: 30, row: 15 },
      // 停放车辆（多排）
      { sprite: PARKED_CAR_WHITE, col: 1, row: 16 },
      { sprite: PARKED_CAR_WHITE, col: 9, row: 16 },
      { sprite: PARKED_CAR_WHITE, col: 17, row: 16 },
      { sprite: PARKED_CAR_WHITE, col: 25, row: 16 },
      { sprite: PARKED_CAR_WHITE, col: 33, row: 16 },
      { sprite: PARKED_CAR_DARK, col: 5, row: 17 },
      { sprite: PARKED_CAR_DARK, col: 13, row: 17 },
      { sprite: PARKED_CAR_DARK, col: 21, row: 17 },
      { sprite: PARKED_CAR_DARK, col: 29, row: 17 },
      // 垃圾桶
      { sprite: TRASH_BIN, col: 7, row: 14 },
      { sprite: TRASH_BIN, col: 15, row: 14 },
      { sprite: TRASH_BIN, col: 23, row: 14 },
      { sprite: TRASH_BIN, col: 31, row: 14 },
    ],
  },

  '南山科技园': {
    name: '南山科技园',
    cols: 36, rows: 24,
    tilemap: TECH_MAP,
    ambientColor: '#4D96FF',
    lightColor: '#88BBFF',
    walkableRowStart: 12,
    objects: [
      // 第一排写字楼（row 0）- 4栋
      { sprite: OFFICE_TOWER, col: 0, row: 0 },
      { sprite: OFFICE_TOWER, col: 9, row: 0 },
      { sprite: OFFICE_TOWER, col: 18, row: 0 },
      { sprite: OFFICE_TOWER, col: 27, row: 0 },
      // 广场大树（row 8）
      { sprite: PARK_TREE, col: 0, row: 8 },
      { sprite: PARK_TREE, col: 4, row: 8 },
      { sprite: PARK_TREE, col: 8, row: 8 },
      { sprite: PARK_TREE, col: 12, row: 8 },
      { sprite: PARK_TREE, col: 16, row: 8 },
      { sprite: PARK_TREE, col: 20, row: 8 },
      { sprite: PARK_TREE, col: 24, row: 8 },
      { sprite: PARK_TREE, col: 28, row: 8 },
      { sprite: PARK_TREE, col: 32, row: 8 },
      // 广场灌木（row 9）
      { sprite: BUSH_CLUSTER, col: 2, row: 9 },
      { sprite: BUSH_CLUSTER, col: 8, row: 9 },
      { sprite: BUSH_CLUSTER, col: 14, row: 9 },
      { sprite: BUSH_CLUSTER, col: 20, row: 9 },
      { sprite: BUSH_CLUSTER, col: 26, row: 9 },
      { sprite: BUSH_CLUSTER, col: 32, row: 9 },
      // 人行道行道树（双排）
      { sprite: STREET_TREE, col: 0, row: 10 },
      { sprite: STREET_TREE, col: 4, row: 10 },
      { sprite: STREET_TREE, col: 8, row: 10 },
      { sprite: STREET_TREE, col: 12, row: 10 },
      { sprite: STREET_TREE, col: 16, row: 10 },
      { sprite: STREET_TREE, col: 20, row: 10 },
      { sprite: STREET_TREE, col: 24, row: 10 },
      { sprite: STREET_TREE, col: 28, row: 10 },
      { sprite: STREET_TREE, col: 32, row: 10 },
      { sprite: STREET_TREE, col: 2, row: 11 },
      { sprite: STREET_TREE, col: 6, row: 11 },
      { sprite: STREET_TREE, col: 10, row: 11 },
      { sprite: STREET_TREE, col: 14, row: 11 },
      { sprite: STREET_TREE, col: 18, row: 11 },
      { sprite: STREET_TREE, col: 22, row: 11 },
      { sprite: STREET_TREE, col: 26, row: 11 },
      { sprite: STREET_TREE, col: 30, row: 11 },
      { sprite: STREET_TREE, col: 34, row: 11 },
      // 地铁站
      { sprite: METRO_ENTRANCE, col: 5, row: 17 },
      { sprite: METRO_ENTRANCE, col: 22, row: 17 },
      // 路灯
      { sprite: STREET_LAMP, col: 3, row: 12 },
      { sprite: STREET_LAMP, col: 11, row: 12 },
      { sprite: STREET_LAMP, col: 19, row: 12 },
      { sprite: STREET_LAMP, col: 27, row: 12 },
      // 停放车辆（多排）
      { sprite: PARKED_CAR_WHITE, col: 0, row: 14 },
      { sprite: PARKED_CAR_WHITE, col: 8, row: 14 },
      { sprite: PARKED_CAR_WHITE, col: 16, row: 14 },
      { sprite: PARKED_CAR_WHITE, col: 24, row: 14 },
      { sprite: PARKED_CAR_WHITE, col: 32, row: 14 },
      { sprite: PARKED_CAR_DARK, col: 4, row: 15 },
      { sprite: PARKED_CAR_DARK, col: 12, row: 15 },
      { sprite: PARKED_CAR_DARK, col: 20, row: 15 },
      { sprite: PARKED_CAR_DARK, col: 28, row: 15 },
    ],
  },

  '福田CBD': {
    name: '福田CBD',
    cols: 36, rows: 24,
    tilemap: CBD_MAP,
    ambientColor: '#C77DFF',
    lightColor: '#DD99FF',
    walkableRowStart: 12,
    objects: [
      // 第一排高楼（row 0）- 5栋
      { sprite: OFFICE_TOWER, col: 0, row: 0 },
      { sprite: OFFICE_TOWER, col: 7, row: 0 },
      { sprite: OFFICE_TOWER, col: 14, row: 0 },
      { sprite: OFFICE_TOWER, col: 21, row: 0 },
      { sprite: OFFICE_TOWER, col: 28, row: 0 },
      // 广场树木（row 8）
      { sprite: STREET_TREE, col: 0, row: 8 },
      { sprite: STREET_TREE, col: 3, row: 8 },
      { sprite: STREET_TREE, col: 6, row: 8 },
      { sprite: STREET_TREE, col: 9, row: 8 },
      { sprite: STREET_TREE, col: 12, row: 8 },
      { sprite: STREET_TREE, col: 15, row: 8 },
      { sprite: STREET_TREE, col: 18, row: 8 },
      { sprite: STREET_TREE, col: 21, row: 8 },
      { sprite: STREET_TREE, col: 24, row: 8 },
      { sprite: STREET_TREE, col: 27, row: 8 },
      { sprite: STREET_TREE, col: 30, row: 8 },
      { sprite: STREET_TREE, col: 33, row: 8 },
      // 绿化带（双排）
      { sprite: BUSH_CLUSTER, col: 0, row: 9 },
      { sprite: BUSH_CLUSTER, col: 5, row: 9 },
      { sprite: BUSH_CLUSTER, col: 10, row: 9 },
      { sprite: BUSH_CLUSTER, col: 15, row: 9 },
      { sprite: BUSH_CLUSTER, col: 20, row: 9 },
      { sprite: BUSH_CLUSTER, col: 25, row: 9 },
      { sprite: BUSH_CLUSTER, col: 30, row: 9 },
      { sprite: BUSH_CLUSTER, col: 2, row: 10 },
      { sprite: BUSH_CLUSTER, col: 7, row: 10 },
      { sprite: BUSH_CLUSTER, col: 12, row: 10 },
      { sprite: BUSH_CLUSTER, col: 17, row: 10 },
      { sprite: BUSH_CLUSTER, col: 22, row: 10 },
      { sprite: BUSH_CLUSTER, col: 27, row: 10 },
      { sprite: BUSH_CLUSTER, col: 32, row: 10 },
      // 地铁站
      { sprite: METRO_ENTRANCE, col: 3, row: 18 },
      { sprite: METRO_ENTRANCE, col: 20, row: 18 },
      // 路灯
      { sprite: STREET_LAMP, col: 6, row: 12 },
      { sprite: STREET_LAMP, col: 14, row: 12 },
      { sprite: STREET_LAMP, col: 22, row: 12 },
      { sprite: STREET_LAMP, col: 30, row: 12 },
      // 停放车辆
      { sprite: PARKED_CAR_DARK, col: 0, row: 15 },
      { sprite: PARKED_CAR_DARK, col: 9, row: 15 },
      { sprite: PARKED_CAR_DARK, col: 18, row: 15 },
      { sprite: PARKED_CAR_DARK, col: 27, row: 15 },
      { sprite: PARKED_CAR_WHITE, col: 4, row: 16 },
      { sprite: PARKED_CAR_WHITE, col: 13, row: 16 },
      { sprite: PARKED_CAR_WHITE, col: 22, row: 16 },
      { sprite: PARKED_CAR_WHITE, col: 31, row: 16 },
    ],
  },

  '华强北': {
    name: '华强北',
    cols: 36, rows: 24,
    tilemap: HUAQIANG_MAP,
    ambientColor: '#00F5FF',
    lightColor: '#44FFFF',
    walkableRowStart: 11,
    objects: [
      // 第一排商场（row 0）- 4栋
      { sprite: OFFICE_TOWER, col: 0, row: 0 },
      { sprite: OFFICE_TOWER, col: 9, row: 0 },
      { sprite: OFFICE_TOWER, col: 18, row: 0 },
      { sprite: OFFICE_TOWER, col: 27, row: 0 },
      // 华强北招牌（横跨）
      { sprite: HUAQIANG_SIGN, col: 0, row: 6 },
      // 人行道行道树
      { sprite: STREET_TREE, col: 1, row: 11 },
      { sprite: STREET_TREE, col: 5, row: 11 },
      { sprite: STREET_TREE, col: 9, row: 11 },
      { sprite: STREET_TREE, col: 13, row: 11 },
      { sprite: STREET_TREE, col: 17, row: 11 },
      { sprite: STREET_TREE, col: 21, row: 11 },
      { sprite: STREET_TREE, col: 25, row: 11 },
      { sprite: STREET_TREE, col: 29, row: 11 },
      { sprite: STREET_TREE, col: 33, row: 11 },
      // 路灯
      { sprite: STREET_LAMP, col: 3, row: 12 },
      { sprite: STREET_LAMP, col: 11, row: 12 },
      { sprite: STREET_LAMP, col: 19, row: 12 },
      { sprite: STREET_LAMP, col: 27, row: 12 },
      // 便利店（多家）
      { sprite: CONVENIENCE_STORE, col: 6, row: 18 },
      { sprite: CONVENIENCE_STORE, col: 16, row: 18 },
      { sprite: CONVENIENCE_STORE, col: 26, row: 18 },
      // 停放车辆
      { sprite: PARKED_CAR_WHITE, col: 0, row: 13 },
      { sprite: PARKED_CAR_WHITE, col: 10, row: 13 },
      { sprite: PARKED_CAR_WHITE, col: 20, row: 13 },
      { sprite: PARKED_CAR_WHITE, col: 30, row: 13 },
      { sprite: PARKED_CAR_DARK, col: 5, row: 14 },
      { sprite: PARKED_CAR_DARK, col: 15, row: 14 },
      { sprite: PARKED_CAR_DARK, col: 25, row: 14 },
      // 垃圾桶
      { sprite: TRASH_BIN, col: 8, row: 11 },
      { sprite: TRASH_BIN, col: 20, row: 11 },
      { sprite: TRASH_BIN, col: 32, row: 11 },
    ],
  },

  '东门老街': {
    name: '东门老街',
    cols: 36, rows: 24,
    tilemap: DONGMEN_MAP,
    ambientColor: '#FF6B6B',
    lightColor: '#FF8888',
    walkableRowStart: 10,
    objects: [
      // 第一排老街建筑（row 0）- 4栋
      { sprite: VILLAGE_BUILDING, col: 0, row: 0 },
      { sprite: VILLAGE_BUILDING, col: 9, row: 0 },
      { sprite: VILLAGE_BUILDING, col: 18, row: 0 },
      { sprite: VILLAGE_BUILDING, col: 27, row: 0 },
      // 红灯笼串（密集悬挂，row 5）
      { sprite: RED_LANTERN, col: 3, row: 5 },
      { sprite: RED_LANTERN, col: 6, row: 5 },
      { sprite: RED_LANTERN, col: 9, row: 5 },
      { sprite: RED_LANTERN, col: 12, row: 5 },
      { sprite: RED_LANTERN, col: 15, row: 5 },
      { sprite: RED_LANTERN, col: 18, row: 5 },
      { sprite: RED_LANTERN, col: 21, row: 5 },
      { sprite: RED_LANTERN, col: 24, row: 5 },
      { sprite: RED_LANTERN, col: 27, row: 5 },
      { sprite: RED_LANTERN, col: 30, row: 5 },
      { sprite: RED_LANTERN, col: 33, row: 5 },
      // 老树（大型）
      { sprite: PARK_TREE, col: 1, row: 7 },
      { sprite: PARK_TREE, col: 10, row: 7 },
      { sprite: PARK_TREE, col: 20, row: 7 },
      { sprite: PARK_TREE, col: 30, row: 7 },
      // 行道树
      { sprite: STREET_TREE, col: 0, row: 9 },
      { sprite: STREET_TREE, col: 4, row: 9 },
      { sprite: STREET_TREE, col: 8, row: 9 },
      { sprite: STREET_TREE, col: 12, row: 9 },
      { sprite: STREET_TREE, col: 16, row: 9 },
      { sprite: STREET_TREE, col: 20, row: 9 },
      { sprite: STREET_TREE, col: 24, row: 9 },
      { sprite: STREET_TREE, col: 28, row: 9 },
      { sprite: STREET_TREE, col: 32, row: 9 },
      // 路灯
      { sprite: STREET_LAMP, col: 6, row: 12 },
      { sprite: STREET_LAMP, col: 18, row: 12 },
      { sprite: STREET_LAMP, col: 30, row: 12 },
      // 便利店
      { sprite: CONVENIENCE_STORE, col: 3, row: 17 },
      { sprite: CONVENIENCE_STORE, col: 20, row: 17 },
      // 停放车辆
      { sprite: PARKED_CAR_WHITE, col: 1, row: 13 },
      { sprite: PARKED_CAR_WHITE, col: 14, row: 13 },
      { sprite: PARKED_CAR_WHITE, col: 27, row: 13 },
      { sprite: PARKED_CAR_DARK, col: 7, row: 14 },
      { sprite: PARKED_CAR_DARK, col: 21, row: 14 },
      // 垃圾桶
      { sprite: TRASH_BIN, col: 10, row: 10 },
      { sprite: TRASH_BIN, col: 24, row: 10 },
    ],
  },

  '南山公寓': {
    name: '南山公寓',
    cols: 36, rows: 24,
    tilemap: APARTMENT_MAP,
    ambientColor: '#6BCB77',
    lightColor: '#88DD88',
    walkableRowStart: 11,
    objects: [
      // 第一排公寓楼（row 0）- 4栋
      { sprite: VILLAGE_BUILDING, col: 0, row: 0 },
      { sprite: VILLAGE_BUILDING, col: 9, row: 0 },
      { sprite: VILLAGE_BUILDING, col: 18, row: 0 },
      { sprite: VILLAGE_BUILDING, col: 27, row: 0 },
      // 小区绿化（密集灌木，双排）
      { sprite: BUSH_CLUSTER, col: 0, row: 8 },
      { sprite: BUSH_CLUSTER, col: 3, row: 8 },
      { sprite: BUSH_CLUSTER, col: 6, row: 8 },
      { sprite: BUSH_CLUSTER, col: 9, row: 8 },
      { sprite: BUSH_CLUSTER, col: 12, row: 8 },
      { sprite: BUSH_CLUSTER, col: 15, row: 8 },
      { sprite: BUSH_CLUSTER, col: 18, row: 8 },
      { sprite: BUSH_CLUSTER, col: 21, row: 8 },
      { sprite: BUSH_CLUSTER, col: 24, row: 8 },
      { sprite: BUSH_CLUSTER, col: 27, row: 8 },
      { sprite: BUSH_CLUSTER, col: 30, row: 8 },
      { sprite: BUSH_CLUSTER, col: 33, row: 8 },
      { sprite: BUSH_CLUSTER, col: 1, row: 9 },
      { sprite: BUSH_CLUSTER, col: 4, row: 9 },
      { sprite: BUSH_CLUSTER, col: 7, row: 9 },
      { sprite: BUSH_CLUSTER, col: 10, row: 9 },
      { sprite: BUSH_CLUSTER, col: 13, row: 9 },
      { sprite: BUSH_CLUSTER, col: 16, row: 9 },
      { sprite: BUSH_CLUSTER, col: 19, row: 9 },
      { sprite: BUSH_CLUSTER, col: 22, row: 9 },
      { sprite: BUSH_CLUSTER, col: 25, row: 9 },
      { sprite: BUSH_CLUSTER, col: 28, row: 9 },
      { sprite: BUSH_CLUSTER, col: 31, row: 9 },
      // 行道树
      { sprite: STREET_TREE, col: 1, row: 10 },
      { sprite: STREET_TREE, col: 6, row: 10 },
      { sprite: STREET_TREE, col: 11, row: 10 },
      { sprite: STREET_TREE, col: 16, row: 10 },
      { sprite: STREET_TREE, col: 21, row: 10 },
      { sprite: STREET_TREE, col: 26, row: 10 },
      { sprite: STREET_TREE, col: 31, row: 10 },
      // 路灯
      { sprite: STREET_LAMP, col: 8, row: 11 },
      { sprite: STREET_LAMP, col: 20, row: 11 },
      { sprite: STREET_LAMP, col: 32, row: 11 },
      // 停放车辆（小区停车场，多排）
      { sprite: PARKED_CAR_WHITE, col: 2, row: 13 },
      { sprite: PARKED_CAR_WHITE, col: 8, row: 13 },
      { sprite: PARKED_CAR_WHITE, col: 14, row: 13 },
      { sprite: PARKED_CAR_WHITE, col: 20, row: 13 },
      { sprite: PARKED_CAR_WHITE, col: 26, row: 13 },
      { sprite: PARKED_CAR_WHITE, col: 32, row: 13 },
      { sprite: PARKED_CAR_DARK, col: 5, row: 14 },
      { sprite: PARKED_CAR_DARK, col: 11, row: 14 },
      { sprite: PARKED_CAR_DARK, col: 17, row: 14 },
      { sprite: PARKED_CAR_DARK, col: 23, row: 14 },
      { sprite: PARKED_CAR_DARK, col: 29, row: 14 },
    ],
  },

  '深圳湾公园': {
    name: '深圳湾公园',
    cols: 36, rows: 24,
    tilemap: PARK_MAP,
    ambientColor: '#4ECDC4',
    lightColor: '#88FFEE',
    walkableRowStart: 7,
    objects: [
      // 公园大树（密集分布，多排）
      { sprite: PARK_TREE, col: 0, row: 0 },
      { sprite: PARK_TREE, col: 4, row: 0 },
      { sprite: PARK_TREE, col: 8, row: 0 },
      { sprite: PARK_TREE, col: 12, row: 0 },
      { sprite: PARK_TREE, col: 16, row: 0 },
      { sprite: PARK_TREE, col: 20, row: 0 },
      { sprite: PARK_TREE, col: 24, row: 0 },
      { sprite: PARK_TREE, col: 28, row: 0 },
      { sprite: PARK_TREE, col: 32, row: 0 },
      { sprite: PARK_TREE, col: 2, row: 2 },
      { sprite: PARK_TREE, col: 6, row: 2 },
      { sprite: PARK_TREE, col: 10, row: 2 },
      { sprite: PARK_TREE, col: 14, row: 2 },
      { sprite: PARK_TREE, col: 18, row: 2 },
      { sprite: PARK_TREE, col: 22, row: 2 },
      { sprite: PARK_TREE, col: 26, row: 2 },
      { sprite: PARK_TREE, col: 30, row: 2 },
      { sprite: PARK_TREE, col: 34, row: 2 },
      { sprite: PARK_TREE, col: 0, row: 4 },
      { sprite: PARK_TREE, col: 5, row: 4 },
      { sprite: PARK_TREE, col: 10, row: 4 },
      { sprite: PARK_TREE, col: 15, row: 4 },
      { sprite: PARK_TREE, col: 20, row: 4 },
      { sprite: PARK_TREE, col: 25, row: 4 },
      { sprite: PARK_TREE, col: 30, row: 4 },
      // 凉亭
      { sprite: PAVILION, col: 5, row: 1 },
      { sprite: PAVILION, col: 22, row: 1 },
      // 栈道
      { sprite: BOARDWALK, col: 0, row: 9 },
      { sprite: BOARDWALK, col: 8, row: 9 },
      { sprite: BOARDWALK, col: 16, row: 9 },
      { sprite: BOARDWALK, col: 24, row: 9 },
      // 公园小树（栈道旁）
      { sprite: STREET_TREE, col: 1, row: 6 },
      { sprite: STREET_TREE, col: 5, row: 6 },
      { sprite: STREET_TREE, col: 9, row: 6 },
      { sprite: STREET_TREE, col: 13, row: 6 },
      { sprite: STREET_TREE, col: 17, row: 6 },
      { sprite: STREET_TREE, col: 21, row: 6 },
      { sprite: STREET_TREE, col: 25, row: 6 },
      { sprite: STREET_TREE, col: 29, row: 6 },
      { sprite: STREET_TREE, col: 33, row: 6 },
      // 灌木丛
      { sprite: BUSH_CLUSTER, col: 0, row: 7 },
      { sprite: BUSH_CLUSTER, col: 5, row: 7 },
      { sprite: BUSH_CLUSTER, col: 10, row: 7 },
      { sprite: BUSH_CLUSTER, col: 15, row: 7 },
      { sprite: BUSH_CLUSTER, col: 20, row: 7 },
      { sprite: BUSH_CLUSTER, col: 25, row: 7 },
      { sprite: BUSH_CLUSTER, col: 30, row: 7 },
    ],
  },
}
