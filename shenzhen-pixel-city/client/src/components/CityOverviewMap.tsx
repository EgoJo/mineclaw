/**
 * CityOverviewMap - 深圳全城鸟瞰图
 * 使用设计图 szpc_overview_map.png 作为背景
 * 在各场景区域叠加可点击热区 + Bot 光点 + 移动的行人/车辆/船只
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import type { WorldState } from '@/types/world'
import { BOT_COLORS } from '@/types/world'

const OVERVIEW_MAP_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663220928499/BceSHaqeFoKxCAGO.jpg'

// Location hit regions on the overview map image (normalized 0-1)
export const OVERVIEW_LOCATIONS: Record<string, {
  cx: number; cy: number
  x: number; y: number; w: number; h: number
  label: string; color: string; icon: string
}> = {
  'baoan_urban_village': {
    cx: 0.155, cy: 0.195,
    x: 0.02,  y: 0.01,  w: 0.27, h: 0.38,
    label: '城中村', color: '#C4956A', icon: '🏘️'
  },
  'nanshan_tech_park': {
    cx: 0.155, cy: 0.53,
    x: 0.02,  y: 0.39,  w: 0.27, h: 0.28,
    label: '科技园', color: '#4D96FF', icon: '🏢'
  },
  'futian_cbd': {
    cx: 0.46,  cy: 0.42,
    x: 0.30,  y: 0.01,  w: 0.35, h: 0.75,
    label: 'Futian CBD', color: '#FFD700', icon: '🏙️'
  },
  'huaqiangbei': {
    cx: 0.80,  cy: 0.30,
    x: 0.66,  y: 0.01,  w: 0.33, h: 0.48,
    label: '华强北', color: '#FF4DC8', icon: '📱'
  },
  'dongmen_oldstreet': {
    cx: 0.80,  cy: 0.68,
    x: 0.66,  y: 0.50,  w: 0.33, h: 0.48,
    label: '东门老街', color: '#FF6B6B', icon: '🏮'
  },
  'nanshan_apartments': {
    cx: 0.155, cy: 0.77,
    x: 0.02,  y: 0.68,  w: 0.27, h: 0.30,
    label: '南山公寓', color: '#69DB7C', icon: '🏠'
  },
  'shenzhen_bay_park': {
    cx: 0.46,  cy: 0.82,
    x: 0.30,  y: 0.77,  w: 0.35, h: 0.22,
    label: '深圳湾公园', color: '#74C0FC', icon: '🌊'
  },
}

// ── NPC types for the overview map ──────────────────────────────────────────

type NPCType = 'pedestrian' | 'car' | 'scooter' | 'boat'

interface OverviewNPC {
  id: number
  type: NPCType
  x: number       // normalized 0-1
  y: number       // normalized 0-1
  vx: number      // velocity x (normalized/s)
  vy: number      // velocity y (normalized/s)
  color: string
  size: number    // pixels at 1x scale
  frame: number
  frameTimer: number
  // For path-following NPCs
  pathPoints?: { x: number; y: number }[]
  pathIndex?: number
}

// Road paths on the overview map (normalized 0-1)
// Based on visual analysis of szpc_overview_map.png
const ROAD_PATHS = {
  // Horizontal main roads
  hRoad1: { y: 0.50, xStart: 0.0, xEnd: 1.0 },  // main horizontal road
  hRoad2: { y: 0.78, xStart: 0.0, xEnd: 0.65 },  // lower horizontal road
  // Vertical main roads
  vRoad1: { x: 0.30, yStart: 0.0, yEnd: 1.0 },   // left vertical road
  vRoad2: { x: 0.65, yStart: 0.0, yEnd: 0.78 },  // right vertical road
}

// Pedestrian zones in each district (for walking NPCs)
const DISTRICT_WALK_ZONES = [
  // 城中村 district
  { x: 0.05, y: 0.05, w: 0.22, h: 0.32 },
  // 科技园 district
  { x: 0.06, y: 0.42, w: 0.22, h: 0.22 },
  // Futian CBD center
  { x: 0.35, y: 0.15, w: 0.25, h: 0.55 },
  // 华强北 district
  { x: 0.68, y: 0.05, w: 0.28, h: 0.40 },
  // 东门老街 district
  { x: 0.68, y: 0.52, w: 0.28, h: 0.38 },
  // 南山公寓 district
  { x: 0.05, y: 0.70, w: 0.22, h: 0.25 },
  // 深圳湾公园 park area
  { x: 0.32, y: 0.78, w: 0.32, h: 0.18 },
]

// Water area for boats (深圳湾)
const WATER_ZONE = { x: 0.30, y: 0.82, w: 0.35, h: 0.16 }

const CAR_COLORS = ['#E8E8E8', '#CC3333', '#3355CC', '#33AA55', '#FFCC00', '#888888', '#FF6600']
const PEDESTRIAN_COLORS = ['#FF6B6B', '#4D96FF', '#69DB7C', '#FFD700', '#FF4DC8', '#74C0FC', '#C4956A']

function createNPCs(): OverviewNPC[] {
  const npcs: OverviewNPC[] = []
  let id = 0

  // Cars on horizontal road 1 (y≈0.50)
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 === 0 ? 1 : -1
    npcs.push({
      id: id++, type: 'car',
      x: Math.random(), y: ROAD_PATHS.hRoad1.y + (Math.random() - 0.5) * 0.02,
      vx: dir * (0.03 + Math.random() * 0.02), vy: 0,
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      size: 5, frame: 0, frameTimer: 0
    })
  }

  // Cars on horizontal road 2 (y≈0.78)
  for (let i = 0; i < 4; i++) {
    const dir = i % 2 === 0 ? 1 : -1
    npcs.push({
      id: id++, type: 'car',
      x: Math.random() * 0.65, y: ROAD_PATHS.hRoad2.y + (Math.random() - 0.5) * 0.02,
      vx: dir * (0.025 + Math.random() * 0.02), vy: 0,
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      size: 5, frame: 0, frameTimer: 0
    })
  }

  // Cars on vertical road 1 (x≈0.30)
  for (let i = 0; i < 5; i++) {
    const dir = i % 2 === 0 ? 1 : -1
    npcs.push({
      id: id++, type: 'car',
      x: ROAD_PATHS.vRoad1.x + (Math.random() - 0.5) * 0.02, y: Math.random(),
      vx: 0, vy: dir * (0.025 + Math.random() * 0.02),
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      size: 5, frame: 0, frameTimer: 0
    })
  }

  // Cars on vertical road 2 (x≈0.65)
  for (let i = 0; i < 4; i++) {
    const dir = i % 2 === 0 ? 1 : -1
    npcs.push({
      id: id++, type: 'car',
      x: ROAD_PATHS.vRoad2.x + (Math.random() - 0.5) * 0.02, y: Math.random() * 0.78,
      vx: 0, vy: dir * (0.025 + Math.random() * 0.02),
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      size: 5, frame: 0, frameTimer: 0
    })
  }

  // Scooters (外卖骑手) on roads
  for (let i = 0; i < 5; i++) {
    const onHRoad = Math.random() > 0.5
    const dir = Math.random() > 0.5 ? 1 : -1
    npcs.push({
      id: id++, type: 'scooter',
      x: Math.random(), y: onHRoad ? ROAD_PATHS.hRoad1.y + 0.015 : ROAD_PATHS.hRoad2.y + 0.015,
      vx: dir * (0.04 + Math.random() * 0.02), vy: 0,
      color: '#FFD700',
      size: 4, frame: 0, frameTimer: 0
    })
  }

  // Pedestrians in each district
  DISTRICT_WALK_ZONES.forEach(zone => {
    const count = 3 + Math.floor(Math.random() * 4)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.008 + Math.random() * 0.008
      npcs.push({
        id: id++, type: 'pedestrian',
        x: zone.x + Math.random() * zone.w,
        y: zone.y + Math.random() * zone.h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: PEDESTRIAN_COLORS[Math.floor(Math.random() * PEDESTRIAN_COLORS.length)],
        size: 3, frame: 0, frameTimer: 0,
        // Store zone bounds for bouncing
        pathPoints: [
          { x: zone.x, y: zone.y },
          { x: zone.x + zone.w, y: zone.y + zone.h }
        ]
      })
    }
  })

  // Boats on water (深圳湾)
  for (let i = 0; i < 3; i++) {
    const dir = i % 2 === 0 ? 1 : -1
    npcs.push({
      id: id++, type: 'boat',
      x: WATER_ZONE.x + Math.random() * WATER_ZONE.w,
      y: WATER_ZONE.y + Math.random() * WATER_ZONE.h,
      vx: dir * (0.006 + Math.random() * 0.004),
      vy: (Math.random() - 0.5) * 0.003,
      color: '#FFFFFF',
      size: 5, frame: 0, frameTimer: 0,
      pathPoints: [
        { x: WATER_ZONE.x, y: WATER_ZONE.y },
        { x: WATER_ZONE.x + WATER_ZONE.w, y: WATER_ZONE.y + WATER_ZONE.h }
      ]
    })
  }

  return npcs
}

// Draw a tiny car pixel sprite
function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, movingRight: boolean, scale: number) {
  const s = scale
  ctx.save()
  ctx.translate(x, y)
  if (!movingRight) ctx.scale(-1, 1)
  // Car body
  ctx.fillStyle = color
  ctx.fillRect(-s * 3, -s * 1.5, s * 6, s * 3)
  // Windshield
  ctx.fillStyle = 'rgba(150,220,255,0.8)'
  ctx.fillRect(-s * 1.5, -s * 1.5, s * 3, s * 1.5)
  // Wheels
  ctx.fillStyle = '#222'
  ctx.fillRect(-s * 3, s * 1, s * 2, s * 1)
  ctx.fillRect(s * 1, s * 1, s * 2, s * 1)
  ctx.restore()
}

// Draw a tiny scooter pixel sprite
function drawScooter(ctx: CanvasRenderingContext2D, x: number, y: number, movingRight: boolean, scale: number) {
  const s = scale
  ctx.save()
  ctx.translate(x, y)
  if (!movingRight) ctx.scale(-1, 1)
  // Rider (yellow helmet)
  ctx.fillStyle = '#FFD700'
  ctx.beginPath()
  ctx.arc(s * 0.5, -s * 2.5, s * 1.2, 0, Math.PI * 2)
  ctx.fill()
  // Body
  ctx.fillStyle = '#1E90FF'
  ctx.fillRect(-s * 0.5, -s * 2, s * 2, s * 2)
  // Scooter body
  ctx.fillStyle = '#FFD700'
  ctx.fillRect(-s * 2, -s * 0.5, s * 4, s * 1)
  // Wheels
  ctx.fillStyle = '#333'
  ctx.beginPath()
  ctx.arc(-s * 1.5, s * 1, s * 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(s * 1.5, s * 1, s * 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Draw a tiny pedestrian pixel sprite
function drawPedestrian(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, frame: number, scale: number) {
  const s = scale
  const bobY = Math.sin(frame * 0.5) * s * 0.5
  ctx.save()
  ctx.translate(x, y + bobY)
  // Head
  ctx.fillStyle = '#FFCC99'
  ctx.beginPath()
  ctx.arc(0, -s * 2.5, s * 1, 0, Math.PI * 2)
  ctx.fill()
  // Body
  ctx.fillStyle = color
  ctx.fillRect(-s * 0.8, -s * 1.5, s * 1.6, s * 2)
  // Legs
  const legOffset = Math.sin(frame * 0.5) * s * 0.8
  ctx.fillStyle = '#555'
  ctx.fillRect(-s * 0.8, s * 0.5, s * 0.7, s * 1.5 + legOffset)
  ctx.fillRect(s * 0.1, s * 0.5, s * 0.7, s * 1.5 - legOffset)
  ctx.restore()
}

// Draw a tiny boat pixel sprite
function drawBoat(ctx: CanvasRenderingContext2D, x: number, y: number, movingRight: boolean, t: number, scale: number) {
  const s = scale
  const bobY = Math.sin(t * 2) * s * 0.5
  ctx.save()
  ctx.translate(x, y + bobY)
  if (!movingRight) ctx.scale(-1, 1)
  // Hull
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.moveTo(-s * 3, 0)
  ctx.lineTo(s * 3, 0)
  ctx.lineTo(s * 2, s * 1.5)
  ctx.lineTo(-s * 2, s * 1.5)
  ctx.closePath()
  ctx.fill()
  // Cabin
  ctx.fillStyle = '#AADDFF'
  ctx.fillRect(-s * 1, -s * 1.5, s * 2, s * 1.5)
  ctx.restore()
}

interface Props {
  world: WorldState | null
  onLocationSelect: (location: string) => void
}

export default function CityOverviewMap({ world, onLocationSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const timeRef = useRef(0)
  const lastTimeRef = useRef(0)
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null)
  const hoveredRef = useRef<string | null>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const bgLoadedRef = useRef(false)
  const npcsRef = useRef<OverviewNPC[]>(createNPCs())

  // Preload background image
  useEffect(() => {
    const img = new Image()
    // No crossOrigin: CDN doesn't support CORS, but drawImage works fine without it
    img.onload = () => { bgLoadedRef.current = true; bgImageRef.current = img }
    img.src = OVERVIEW_MAP_URL
  }, [])

  // Count bots per location
  const botsByLocation = useCallback((): Record<string, string[]> => {
    const result: Record<string, string[]> = {}
    if (!world) return result
    Object.values(world.bots).forEach(bot => {
      const loc = bot.location || 'baoan_urban_village'
      if (!result[loc]) result[loc] = []
      result[loc].push(bot.id)
    })
    return result
  }, [world])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    function resize() {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas!.getBoundingClientRect()
      canvas!.width = rect.width * dpr
      canvas!.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    function updateNPCs(dt: number) {
      const npcs = npcsRef.current
      npcs.forEach(npc => {
        // Update frame timer
        npc.frameTimer += dt
        if (npc.frameTimer > 0.15) {
          npc.frame++
          npc.frameTimer = 0
        }

        // Move NPC
        npc.x += npc.vx * dt
        npc.y += npc.vy * dt

        // Wrap/bounce logic
        if (npc.type === 'car' || npc.type === 'scooter') {
          // Wrap around screen edges
          if (npc.x > 1.05) npc.x = -0.05
          if (npc.x < -0.05) npc.x = 1.05
          if (npc.y > 1.05) npc.y = -0.05
          if (npc.y < -0.05) npc.y = 1.05
        } else if (npc.type === 'pedestrian' && npc.pathPoints) {
          // Bounce within zone
          const zone = npc.pathPoints
          if (npc.x < zone[0].x || npc.x > zone[1].x) {
            npc.vx = -npc.vx
            npc.x = Math.max(zone[0].x, Math.min(zone[1].x, npc.x))
          }
          if (npc.y < zone[0].y || npc.y > zone[1].y) {
            npc.vy = -npc.vy
            npc.y = Math.max(zone[0].y, Math.min(zone[1].y, npc.y))
          }
          // Occasionally change direction
          if (Math.random() < 0.002) {
            const angle = Math.random() * Math.PI * 2
            const speed = Math.sqrt(npc.vx * npc.vx + npc.vy * npc.vy)
            npc.vx = Math.cos(angle) * speed
            npc.vy = Math.sin(angle) * speed
          }
        } else if (npc.type === 'boat' && npc.pathPoints) {
          // Bounce within water zone
          const zone = npc.pathPoints
          if (npc.x < zone[0].x || npc.x > zone[1].x) {
            npc.vx = -npc.vx
            npc.x = Math.max(zone[0].x, Math.min(zone[1].x, npc.x))
          }
          if (npc.y < zone[0].y || npc.y > zone[1].y) {
            npc.vy = -npc.vy
            npc.y = Math.max(zone[0].y, Math.min(zone[1].y, npc.y))
          }
        }
      })
    }

    function render(ts: number) {
      const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = ts
      timeRef.current += dt
      const t = timeRef.current

      const W = canvas!.getBoundingClientRect().width
      const H = canvas!.getBoundingClientRect().height
      if (W <= 0 || H <= 0) {
        animFrameRef.current = requestAnimationFrame(render)
        return
      }

      // Update NPC positions
      updateNPCs(dt)

      // Background
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, W, H)

      // Draw overview map image
      if (bgLoadedRef.current && bgImageRef.current) {
        const img = bgImageRef.current
        const imgAspect = img.width / img.height
        const canvasAspect = W / H
        let drawW: number, drawH: number, drawX: number, drawY: number
        if (canvasAspect > imgAspect) {
          drawW = W; drawH = W / imgAspect; drawX = 0; drawY = (H - drawH) / 2
        } else {
          drawH = H; drawW = H * imgAspect; drawX = (W - drawW) / 2; drawY = 0
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH)

        // Scale factor for NPC rendering (relative to image size)
        const scale = drawW / 1456  // 1456 is the original image width

        // ── Draw NPCs ──────────────────────────────────────────────────
        npcsRef.current.forEach(npc => {
          const px = drawX + npc.x * drawW
          const py = drawY + npc.y * drawH
          const s = Math.max(0.5, scale * 8)  // NPC size in pixels

          switch (npc.type) {
            case 'car':
              drawCar(ctx, px, py, npc.color, npc.vx >= 0, s)
              break
            case 'scooter':
              drawScooter(ctx, px, py, npc.vx >= 0, s)
              break
            case 'pedestrian':
              drawPedestrian(ctx, px, py, npc.color, npc.frame, s * 0.6)
              break
            case 'boat':
              drawBoat(ctx, px, py, npc.vx >= 0, t, s * 0.7)
              break
          }
        })

        // ── Draw location overlays + bot dots ──────────────────────────
        const bots = botsByLocation()
        Object.entries(OVERVIEW_LOCATIONS).forEach(([key, loc]) => {
          const rx = drawX + loc.x * drawW
          const ry = drawY + loc.y * drawH
          const rw = loc.w * drawW
          const rh = loc.h * drawH
          const cx = drawX + loc.cx * drawW
          const cy = drawY + loc.cy * drawH
          const isHovered = hoveredRef.current === key
          const botList = bots[key] || []

          // Hover highlight overlay
          if (isHovered) {
            ctx.fillStyle = 'rgba(255,255,255,0.10)'
            ctx.strokeStyle = loc.color + 'CC'
            ctx.lineWidth = 2
            ctx.fillRect(rx, ry, rw, rh)
            ctx.strokeRect(rx, ry, rw, rh)

            // Location label
            ctx.font = 'bold 13px "Noto Sans SC", sans-serif'
            ctx.textAlign = 'center'
            const labelW = ctx.measureText(loc.label).width + 16
            ctx.fillStyle = 'rgba(0,0,0,0.75)'
            ctx.fillRect(cx - labelW / 2, cy - 22, labelW, 18)
            ctx.fillStyle = loc.color
            ctx.fillText(loc.label, cx, cy - 8)
          }

          // Bot count badge
          if (botList.length > 0) {
            const pulse = Math.sin(t * 3 + loc.cx * 10) * 0.5 + 0.5
            const ringR = 10 + pulse * 4
            ctx.strokeStyle = loc.color + '66'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
            ctx.stroke()

            ctx.fillStyle = loc.color
            ctx.beginPath()
            ctx.arc(cx, cy, 9, 0, Math.PI * 2)
            ctx.fill()

            ctx.fillStyle = '#000'
            ctx.font = 'bold 9px monospace'
            ctx.textAlign = 'center'
            ctx.fillText(String(botList.length), cx, cy + 3)

            // Orbiting bot dots
            botList.slice(0, 4).forEach((botId, i) => {
              const angle = t * 1.2 + i * (Math.PI * 2 / Math.min(botList.length, 4))
              const orbitR = 16 + i * 2
              const bx = cx + Math.cos(angle) * orbitR
              const by = cy + Math.sin(angle) * orbitR
              const botColor = BOT_COLORS[botId] || '#4D96FF'
              ctx.fillStyle = botColor
              ctx.beginPath()
              ctx.arc(bx, by, 2.5, 0, Math.PI * 2)
              ctx.fill()
            })
          }
        })
      } else {
        // Loading state
        ctx.fillStyle = 'rgba(77,150,255,0.5)'
        ctx.font = '12px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('加载地图中...', W / 2, H / 2)
      }

      // Scan line effect
      if (H > 0) {
        const scanY = (t * 60) % H
        const scanGrad = ctx.createLinearGradient(0, scanY - 15, 0, scanY + 15)
        scanGrad.addColorStop(0, 'rgba(77,150,255,0)')
        scanGrad.addColorStop(0.5, 'rgba(77,150,255,0.03)')
        scanGrad.addColorStop(1, 'rgba(77,150,255,0)')
        ctx.fillStyle = scanGrad
        ctx.fillRect(0, scanY - 15, W, 30)
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [botsByLocation])

  const getHitLocation = useCallback((e: React.MouseEvent<HTMLCanvasElement>): string | null => {
    const canvas = canvasRef.current
    if (!canvas || !bgImageRef.current) return null
    const rect = canvas.getBoundingClientRect()
    const W = rect.width, H = rect.height
    const img = bgImageRef.current
    const imgAspect = img.width / img.height
    const canvasAspect = W / H
    let drawW: number, drawH: number, drawX: number, drawY: number
    if (canvasAspect > imgAspect) {
      drawW = W; drawH = W / imgAspect; drawX = 0; drawY = (H - drawH) / 2
    } else {
      drawH = H; drawW = H * imgAspect; drawX = (W - drawW) / 2; drawY = 0
    }
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const nx = (px - drawX) / drawW
    const ny = (py - drawY) / drawH

    let found: string | null = null
    Object.entries(OVERVIEW_LOCATIONS).forEach(([key, loc]) => {
      if (nx >= loc.x && nx <= loc.x + loc.w && ny >= loc.y && ny <= loc.y + loc.h) {
        found = key
      }
    })
    return found
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const found = getHitLocation(e)
    hoveredRef.current = found
    setHoveredLocation(found)
    canvas.style.cursor = found ? 'pointer' : 'default'
  }, [getHitLocation])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const found = getHitLocation(e)
    if (found) {
      onLocationSelect(found)
    }
  }, [getHitLocation, onLocationSelect])

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />
      {hoveredLocation && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
          <div
            className="px-3 py-1 rounded text-xs font-mono border"
            style={{
              background: 'rgba(13,17,23,0.9)',
              borderColor: OVERVIEW_LOCATIONS[hoveredLocation]?.color + '66',
              color: OVERVIEW_LOCATIONS[hoveredLocation]?.color,
            }}
          >
            {OVERVIEW_LOCATIONS[hoveredLocation]?.icon} {OVERVIEW_LOCATIONS[hoveredLocation]?.label} — 点击进入
          </div>
        </div>
      )}
    </div>
  )
}
