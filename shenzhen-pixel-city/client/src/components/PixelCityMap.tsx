/**
 * PixelCityMap - 深圳像素城市场景视图
 *
 * 渲染层次（从下到上）：
 * 1. 背景层：场景设计图 v3/v4（建筑、树木、地面）
 * 2. 可动元素层：车辆/船只精灵（vehicles_sheet_v3.png + boats_sheet_v1.png）
 * 3. Bot角色层：人物精灵（chars_sheet1_v3.png + chars_sheet2_v3.png）
 * 4. UI层：名字标签、情绪气泡、选中圆圈
 *
 * 大地图：地图尺寸为视口2倍，可拖拽平移，随Bot数量自动扩展可步行区域
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import type { WorldState } from '@/types/world'
import { BOT_COLORS, getEmotionColor, getDominantEmotion } from '@/types/world'

// -- Scene background images (v3/v4) -----------------------------------------
const SCENE_IMAGES: Record<string, string> = {
  '宝安城中村':  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/fWtEeqJMAogpXcrN.png',
  '南山科技园':  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/MihADuOxUvykEJgc.png',
  '福田CBD':     'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/sfftTEBtWVjXOmIT.png',
  '华强北':      'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/BrqtmMxhZAWtRigQ.png',
  '东门老街':    'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/YYhKcQyDZenkNbfc.png',
  '南山公寓':    'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/lKAPArmBQhffMfqj.png',
  '深圳湾公园':  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/NlazuSadnucdCoSQ.png',
}

// -- Character sprite sheets (v3) ---------------------------------------------
// chars_sheet1_v3.png: 外卖骑手、程序员、城中村大叔、华强北商人、白领 (rows 0-4)
// chars_sheet2_v3.png: 创业者、深漂青年、广场舞大妈、保安、跑步者 (rows 0-4)
const CHARS_SHEET1_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/JmCkfFouADOEIqwG.png'
const CHARS_SHEET2_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/SxMwWXfCkAgUKHpi.png'

// -- Vehicle spritesheet (v3) --------------------------------------------------
// vehicles_sheet_v3.png: top-down pixel art vehicles
// Layout: 8 cols x 6 rows, each cell 64x64
// Cols 0-3: facing right (frames 0-3), Cols 4-7: facing left (mirrored)
// Row 0: shared_bike (共享单车), Row 1: meituan_bike (美团外卖), Row 2: sweeper (扫地车)
// Row 3: taxi (蓝白BYD出租), Row 4: huolala (货拉拉), Row 5: bus (绿色公交)
const VEHICLE_SHEET_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/IiYRsyyzNfnvnLXV.png'

// -- Boat spritesheet (v1) -----------------------------------------------------
// boats_sheet_v1.png: top-down pixel art boats for Shenzhen Bay
// Layout: 4 cols x 3 rows, each cell ~120x80
// Row 0: fishing_boat (渔船), Row 1: cruise (观光游轮), Row 2: speedboat (快艇)
const BOAT_SHEET_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/PCdoQWwaXPLDGmXZ.png'

// Vehicle animation frame count for cycling
const V_ANIM_FRAMES = 4

// Boat cell dimensions (boats_sheet_v1.png is 2752x1536, 4 cols x 3 rows)
const B_CELL_W = Math.round(2752 / 4)  // 688
const B_CELL_H = Math.round(1536 / 3)  // 512

// -- Precise frame coordinates for vehicles_sheet_v3.png (2752x1536) ---------
// 2 rows x 768px each; each entry has sy (row start), sh (row height = content height)
// Each entry: [x_start, x_end] for each frame
const VEHICLE_FRAMES: Record<string, { right: [number,number][], left: [number,number][], sy: number, sh: number }> = {
  taxi: {
    sy: 17, sh: 751,
    right: [[70,275],[414,619],[762,967],[1107,1312]],
    left:  [[2145,2344],[2484,2682],[2145,2344],[2484,2682]],
  },
  huolala: {
    sy: 40, sh: 728,
    right: [[1393,1725]],
    left:  [[1725,2058]],
  },
  meituan: {
    sy: 307, sh: 614,
    right: [[1422,1655],[1777,2004],[1422,1655],[1777,2004]],
    left:  [[2156,2333],[2494,2672],[2156,2333],[2494,2672]],
  },
  sweeper: {
    sy: 614, sh: 614,
    right: [[41,304],[384,648],[728,991],[1083,1336]],
    left:  [[1424,1691],[1773,2040],[2191,2298],[2530,2637]],
  },
  shared_bike: {
    sy: 921, sh: 614,
    right: [[51,292],[396,636],[741,980],[1160,1266]],
    left:  [[1439,1680],[1784,2024],[2190,2298],[2529,2637]],
  },
  bus: {
    sy: 1228, sh: 308,
    right: [[29,1364]],
    left:  [[1794,2023]],
  },
}

type VehicleType = 'shared_bike' | 'meituan' | 'sweeper' | 'taxi' | 'huolala' | 'bus' | 'fishing_boat' | 'cruise' | 'speedboat'

interface VehicleConfig {
  scale: number
  speed: number       // normalized units per second
  frameRate: number   // frames per second
  zOffset: number     // z-sort offset relative to y
  isBoat?: boolean    // use boat spritesheet
  boatRow?: number    // row in boat spritesheet
  cellW?: number
  cellH?: number
}

const VEHICLE_CONFIGS: Record<VehicleType, VehicleConfig> = {
  shared_bike:  { scale: 0.10, speed: 0.05, frameRate: 8,  zOffset: 0 },  // sh=614 -> ~62px
  meituan:      { scale: 0.11, speed: 0.09, frameRate: 10, zOffset: 0 },  // sh=614 -> ~68px
  sweeper:      { scale: 0.13, speed: 0.04, frameRate: 6,  zOffset: 0 },  // sh=614 -> ~80px
  taxi:         { scale: 0.12, speed: 0.09, frameRate: 8,  zOffset: 0 },  // sh=751 -> ~90px
  huolala:      { scale: 0.15, speed: 0.07, frameRate: 8,  zOffset: 0 },  // sh=728 -> ~109px
  bus:          { scale: 0.32, speed: 0.05, frameRate: 6,  zOffset: 0 },  // sh=308 -> ~99px
  fishing_boat: { scale: 0.10, speed: 0.025, frameRate: 4, zOffset: 0, isBoat: true, boatRow: 0, cellW: B_CELL_W, cellH: B_CELL_H },
  cruise:       { scale: 0.12, speed: 0.035, frameRate: 4, zOffset: 0, isBoat: true, boatRow: 1, cellW: B_CELL_W, cellH: B_CELL_H },
  speedboat:    { scale: 0.08, speed: 0.055, frameRate: 6, zOffset: 0, isBoat: true, boatRow: 2, cellW: B_CELL_W, cellH: B_CELL_H },
}

// -- Vehicle road lanes per scene ------------------------------------------
interface VehicleLane {
  type: VehicleType
  y: number       // normalized y position of lane center
  xMin: number    // patrol range
  xMax: number
  dir: 1 | -1
}

const SCENE_VEHICLE_LANES: Record<string, VehicleLane[]> = {
  '宝安城中村': [
    { type: 'shared_bike', y: 0.35, xMin: 0.05, xMax: 0.90, dir: 1 },
    { type: 'shared_bike', y: 0.62, xMin: 0.05, xMax: 0.90, dir: -1 },
    { type: 'meituan',     y: 0.35, xMin: 0.05, xMax: 0.90, dir: -1 },
    { type: 'meituan',     y: 0.62, xMin: 0.05, xMax: 0.90, dir: 1 },
    { type: 'shared_bike', y: 0.50, xMin: 0.10, xMax: 0.50, dir: 1 },
    { type: 'shared_bike', y: 0.50, xMin: 0.50, xMax: 0.90, dir: -1 },
    { type: 'sweeper',     y: 0.78, xMin: 0.05, xMax: 0.95, dir: 1 },
  ],
  '南山科技园': [
    { type: 'shared_bike', y: 0.55, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'shared_bike', y: 0.75, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'meituan',     y: 0.55, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'taxi',        y: 0.80, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'taxi',        y: 0.80, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'bus',         y: 0.85, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'sweeper',     y: 0.88, xMin: 0.05, xMax: 0.95, dir: -1 },
  ],
  '福田CBD': [
    { type: 'taxi',        y: 0.55, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'taxi',        y: 0.60, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'huolala',     y: 0.65, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'taxi',        y: 0.70, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'bus',         y: 0.75, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'meituan',     y: 0.55, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'shared_bike', y: 0.80, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'sweeper',     y: 0.82, xMin: 0.05, xMax: 0.95, dir: 1 },
  ],
  '华强北': [
    { type: 'meituan',     y: 0.30, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'meituan',     y: 0.30, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'shared_bike', y: 0.50, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'shared_bike', y: 0.50, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'meituan',     y: 0.70, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'taxi',        y: 0.85, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'sweeper',     y: 0.88, xMin: 0.05, xMax: 0.95, dir: 1 },
  ],
  '东门老街': [
    { type: 'shared_bike', y: 0.30, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'shared_bike', y: 0.55, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'meituan',     y: 0.30, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'shared_bike', y: 0.75, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'meituan',     y: 0.75, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'sweeper',     y: 0.80, xMin: 0.05, xMax: 0.95, dir: 1 },
  ],
  '南山公寓': [
    { type: 'taxi',        y: 0.50, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'taxi',        y: 0.55, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'shared_bike', y: 0.60, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'meituan',     y: 0.75, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'taxi',        y: 0.75, xMin: 0.05, xMax: 0.95, dir: 1 },
    { type: 'bus',         y: 0.80, xMin: 0.05, xMax: 0.95, dir: -1 },
    { type: 'sweeper',     y: 0.83, xMin: 0.05, xMax: 0.95, dir: 1 },
  ],
  '深圳湾公园': [
    { type: 'shared_bike', y: 0.32, xMin: 0.02, xMax: 0.98, dir: 1 },
    { type: 'shared_bike', y: 0.32, xMin: 0.02, xMax: 0.98, dir: -1 },
    { type: 'shared_bike', y: 0.36, xMin: 0.02, xMax: 0.98, dir: 1 },
    { type: 'meituan',     y: 0.38, xMin: 0.02, xMax: 0.98, dir: -1 },
    { type: 'sweeper',     y: 0.40, xMin: 0.02, xMax: 0.98, dir: 1 },
    { type: 'fishing_boat', y: 0.68, xMin: 0.02, xMax: 0.98, dir: 1 },
    { type: 'cruise',       y: 0.75, xMin: 0.02, xMax: 0.98, dir: -1 },
    { type: 'speedboat',    y: 0.82, xMin: 0.02, xMax: 0.98, dir: 1 },
    { type: 'fishing_boat', y: 0.88, xMin: 0.02, xMax: 0.98, dir: -1 },
  ],
}

// -- Vehicle instance state ------------------------------------------------
interface VehicleState {
  id: string
  type: VehicleType
  lane: VehicleLane
  x: number         // normalized x
  y: number         // normalized y (from lane)
  dir: 1 | -1
  frame: number
  frameTimer: number
}// -- Character spritesheet configuration -------------------------------------------
// v3 sheets: precise frame coordinates extracted from actual sprite images
// chars_sheet1_v3.png: 2752x1536, 3 rows x 512px each
// chars_sheet2_v3.png: 2752x1536, 4 rows x 384px each

// Precise frame x-coordinates for each character row
// Format: [[x0,x1], [x0,x1], ...] for each animation frame
const CHAR_FRAME_COORDS: Record<string, { sheet: 1|2; rowY: number; rowH: number; frames: [number,number][] }> = {
  // chars_sheet1_v3.png: rowH = actual content height (424px), not grid height (512px)
  '外卖骑手': { sheet: 1, rowY: 41,   rowH: 424, frames: [[68,270],[426,619],[734,957],[1102,1324],[68,270],[426,619]] },
  '程序员':   { sheet: 1, rowY: 41,   rowH: 424, frames: [[1457,1645],[1806,1989],[2133,2331],[2483,2676],[1457,1645],[1806,1989]] },
  '城中村大叔': { sheet: 1, rowY: 567, rowH: 419, frames: [[52,309],[420,607],[753,955],[1097,1294],[52,309],[420,607]] },
  '华强北商人': { sheet: 1, rowY: 567, rowH: 419, frames: [[1414,1678],[1754,2018],[2121,2350],[2472,2677],[1414,1678],[1754,2018]] },
  '白领':     { sheet: 1, rowY: 1083, rowH: 425, frames: [[75,268],[431,607],[757,950],[1095,1295],[75,268],[431,607]] },
  '跑步者':   { sheet: 1, rowY: 1083, rowH: 425, frames: [[1450,1634],[1806,1978],[2133,2321],[2478,2654],[1450,1634],[1806,1978]] },
  // chars_sheet2_v3.png: rowH = actual content height (~344-371px)
  '创业者':   { sheet: 2, rowY: 17,   rowH: 344, frames: [[63,213],[339,487],[614,762],[894,1036],[1439,1582],[1710,1858]] },
  '深漂青年': { sheet: 2, rowY: 401,  rowH: 344, frames: [[70,206],[344,482],[592,762],[866,1036],[1158,1329],[1439,1582]] },
  '广场舞大妈': { sheet: 2, rowY: 796, rowH: 356, frames: [[61,210],[336,486],[623,762],[892,1037],[1156,1298],[1441,1580]] },
  '保安':     { sheet: 2, rowY: 1152, rowH: 371, frames: [[63,213],[339,487],[614,762],[894,1036],[1439,1582],[1710,1858]] },
  // World-engine occupations: mapped to existing sprite rows (aliases)
  '金融人':   { sheet: 1, rowY: 567, rowH: 419, frames: [[1414,1678],[1754,2018],[2121,2350],[2472,2677],[1414,1678],[1754,2018]] }, // -> 华强北商人
  '工人':     { sheet: 1, rowY: 567, rowH: 419, frames: [[52,309],[420,607],[753,955],[1097,1294],[52,309],[420,607]] },            // -> 城中村大叔
  '设计师':   { sheet: 1, rowY: 41,   rowH: 424, frames: [[1457,1645],[1806,1989],[2133,2331],[2483,2676],[1457,1645],[1806,1989]] }, // -> 程序员
  '富二代':   { sheet: 1, rowY: 1083, rowH: 425, frames: [[75,268],[431,607],[757,950],[1095,1295],[75,268],[431,607]] },            // -> 白领
  '商人':     { sheet: 1, rowY: 567, rowH: 419, frames: [[1414,1678],[1754,2018],[2121,2350],[2472,2677],[1414,1678],[1754,2018]] }, // -> 华强北商人
  '餐馆老板': { sheet: 1, rowY: 567, rowH: 419, frames: [[52,309],[420,607],[753,955],[1097,1294],[52,309],[420,607]] },            // -> 城中村大叔
  '音乐人':   { sheet: 2, rowY: 401,  rowH: 344, frames: [[70,206],[344,482],[592,762],[866,1036],[1158,1329],[1439,1582]] },        // -> 深漂青年
  '网红':     { sheet: 2, rowY: 17,   rowH: 344, frames: [[63,213],[339,487],[614,762],[894,1036],[1439,1582],[1710,1858]] },        // -> 创业者
}

interface SpriteConfig {
  sheet: 1 | 2
  row: number
  frameCount: number
  scale: number
  offsetY: number
}

// scale calibrated so all chars render at ~100px tall:
//   sheet1 rowH~424px -> scale=0.236; sheet2 rowH~344px -> scale=0.290
// TARGET_CHAR_H = 65px for all characters (calibrated to match isometric building scale)
const TARGET_CHAR_H = 65
const SPRITE_CONFIGS: Record<string, SpriteConfig> = {
  // Sheet 1 characters
  '外卖骑手':   { sheet: 1, row: 0, frameCount: 6, scale: TARGET_CHAR_H / 424, offsetY: 0.85 },
  '程序员':     { sheet: 1, row: 0, frameCount: 6, scale: TARGET_CHAR_H / 424, offsetY: 0.90 },
  '城中村大叔': { sheet: 1, row: 1, frameCount: 6, scale: TARGET_CHAR_H / 419, offsetY: 0.90 },
  '华强北商人': { sheet: 1, row: 1, frameCount: 6, scale: TARGET_CHAR_H / 419, offsetY: 0.90 },
  '白领':       { sheet: 1, row: 2, frameCount: 6, scale: TARGET_CHAR_H / 425, offsetY: 0.90 },
  '跑步者':     { sheet: 1, row: 2, frameCount: 6, scale: TARGET_CHAR_H / 425, offsetY: 0.90 },
  // Sheet 2 characters
  '创业者':     { sheet: 2, row: 0, frameCount: 6, scale: TARGET_CHAR_H / 344, offsetY: 0.90 },
  '深漂青年':   { sheet: 2, row: 1, frameCount: 6, scale: TARGET_CHAR_H / 344, offsetY: 0.90 },
  '广场舞大妈': { sheet: 2, row: 2, frameCount: 6, scale: TARGET_CHAR_H / 356, offsetY: 0.90 },
  '保安':       { sheet: 2, row: 3, frameCount: 6, scale: TARGET_CHAR_H / 371, offsetY: 0.90 },
  // World-engine occupations mapped to existing sprites (ensures correct scale)
  '金融人':     { sheet: 1, row: 1, frameCount: 6, scale: TARGET_CHAR_H / 419, offsetY: 0.90 }, // -> 华强北商人
  '工人':       { sheet: 1, row: 1, frameCount: 6, scale: TARGET_CHAR_H / 419, offsetY: 0.90 }, // -> 城中村大叔
  '设计师':     { sheet: 1, row: 0, frameCount: 6, scale: TARGET_CHAR_H / 424, offsetY: 0.90 }, // -> 程序员
  '富二代':     { sheet: 1, row: 2, frameCount: 6, scale: TARGET_CHAR_H / 425, offsetY: 0.90 }, // -> 白领
  '商人':       { sheet: 1, row: 1, frameCount: 6, scale: TARGET_CHAR_H / 419, offsetY: 0.90 }, // -> 华强北商人
  '餐馆老板':   { sheet: 1, row: 1, frameCount: 6, scale: TARGET_CHAR_H / 419, offsetY: 0.90 }, // -> 城中村大叔
  '音乐人':     { sheet: 2, row: 1, frameCount: 6, scale: TARGET_CHAR_H / 344, offsetY: 0.90 }, // -> 深漂青年
  '网红':       { sheet: 2, row: 0, frameCount: 6, scale: TARGET_CHAR_H / 344, offsetY: 0.90 }, // -> 创业者
}

const FALLBACK_OCCUPATIONS = ['创业者', '白领', '深漂青年', '程序员', '保安', '华强北商人', '广场舞大妈', '城中村大叔', '跑步者', '外卖骑手']

const FALLBACK_CONFIGS: SpriteConfig[] = [
  { sheet: 2, row: 0, frameCount: 6, scale: TARGET_CHAR_H / 344, offsetY: 0.90 },
  { sheet: 1, row: 2, frameCount: 6, scale: TARGET_CHAR_H / 425, offsetY: 0.90 },
  { sheet: 2, row: 1, frameCount: 6, scale: TARGET_CHAR_H / 344, offsetY: 0.90 },
  { sheet: 1, row: 0, frameCount: 6, scale: TARGET_CHAR_H / 424, offsetY: 0.90 },
  { sheet: 2, row: 3, frameCount: 6, scale: TARGET_CHAR_H / 371, offsetY: 0.90 },
  { sheet: 1, row: 1, frameCount: 6, scale: TARGET_CHAR_H / 419, offsetY: 0.90 },
  { sheet: 2, row: 2, frameCount: 6, scale: TARGET_CHAR_H / 356, offsetY: 0.90 },
  { sheet: 1, row: 0, frameCount: 6, scale: TARGET_CHAR_H / 424, offsetY: 0.90 },
  { sheet: 1, row: 2, frameCount: 6, scale: TARGET_CHAR_H / 425, offsetY: 0.90 },
  { sheet: 1, row: 0, frameCount: 6, scale: TARGET_CHAR_H / 424, offsetY: 0.85 },
]

// -- Waypoint paths per scene (characters walk along these paths) ----------
// Each scene has multiple named paths; characters pick a random path and walk along it
const SCENE_WAYPOINTS: Record<string, Array<[number, number][]>> = {
  // Baoan urban village: narrow alleys
  '宝安城中村': [
    [[0.08,0.52],[0.25,0.48],[0.42,0.52],[0.58,0.48],[0.75,0.52],[0.88,0.48]],
    [[0.30,0.25],[0.32,0.38],[0.35,0.52],[0.33,0.65],[0.30,0.78]],
    [[0.60,0.25],[0.62,0.38],[0.65,0.52],[0.63,0.65],[0.60,0.78]],
    [[0.15,0.62],[0.30,0.60],[0.45,0.62],[0.60,0.60],[0.75,0.62]],
  ],
  // Nanshan tech park: sidewalks
  '南山科技园': [
    [[0.05,0.50],[0.20,0.42],[0.38,0.35],[0.55,0.28],[0.72,0.22],[0.88,0.16]],
    [[0.10,0.72],[0.25,0.65],[0.42,0.58],[0.58,0.52],[0.75,0.46]],
    [[0.30,0.35],[0.35,0.42],[0.42,0.48],[0.48,0.42],[0.42,0.35]],
  ],
  // Futian CBD: wide boulevards
  '福田CBD': [
    [[0.05,0.58],[0.18,0.50],[0.32,0.42],[0.48,0.35],[0.62,0.28],[0.78,0.22],[0.92,0.16]],
    [[0.05,0.75],[0.20,0.68],[0.35,0.62],[0.52,0.55],[0.68,0.48],[0.85,0.42]],
    [[0.15,0.55],[0.22,0.50],[0.30,0.45],[0.38,0.40],[0.45,0.35]],
  ],
  // Huaqiangbei: busy pedestrian street
  '华强北': [
    [[0.08,0.20],[0.10,0.32],[0.12,0.45],[0.14,0.58],[0.16,0.70],[0.14,0.82]],
    [[0.55,0.20],[0.57,0.32],[0.59,0.45],[0.61,0.58],[0.63,0.70],[0.61,0.82]],
    [[0.10,0.82],[0.25,0.80],[0.40,0.82],[0.55,0.80],[0.70,0.82],[0.85,0.80]],
    [[0.12,0.35],[0.20,0.38],[0.30,0.35],[0.38,0.38],[0.45,0.35]],
  ],
  // Dongmen old street
  '东门老街': [
    [[0.08,0.28],[0.22,0.25],[0.38,0.22],[0.55,0.25],[0.70,0.22],[0.85,0.25]],
    [[0.15,0.42],[0.18,0.55],[0.22,0.68],[0.20,0.80]],
    [[0.50,0.42],[0.52,0.55],[0.55,0.68],[0.52,0.80]],
    [[0.08,0.78],[0.25,0.75],[0.42,0.78],[0.60,0.75],[0.78,0.78]],
  ],
  // Nanshan apartments
  '南山公寓': [
    [[0.10,0.45],[0.25,0.42],[0.40,0.45],[0.55,0.42],[0.70,0.45]],
    [[0.62,0.55],[0.68,0.62],[0.72,0.70],[0.68,0.78]],
    [[0.08,0.72],[0.25,0.70],[0.42,0.72],[0.60,0.70],[0.78,0.72]],
  ],
  // Shenzhen Bay Park: waterfront promenade
  '深圳湾公园': [
    [[0.02,0.26],[0.20,0.25],[0.38,0.26],[0.55,0.25],[0.72,0.26],[0.90,0.25]],
    [[0.05,0.34],[0.20,0.33],[0.38,0.34],[0.55,0.33],[0.72,0.34],[0.88,0.33]],
    [[0.05,0.08],[0.15,0.12],[0.25,0.08],[0.35,0.12],[0.25,0.18],[0.15,0.14]],
    [[0.60,0.05],[0.70,0.10],[0.80,0.05],[0.90,0.10],[0.85,0.18],[0.70,0.14]],
  ],
}

// Fallback spawn zones (used for initial position only)
const SCENE_WALK_ZONES: Record<string, [number, number, number, number][]> = {
  '宝安城中村': [[0.08,0.22,0.80,0.60]],
  '南山科技园': [[0.05,0.16,0.85,0.60]],
  '福田CBD':    [[0.05,0.16,0.88,0.62]],
  '华强北':     [[0.08,0.18,0.78,0.66]],
  '东门老街':   [[0.08,0.20,0.80,0.62]],
  '南山公寓':   [[0.08,0.40,0.80,0.40]],
  '深圳湾公园': [[0.02,0.02,0.96,0.38]],
}

// -- Scene metadata --------------------------------------------------------
const SCENE_META: Record<string, { ambientColor: string; name: string }> = {
  '宝安城中村':  { ambientColor: '#C4956A', name: '宝安城中村' },
  '南山科技园':  { ambientColor: '#4D96FF', name: '南山科技园' },
  '福田CBD':     { ambientColor: '#FFD700', name: '福田CBD' },
  '华强北':      { ambientColor: '#FF4DC8', name: '华强北' },
  '东门老街':    { ambientColor: '#FF6B6B', name: '东门老街' },
  '南山公寓':    { ambientColor: '#69DB7C', name: '南山公寓' },
  '深圳湾公园':  { ambientColor: '#74C0FC', name: '深圳湾公园' },
}

const SCENE_NAMES = Object.keys(SCENE_META)

// -- Character constants ---------------------------------------------------
const CHAR_WALK_SPEED = 0.8
const WALK_FRAME_DURATION = 0.12
const WANDER_INTERVAL = 3.5

// -- Large map constants ---------------------------------------------------
const MAP_SCALE = 2.0

type Direction = 'left' | 'right' | 'down' | 'up'
type CharState = 'idle' | 'walk' | 'sleep'

interface BotRenderState {
  x: number; y: number
  targetX: number; targetY: number
  dir: Direction
  state: CharState
  frame: number
  frameTimer: number
  paletteIndex: number
  occupation?: string
  wanderTimer: number
  currentLocation?: string
  trail?: { x: number; y: number; alpha: number }[]
  trailTimer?: number
}

interface EmotionBubble {
  botId: string
  emoji: string
  x: number; y: number
  alpha: number
  timer: number
}

interface Props {
  world: WorldState | null
  selectedBotId: string | null
  onBotClick: (botId: string) => void
  onLocationClick: (location: string) => void
  currentLocation?: string
}

// -- Image cache -----------------------------------------------------------
const imageCache: Record<string, HTMLImageElement | null> = {}
const imageLoaded: Record<string, boolean> = {}

function preloadImage(url: string): HTMLImageElement {
  if (!imageCache[url]) {
    const img = new Image()
    img.onload = () => { imageLoaded[url] = true }
    img.onerror = () => { imageLoaded[url] = false }
    img.src = url
    imageCache[url] = img
    imageLoaded[url] = false
  }
  return imageCache[url]!
}

// -- Waypoint-based walk target selection ---------------------------------
// Returns the next waypoint on a random path for the given location
function getRandomWalkPoint(location: string): { x: number; y: number } {
  const paths = SCENE_WAYPOINTS[location]
  if (paths && paths.length > 0) {
    const path = paths[Math.floor(Math.random() * paths.length)]
    const wp = path[Math.floor(Math.random() * path.length)]
    // Add small jitter so characters don't all stack on same point
    return {
      x: wp[0] + (Math.random() - 0.5) * 0.04,
      y: wp[1] + (Math.random() - 0.5) * 0.03,
    }
  }
  // Fallback to zone-based
  const zones = SCENE_WALK_ZONES[location] || [[0.1, 0.3, 0.8, 0.5]]
  const zone = zones[Math.floor(Math.random() * zones.length)]
  return {
    x: zone[0] + Math.random() * zone[2],
    y: zone[1] + Math.random() * zone[3],
  }
}

function getInitialWalkPoint(location: string, index: number, total: number): { x: number; y: number } {
  const paths = SCENE_WAYPOINTS[location]
  if (paths && paths.length > 0) {
    const pathIdx = index % paths.length
    const path = paths[pathIdx]
    const wpIdx = total > 1 ? Math.floor((index / total) * path.length) : 0
    const wp = path[Math.min(wpIdx, path.length - 1)]
    return {
      x: wp[0] + (Math.random() - 0.5) * 0.05,
      y: wp[1] + (Math.random() - 0.5) * 0.04,
    }
  }
  // Fallback to zone-based
  const zones = SCENE_WALK_ZONES[location] || [[0.1, 0.3, 0.8, 0.5]]
  const zone = zones[index % zones.length]
  const t = total > 1 ? index / (total - 1) : 0.5
  return {
    x: zone[0] + t * zone[2] * 0.8 + 0.1 * zone[2],
    y: zone[1] + (0.3 + Math.random() * 0.4) * zone[3],
  }
}

// -- Get sprite config for a bot -------------------------------------------
function getSpriteConfig(occupation: string | undefined, paletteIndex: number): SpriteConfig {
  if (occupation && SPRITE_CONFIGS[occupation]) return SPRITE_CONFIGS[occupation]
  return FALLBACK_CONFIGS[paletteIndex % FALLBACK_CONFIGS.length]
}

// -- Initialize vehicles for a scene --------------------------------------
function initVehicles(location: string, botCount: number): VehicleState[] {
  const lanes = SCENE_VEHICLE_LANES[location] || []
  const vehicles: VehicleState[] = []
  
  const extraPerLane = Math.floor(botCount / 5)
  
  lanes.forEach((lane, laneIdx) => {
    const count = 3 + Math.min(extraPerLane, 4)
    for (let i = 0; i < count; i++) {
      const config = VEHICLE_CONFIGS[lane.type]
      const spread = lane.xMax - lane.xMin
      const x = lane.xMin + (i / count) * spread + Math.random() * (spread / count) * 0.5
      vehicles.push({
        id: `v_${location}_${laneIdx}_${i}`,
        type: lane.type,
        lane,
        x: Math.max(lane.xMin, Math.min(lane.xMax, x)),
        y: lane.y,
        dir: lane.dir,
        frame: Math.floor(Math.random() * V_ANIM_FRAMES),
        frameTimer: Math.random() * (1 / config.frameRate),
      })
    }
  })
  
  return vehicles
}

// -- Draw vehicle from spritesheet -----------------------------------------
function drawVehicle(
  ctx: CanvasRenderingContext2D,
  v: VehicleState,
  imgDrawX: number, imgDrawY: number, imgDrawW: number, imgDrawH: number,
) {
  const config = VEHICLE_CONFIGS[v.type]
  
  if (config.isBoat) {
    // Use boat spritesheet
    const sheet = imageCache[BOAT_SHEET_URL]
    if (!sheet || !imageLoaded[BOAT_SHEET_URL]) return
    
    const cellW = config.cellW!
    const cellH = config.cellH!
    const frameCol = v.frame % 4
    const sx = frameCol * cellW
    const sy = (config.boatRow ?? 0) * cellH
    
    const renderW = Math.round(cellW * config.scale)
    const renderH = Math.round(cellH * config.scale)
    
    const cx = imgDrawX + v.x * imgDrawW
    const cy = imgDrawY + v.y * imgDrawH
    
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    
    if (v.dir === -1) {
      ctx.translate(cx, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(sheet, sx, sy, cellW, cellH, -renderW / 2, cy - renderH * 0.6, renderW, renderH)
    } else {
      ctx.drawImage(sheet, sx, sy, cellW, cellH, cx - renderW / 2, cy - renderH * 0.6, renderW, renderH)
    }
    ctx.restore()
  } else {
    // Use vehicle spritesheet with precise frame coordinates
    const sheet = imageCache[VEHICLE_SHEET_URL]
    if (!sheet || !imageLoaded[VEHICLE_SHEET_URL]) return
    
    const vFrames = VEHICLE_FRAMES[v.type]
    if (!vFrames) return
    
    const dirFrames = v.dir === 1 ? vFrames.right : vFrames.left
    const frameIdx = v.frame % dirFrames.length
    const [x0, x1] = dirFrames[frameIdx]
    const sw = x1 - x0
    const sh = vFrames.sh
    const sy = vFrames.sy
    
    // Scale: render height = sh * scale, keep aspect ratio
    const renderH = Math.round(sh * config.scale)
    const renderW = Math.round(sw * config.scale)
    
    const cx = imgDrawX + v.x * imgDrawW
    const cy = imgDrawY + v.y * imgDrawH
    
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      sheet,
      x0, sy, sw, sh,
      cx - renderW / 2,
      cy - renderH * 0.85,
      renderW, renderH
    )
    ctx.restore()
  }
}

export default function PixelCityMap({
  world, selectedBotId, onBotClick, onLocationClick, currentLocation
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const botStatesRef = useRef<Record<string, BotRenderState>>({})
  const vehiclesRef = useRef<VehicleState[]>([])
  const bubblesRef = useRef<EmotionBubble[]>([])
  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const pulseRef = useRef(0)
  const [hoveredBotId, setHoveredBotId] = useState<string | null>(null)

  // Drag-to-pan (large map)
  const panOffsetRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const didDragRef = useRef(false)

  const activeLocation = currentLocation || SCENE_NAMES[0]
  const meta = SCENE_META[activeLocation] || SCENE_META['南山科技园']

  // Preload all images
  useEffect(() => {
    Object.values(SCENE_IMAGES).forEach(url => preloadImage(url))
    preloadImage(CHARS_SHEET1_URL)
    preloadImage(CHARS_SHEET2_URL)
    preloadImage(VEHICLE_SHEET_URL)
    preloadImage(BOAT_SHEET_URL)
  }, [])

  // Initialize vehicles when location changes
  useEffect(() => {
    const botCount = world ? Object.keys(world.bots).filter(id => world.bots[id].status === 'alive').length : 10
    vehiclesRef.current = initVehicles(activeLocation, botCount)
    panOffsetRef.current = { x: 0, y: 0 }
  }, [activeLocation])

  // Update bot states when world changes
  useEffect(() => {
    if (!world) return
    const allBotIds = Object.keys(world.bots).filter(id => world.bots[id].status === 'alive')

    const currentVehicleCount = vehiclesRef.current.length
    const expectedMin = initVehicles(activeLocation, allBotIds.length).length
    if (Math.abs(currentVehicleCount - expectedMin) > 3) {
      vehiclesRef.current = initVehicles(activeLocation, allBotIds.length)
    }

    allBotIds.forEach((botId, i) => {
      const bot = world.bots[botId]
      if (!bot) return
      const isHere = bot.location === activeLocation

      if (!botStatesRef.current[botId]) {
        const pt = getInitialWalkPoint(activeLocation, i, allBotIds.length)
        const target = getRandomWalkPoint(activeLocation)
        botStatesRef.current[botId] = {
          x: pt.x, y: pt.y,
          targetX: target.x, targetY: target.y,
          dir: 'down',
          state: bot.is_sleeping ? 'sleep' : (isHere ? 'walk' : 'idle'),
          frame: 0, frameTimer: 0,
          paletteIndex: i % 10,
          occupation: bot.occupation,
          wanderTimer: Math.random() * WANDER_INTERVAL,
          currentLocation: bot.location,
          trail: [],
          trailTimer: 0,
        }
      } else {
        const bs = botStatesRef.current[botId]
        if (bs.currentLocation && bs.currentLocation !== bot.location) {
          bs.trail = [{ x: bs.x, y: bs.y, alpha: 1.0 }]
          bs.trailTimer = 0
        }
        bs.currentLocation = bot.location
        bs.occupation = bot.occupation
        if (isHere && Math.abs(bs.x - bs.targetX) < 0.01 && Math.abs(bs.y - bs.targetY) < 0.01) {
          const wt = getRandomWalkPoint(activeLocation)
          bs.targetX = wt.x; bs.targetY = wt.y
          bs.state = bot.is_sleeping ? 'sleep' : 'walk'
        } else if (!isHere) {
          bs.state = bot.is_sleeping ? 'sleep' : 'idle'
        }
      }

      if (Math.random() < 0.006) {
        const emotion = getDominantEmotion(bot.emotions)
        const bs = botStatesRef.current[botId]
        if (bs) {
          bubblesRef.current.push({
            botId, emoji: emotion.emoji,
            x: bs.x, y: bs.y, alpha: 1, timer: 2.5,
          })
        }
      }
    })

    Object.keys(botStatesRef.current).forEach(id => {
      if (!allBotIds.includes(id)) delete botStatesRef.current[id]
    })
  }, [world, activeLocation])

  // Main render loop
  const render = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05)
    lastTimeRef.current = timestamp
    pulseRef.current = (pulseRef.current + dt * 1.5) % (Math.PI * 2)
    const pulse = Math.sin(pulseRef.current)

    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.width / dpr
    const cssH = canvas.height / dpr

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    // -- Background ----------------------------------------------------
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, cssW, cssH)

    // -- Large map: background image scaled to MAP_SCALE, pan offset ---
    const bgUrl = SCENE_IMAGES[activeLocation]
    const bgImg = bgUrl ? preloadImage(bgUrl) : null

    const worldW = cssW * MAP_SCALE
    const worldH = cssH * MAP_SCALE

    const maxPanX = (worldW - cssW) / 2
    const maxPanY = (worldH - cssH) / 2

    const panX = Math.max(-maxPanX, Math.min(maxPanX, panOffsetRef.current.x))
    const panY = Math.max(-maxPanY, Math.min(maxPanY, panOffsetRef.current.y))
    panOffsetRef.current.x = panX
    panOffsetRef.current.y = panY

    let imgDrawX = (cssW - worldW) / 2 + panX
    let imgDrawY = (cssH - worldH) / 2 + panY
    let imgDrawW = worldW
    let imgDrawH = worldH

    if (bgImg && imageLoaded[bgUrl!]) {
      const imgAspect = bgImg.width / bgImg.height
      const worldAspect = worldW / worldH
      if (worldAspect > imgAspect) {
        imgDrawW = worldW
        imgDrawH = worldW / imgAspect
        imgDrawX = (cssW - worldW) / 2 + panX
        imgDrawY = (cssH - imgDrawH) / 2 + panY
      } else {
        imgDrawH = worldH
        imgDrawW = worldH * imgAspect
        imgDrawX = (cssW - imgDrawW) / 2 + panX
        imgDrawY = (cssH - worldH) / 2 + panY
      }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bgImg, imgDrawX, imgDrawY, imgDrawW, imgDrawH)

      // -- Procedural ground extension -----------------------------------
      const tileColor = meta.ambientColor + '18'
      ctx.fillStyle = tileColor
      if (imgDrawX > 0) ctx.fillRect(0, 0, imgDrawX, cssH)
      if (imgDrawX + imgDrawW < cssW) ctx.fillRect(imgDrawX + imgDrawW, 0, cssW - imgDrawX - imgDrawW, cssH)
      if (imgDrawY > 0) ctx.fillRect(0, 0, cssW, imgDrawY)
      if (imgDrawY + imgDrawH < cssH) ctx.fillRect(0, imgDrawY + imgDrawH, cssW, cssH - imgDrawY - imgDrawH)
    } else {
      ctx.fillStyle = meta.ambientColor + '22'
      ctx.fillRect(0, 0, cssW, cssH)
      ctx.fillStyle = meta.ambientColor + '44'
      ctx.font = 'bold 48px "Noto Sans SC", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(meta.name, cssW / 2, cssH / 2)
      ctx.font = '14px monospace'
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillText('加载场景图中...', cssW / 2, cssH / 2 + 40)
    }

    // -- Z-sort drawable list ------------------------------------------
    interface ZDrawable { zY: number; draw: (c: CanvasRenderingContext2D) => void }
    const drawables: ZDrawable[] = []

    // -- Update & draw vehicles ----------------------------------------
    vehiclesRef.current.forEach(v => {
      const config = VEHICLE_CONFIGS[v.type]
      
      // Animate frames
      v.frameTimer += dt
      const frameDuration = 1 / config.frameRate
      if (v.frameTimer >= frameDuration) {
        v.frameTimer -= frameDuration
        v.frame = (v.frame + 1) % V_ANIM_FRAMES
      }
      
      // Move along lane
      v.x += v.dir * config.speed * dt
      
      // Wrap around when reaching lane end
      if (v.dir === 1 && v.x > v.lane.xMax + 0.05) {
        v.x = v.lane.xMin - 0.05
      } else if (v.dir === -1 && v.x < v.lane.xMin - 0.05) {
        v.x = v.lane.xMax + 0.05
      }
      
      // Only draw if within visible area
      const vCx = imgDrawX + v.x * imgDrawW
      const vCy = imgDrawY + v.y * imgDrawH
      if (vCx < -100 || vCx > cssW + 100 || vCy < -100 || vCy > cssH + 100) return
      
      const vConfig = VEHICLE_CONFIGS[v.type]
      
      // Shadow (skip for boats - they're on water)
      if (!vConfig.isBoat) {
        drawables.push({
          zY: vCy - 0.5,
          draw: (c) => {
            c.save()
            c.beginPath()
            c.ellipse(vCx, vCy + 2, 30 * vConfig.scale, 10 * vConfig.scale, 0, 0, Math.PI * 2)
            c.fillStyle = 'rgba(0,0,0,0.25)'
            c.fill()
            c.restore()
          }
        })
      }
      
      // Vehicle sprite
      const vSnap = { ...v }
      drawables.push({
        zY: vCy,
        draw: (c) => drawVehicle(c, vSnap, imgDrawX, imgDrawY, imgDrawW, imgDrawH)
      })
    })

    // -- Bot characters ------------------------------------------------
    Object.entries(botStatesRef.current).forEach(([botId, bs]) => {
      bs.frameTimer += dt

      if (bs.state === 'idle') {
        bs.wanderTimer = (bs.wanderTimer ?? 0) + dt
        if (bs.wanderTimer > WANDER_INTERVAL + Math.random() * 2) {
          bs.wanderTimer = 0
          const wt = getRandomWalkPoint(activeLocation)
          bs.targetX = wt.x; bs.targetY = wt.y
          bs.state = 'walk'
        }
      }

      if (bs.state === 'walk') {
        if (bs.frameTimer >= WALK_FRAME_DURATION) {
          bs.frameTimer -= WALK_FRAME_DURATION
          bs.frame = (bs.frame + 1) % 5
        }
        const dx = bs.targetX - bs.x
        const dy = bs.targetY - bs.y
        const dist = Math.hypot(dx, dy)
        if (dist < 0.005) {
          bs.x = bs.targetX; bs.y = bs.targetY
          bs.state = 'idle'; bs.frame = 0; bs.wanderTimer = 0
        } else {
          const speed = CHAR_WALK_SPEED / (cssW * MAP_SCALE)
          bs.x += (dx / dist) * speed
          bs.y += (dy / dist) * speed
          // Only update direction for horizontal movement to keep sprite facing correct way
          // For vertical-dominant movement, keep the last horizontal direction
          if (Math.abs(dx) > 0.001) {
            bs.dir = dx > 0 ? 'right' : 'left'
          }
          // If purely vertical movement with no horizontal component, keep existing dir
        }
      }

      // Trail
      if (!bs.trail) bs.trail = []
      bs.trailTimer = (bs.trailTimer ?? 0) + dt
      if (bs.state === 'walk' && bs.trailTimer > 0.15) {
        bs.trailTimer = 0
        bs.trail.push({ x: bs.x, y: bs.y, alpha: 1.0 })
        if (bs.trail.length > 15) bs.trail.shift()
      }
      bs.trail.forEach(pt => { pt.alpha -= dt * 0.8 })
      bs.trail = bs.trail.filter(pt => pt.alpha > 0.05)

      if (bs.trail.length > 1) {
        const trailColor = BOT_COLORS[botId] || '#4d96ff'
        drawables.push({
          zY: -9999,
          draw: (c) => {
            c.save()
            c.setLineDash([3, 3])
            c.lineWidth = 1.5
            for (let ti = 1; ti < bs.trail!.length; ti++) {
              const pt0 = bs.trail![ti - 1]
              const pt1 = bs.trail![ti]
              const alpha = Math.min(pt0.alpha, pt1.alpha) * 0.4
              c.strokeStyle = trailColor
              c.globalAlpha = alpha
              c.beginPath()
              c.moveTo(imgDrawX + pt0.x * imgDrawW, imgDrawY + pt0.y * imgDrawH)
              c.lineTo(imgDrawX + pt1.x * imgDrawW, imgDrawY + pt1.y * imgDrawH)
              c.stroke()
            }
            c.setLineDash([])
            c.restore()
          }
        })
      }

      // Use precise frame coords if available, else fall back to legacy
      const occ = bs.occupation || FALLBACK_OCCUPATIONS[bs.paletteIndex % FALLBACK_OCCUPATIONS.length]
      const charCoords = CHAR_FRAME_COORDS[occ]
      const config = getSpriteConfig(bs.occupation, bs.paletteIndex)
      
      // Determine render size from actual frame dimensions
      let frameW = 200, frameH = 512
      if (charCoords) {
        const fi = bs.frame % charCoords.frames.length
        const [fx0, fx1] = charCoords.frames[fi]
        frameW = fx1 - fx0
        frameH = charCoords.rowH
      }
      const renderH = Math.round(frameH * config.scale)
      const renderW = Math.round(frameW * config.scale)
      const cx = imgDrawX + bs.x * imgDrawW
      const cy = imgDrawY + bs.y * imgDrawH
      const zY = cy

      if (cx < -renderW || cx > cssW + renderW || cy < -renderH || cy > cssH + renderH) return

      const isSelected = selectedBotId === botId
      const isHovered = hoveredBotId === botId
      const isFlipped = bs.dir === 'left'

      drawables.push({
        zY: zY - 0.3,
        draw: (c) => {
          c.save()
          c.beginPath()
          c.ellipse(cx, cy + 2, renderW * 0.35, renderW * 0.12, 0, 0, Math.PI * 2)
          c.fillStyle = 'rgba(0,0,0,0.35)'
          c.fill()
          c.restore()
        }
      })

      if (isSelected) {
        const color = BOT_COLORS[botId] || '#4d96ff'
        drawables.push({
          zY: zY - 0.2,
          draw: (c) => {
            c.save()
            c.beginPath()
            c.ellipse(cx, cy + 2, renderW * 0.45, renderW * 0.15, 0, 0, Math.PI * 2)
            c.strokeStyle = color
            c.lineWidth = 2.5
            c.globalAlpha = 0.7 + pulse * 0.3
            c.stroke()
            c.restore()
          }
        })
      }

      if (isHovered && !isSelected) {
        drawables.push({
          zY: zY - 0.15,
          draw: (c) => {
            c.save()
            c.beginPath()
            c.ellipse(cx, cy + 2, renderW * 0.4, renderW * 0.13, 0, 0, Math.PI * 2)
            c.strokeStyle = 'rgba(255,255,255,0.6)'
            c.lineWidth = 1.5
            c.stroke()
            c.restore()
          }
        })
      }

      // Frame selection: frames 0-3 are right-facing, frames 4-5 are left-facing
      // Use left frames when moving left, right frames when moving right
      // No horizontal flip needed - sprites have both directions built in
      const totalFrames = charCoords ? charCoords.frames.length : 6
      const rightFrameCount = Math.ceil(totalFrames / 2)  // typically 4
      const leftFrameCount = totalFrames - rightFrameCount  // typically 2
      let walkFrameIdx: number
      if (bs.state === 'idle') {
        walkFrameIdx = isFlipped ? rightFrameCount : 0  // idle: first frame of correct direction
      } else if (isFlipped) {
        // Left-facing: use frames rightFrameCount..totalFrames-1
        walkFrameIdx = rightFrameCount + (bs.frame % leftFrameCount)
      } else {
        // Right-facing: use frames 0..rightFrameCount-1
        walkFrameIdx = bs.frame % rightFrameCount
      }
      drawables.push({
        zY,
        draw: (c) => {
          if (!charCoords) {
            // Fallback: draw colored circle
            c.save()
            c.beginPath()
            c.arc(cx, cy - renderH * 0.5, renderW * 0.3, 0, Math.PI * 2)
            c.fillStyle = BOT_COLORS[botId] || '#4d96ff'
            c.fill()
            c.restore()
            return
          }
          const sheetUrl = charCoords.sheet === 1 ? CHARS_SHEET1_URL : CHARS_SHEET2_URL
          const sheet = imageCache[sheetUrl]
          if (!sheet || !imageLoaded[sheetUrl]) {
            c.save()
            c.beginPath()
            c.arc(cx, cy - renderH * 0.5, renderW * 0.3, 0, Math.PI * 2)
            c.fillStyle = BOT_COLORS[botId] || '#4d96ff'
            c.fill()
            c.restore()
            return
          }

          const fi = walkFrameIdx % charCoords.frames.length
          const [fx0, fx1] = charCoords.frames[fi]
          const sw = fx1 - fx0
          const sh = charCoords.rowH
          const sy = charCoords.rowY
          const rW = Math.round(sw * config.scale)
          const rH = Math.round(sh * config.scale)
          const ddx = cx - rW / 2
          const ddy = cy - rH * config.offsetY

          c.save()
          c.globalAlpha = isSelected ? 1.0 : (isHovered ? 0.95 : 0.92)
          c.imageSmoothingEnabled = true
          c.imageSmoothingQuality = 'high'
          c.drawImage(sheet, fx0, sy, sw, sh, ddx, ddy, rW, rH)

          if (isSelected) {
            c.globalAlpha = 0.4
            c.globalCompositeOperation = 'screen'
            c.drawImage(sheet, fx0, sy, sw, sh, ddx, ddy, rW, rH)
            c.globalCompositeOperation = 'source-over'
          }
          c.restore()
        }
      })

      const botColor = BOT_COLORS[botId] || '#4d96ff'
      const botName = world?.bots[botId]?.name?.slice(0, 4) ?? botId
      const labelY = cy - renderH * config.offsetY - 6
      drawables.push({
        zY: zY + 1,
        draw: (c) => {
          c.save()
          c.font = `bold 10px 'Noto Sans SC', monospace`
          c.textAlign = 'center'
          const lw = c.measureText(botName).width
          c.fillStyle = 'rgba(0,0,0,0.75)'
          c.beginPath()
          const lx = cx - lw / 2 - 4
          const ly = labelY - 11
          const lrw = lw + 8
          const lrh = 13
          const r = 3
          c.moveTo(lx + r, ly)
          c.lineTo(lx + lrw - r, ly)
          c.arcTo(lx + lrw, ly, lx + lrw, ly + r, r)
          c.lineTo(lx + lrw, ly + lrh - r)
          c.arcTo(lx + lrw, ly + lrh, lx + lrw - r, ly + lrh, r)
          c.lineTo(lx + r, ly + lrh)
          c.arcTo(lx, ly + lrh, lx, ly + lrh - r, r)
          c.lineTo(lx, ly + r)
          c.arcTo(lx, ly, lx + r, ly, r)
          c.closePath()
          c.fill()
          c.fillStyle = botColor
          c.globalAlpha = 0.95
          c.fillText(botName, cx, labelY)
          c.restore()
        }
      })
    })

    // -- Emotion bubbles -----------------------------------------------
    bubblesRef.current = bubblesRef.current.filter(b => b.timer > 0)
    bubblesRef.current.forEach(bubble => {
      bubble.timer -= dt
      bubble.alpha = Math.min(1, bubble.timer / 0.5)
      bubble.y -= dt * 0.003

      const bs = botStatesRef.current[bubble.botId]
      if (!bs) return
      const config = getSpriteConfig(bs.occupation, bs.paletteIndex)
      const bsOcc = bs.occupation || FALLBACK_OCCUPATIONS[bs.paletteIndex % FALLBACK_OCCUPATIONS.length]
      const bsCoords = CHAR_FRAME_COORDS[bsOcc]
      const bsFrameH = bsCoords ? bsCoords.rowH : 512
      const renderH = Math.round(bsFrameH * config.scale)
      const bx = imgDrawX + bs.x * imgDrawW
      const by = imgDrawY + bs.y * imgDrawH - renderH * config.offsetY - 30

      drawables.push({
        zY: imgDrawY + bs.y * imgDrawH - 200,
        draw: (c) => {
          c.save()
          c.globalAlpha = bubble.alpha
          c.fillStyle = 'rgba(30,30,40,0.85)'
          c.beginPath()
          c.roundRect(bx - 14, by - 14, 28, 24, 6)
          c.fill()
          c.beginPath()
          c.moveTo(bx - 4, by + 10)
          c.lineTo(bx + 4, by + 10)
          c.lineTo(bx, by + 16)
          c.closePath()
          c.fill()
          c.font = `14px sans-serif`
          c.textAlign = 'center'
          c.fillText(bubble.emoji, bx, by + 4)
          c.restore()
        }
      })
    })

    // -- Z-sort and draw -----------------------------------------------
    drawables.sort((a, b) => a.zY - b.zY)
    drawables.forEach(d => d.draw(ctx))

    // -- Pan indicator -------------------------------------------------
    if (Math.abs(panX) > 10 || Math.abs(panY) > 10) {
      ctx.save()
      ctx.globalAlpha = 0.5
      const arrowSize = 8
      const margin = 20
      ctx.fillStyle = meta.ambientColor
      ctx.font = `${arrowSize * 2}px sans-serif`
      ctx.textAlign = 'center'
      if (panX < -10) ctx.fillText('◀', margin, cssH / 2)
      if (panX > 10) ctx.fillText('▶', cssW - margin, cssH / 2)
      if (panY < -10) ctx.fillText('▲', cssW / 2, margin + arrowSize)
      if (panY > 10) ctx.fillText('▼', cssW / 2, cssH - margin)
      ctx.restore()
    }

    // -- Vignette -----------------------------------------------------
    const vignette = ctx.createRadialGradient(cssW/2, cssH/2, cssH*0.3, cssW/2, cssH/2, cssH*0.8)
    vignette.addColorStop(0, 'transparent')
    vignette.addColorStop(1, 'rgba(0,0,0,0.2)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, cssW, cssH)

    ctx.restore()
    animFrameRef.current = requestAnimationFrame(render)
  }, [world, selectedBotId, hoveredBotId, activeLocation, meta])

  useEffect(() => {
    lastTimeRef.current = performance.now()
    animFrameRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [render])

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // Hit testing
  const getBotAtPoint = useCallback((mx: number, my: number): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.width / dpr
    const cssH = canvas.height / dpr

    const worldW = cssW * MAP_SCALE
    const worldH = cssH * MAP_SCALE
    const panX = panOffsetRef.current.x
    const panY = panOffsetRef.current.y

    const bgUrl = SCENE_IMAGES[activeLocation]
    const bgImg = bgUrl ? imageCache[bgUrl] : null
    let imgDrawX = (cssW - worldW) / 2 + panX
    let imgDrawY = (cssH - worldH) / 2 + panY
    let imgDrawW = worldW
    let imgDrawH = worldH

    if (bgImg && imageLoaded[bgUrl!]) {
      const imgAspect = bgImg.width / bgImg.height
      const worldAspect = worldW / worldH
      if (worldAspect > imgAspect) {
        imgDrawW = worldW
        imgDrawH = worldW / imgAspect
        imgDrawX = (cssW - worldW) / 2 + panX
        imgDrawY = (cssH - imgDrawH) / 2 + panY
      } else {
        imgDrawH = worldH
        imgDrawW = worldH * imgAspect
        imgDrawX = (cssW - imgDrawW) / 2 + panX
        imgDrawY = (cssH - worldH) / 2 + panY
      }
    }

    for (const [botId, bs] of Object.entries(botStatesRef.current)) {
      const config = getSpriteConfig(bs.occupation, bs.paletteIndex)
      const htOcc = bs.occupation || FALLBACK_OCCUPATIONS[bs.paletteIndex % FALLBACK_OCCUPATIONS.length]
      const htCoords = CHAR_FRAME_COORDS[htOcc]
      const htFrameW = htCoords ? (htCoords.frames[0][1] - htCoords.frames[0][0]) : 200
      const htFrameH = htCoords ? htCoords.rowH : 512
      const renderW = Math.round(htFrameW * config.scale)
      const renderH = Math.round(htFrameH * config.scale)
      const cx = imgDrawX + bs.x * imgDrawW
      const cy = imgDrawY + bs.y * imgDrawH
      const bx = cx - renderW / 2
      const by = cy - renderH * config.offsetY
      if (mx >= bx && mx <= bx + renderW && my >= by && my <= by + renderH) {
        return botId
      }
    }
    return null
  }, [activeLocation])

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { mx: 0, my: 0 }
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    return {
      mx: (clientX - rect.left) * (canvas.width / rect.width) / dpr,
      my: (clientY - rect.top) * (canvas.height / rect.height) / dpr,
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true
    didDragRef.current = false
    dragStartRef.current = {
      x: e.clientX, y: e.clientY,
      panX: panOffsetRef.current.x, panY: panOffsetRef.current.y,
    }
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false
    if (!didDragRef.current) {
      const { mx, my } = getCanvasPos(e.clientX, e.clientY)
      const botId = getBotAtPoint(mx, my)
      if (botId) onBotClick(botId)
    }
    didDragRef.current = false
  }, [getBotAtPoint, onBotClick, getCanvasPos])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true
      panOffsetRef.current = {
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      }
      return
    }
    const { mx, my } = getCanvasPos(e.clientX, e.clientY)
    setHoveredBotId(getBotAtPoint(mx, my))
  }, [getBotAtPoint, getCanvasPos])

  const touchStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX, y: e.touches[0].clientY,
        panX: panOffsetRef.current.x, panY: panOffsetRef.current.y,
      }
    }
  }, [])
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && touchStartRef.current) {
      e.preventDefault()
      const dx = e.touches[0].clientX - touchStartRef.current.x
      const dy = e.touches[0].clientY - touchStartRef.current.y
      panOffsetRef.current = {
        x: touchStartRef.current.panX + dx,
        y: touchStartRef.current.panY + dy,
      }
    }
  }, [])

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          cursor: isDraggingRef.current ? 'grabbing' : hoveredBotId ? 'pointer' : 'grab',
          imageRendering: 'pixelated',
          userSelect: 'none',
          touchAction: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={() => {}}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredBotId(null); isDraggingRef.current = false }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => { touchStartRef.current = null }}
      />
      {/* Location selector tabs */}
      <div className="absolute bottom-3 left-0 right-0 flex gap-1 justify-center overflow-x-auto px-2 pb-0.5" style={{scrollbarWidth:'none'}}>
        {SCENE_NAMES.map(loc => (
          <button
            key={loc}
            onClick={() => onLocationClick(loc)}
            className={`px-2 py-0.5 text-xs font-mono border transition-all ${
              loc === activeLocation
                ? 'border-opacity-80 text-white'
                : 'bg-black/50 border-white/15 text-white/50 hover:border-white/40 hover:text-white/80'
            }`}
            style={loc === activeLocation ? {
              background: meta.ambientColor + '33',
              borderColor: meta.ambientColor + 'AA',
              color: meta.ambientColor,
            } : {}}
          >
            {loc}
          </button>
        ))}
      </div>
      {/* Map scale indicator */}
      <div className="absolute top-3 right-3 text-xs font-mono text-white/30 bg-black/30 px-2 py-0.5 rounded pointer-events-none">
        拖拽探索 {MAP_SCALE}x 地图
      </div>
    </div>
  )
}
