import { memo, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

interface PlanetData {
  name: string
  au: number
  period: number
  mass: number
  moons: number
  type: string
  color: string
  radius: number
}

const PLANET_DATA: PlanetData[] = [
  { name: 'Mercury', au: 0.387, period: 87.97, mass: 0.055, moons: 0, type: 'Rocky Planet', color: '#b5b5b5', radius: 3 },
  { name: 'Venus', au: 0.723, period: 224.70, mass: 0.815, moons: 0, type: 'Terrestrial Planet', color: '#e8cda0', radius: 5 },
  { name: 'Earth', au: 1.000, period: 365.25, mass: 1.000, moons: 1, type: 'Habitable Planet', color: '#4b9cd3', radius: 5 },
  { name: 'Mars', au: 1.524, period: 686.97, mass: 0.107, moons: 2, type: 'Rocky Planet', color: '#c1440e', radius: 4 },
  { name: 'Jupiter', au: 5.203, period: 4332.59, mass: 317.8, moons: 95, type: 'Gas Giant', color: '#c88b3a', radius: 11 },
  { name: 'Saturn', au: 9.537, period: 10759.22, mass: 95.2, moons: 146, type: 'Gas Giant', color: '#e4d191', radius: 9 },
  { name: 'Uranus', au: 19.190, period: 30688.50, mass: 14.5, moons: 28, type: 'Ice Giant', color: '#7de8e8', radius: 7 },
  { name: 'Neptune', au: 30.070, period: 60195.00, mass: 17.1, moons: 16, type: 'Ice Giant', color: '#3f54ba', radius: 7 }
]

interface ZoomTarget {
  name: string
  type: string
  parentName: string | null
  color: string
  radius: number
  isMoon: boolean
  parentIdx?: number
  moonOrbitRadius?: number
  moonOrbitSpeed?: number
  moonOffsetAngle?: number
  stats: {
    diameter: string
    distanceOrOrbit: string
    mass: string
    atmosphere: string
    temp: string
    moonsCount?: string
    features: string
  }
}

const ZOOM_TARGETS: ZoomTarget[] = [
  {
    name: 'Mercury',
    type: 'Rocky Planet',
    parentName: null,
    color: '#b5b5b5',
    radius: 3,
    isMoon: false,
    stats: {
      diameter: '4,879 km',
      distanceOrOrbit: '0.387 AU from Sun',
      mass: '0.055 Earths',
      atmosphere: 'None (Exosphere)',
      temp: '-173°C to 427°C',
      moonsCount: '0',
      features: 'Extreme temperature swings, heavily cratered surface.'
    }
  },
  {
    name: 'Venus',
    type: 'Terrestrial Planet',
    parentName: null,
    color: '#e8cda0',
    radius: 5,
    isMoon: false,
    stats: {
      diameter: '12,104 km',
      distanceOrOrbit: '0.723 AU from Sun',
      mass: '0.815 Earths',
      atmosphere: 'Dense CO2 (96 bar)',
      temp: '464°C',
      moonsCount: '0',
      features: 'Runaway greenhouse effect, thick sulfuric acid clouds.'
    }
  },
  {
    name: 'Earth',
    type: 'Habitable Planet',
    parentName: null,
    color: '#4b9cd3',
    radius: 5,
    isMoon: false,
    stats: {
      diameter: '12,742 km',
      distanceOrOrbit: '1.000 AU from Sun',
      mass: '1.000 Earths',
      atmosphere: 'Nitrogen/Oxygen (1 bar)',
      temp: '15°C',
      moonsCount: '1',
      features: 'Liquid water oceans, active tectonic plates, diverse biosphere.'
    }
  },
  {
    name: 'Moon',
    type: 'Rocky Moon',
    parentName: 'Earth',
    color: '#888888',
    radius: 1.5,
    isMoon: true,
    parentIdx: 2,
    moonOrbitRadius: 13,
    moonOrbitSpeed: 3.5,
    moonOffsetAngle: 0,
    stats: {
      diameter: '3,474 km',
      distanceOrOrbit: '27.3 Days around Earth',
      mass: '0.012 Earths',
      atmosphere: 'None (Exosphere)',
      temp: '-20°C (Average)',
      features: 'Tidally locked, basaltic maria plains, ancient cratered highlands.'
    }
  },
  {
    name: 'Mars',
    type: 'Rocky Planet',
    parentName: null,
    color: '#c1440e',
    radius: 4,
    isMoon: false,
    stats: {
      diameter: '6,779 km',
      distanceOrOrbit: '1.524 AU from Sun',
      mass: '0.107 Earths',
      atmosphere: 'Thin CO2 (0.01 bar)',
      temp: '-65°C',
      moonsCount: '2',
      features: 'Iron oxide surface dust, Olympus Mons volcano, polar ice caps.'
    }
  },
  {
    name: 'Phobos',
    type: 'Rocky Moon',
    parentName: 'Mars',
    color: '#8b7e74',
    radius: 1.0,
    isMoon: true,
    parentIdx: 3,
    moonOrbitRadius: 9,
    moonOrbitSpeed: 6.0,
    moonOffsetAngle: 1.0,
    stats: {
      diameter: '22.2 km (Irregular)',
      distanceOrOrbit: '7.7 Hours around Mars',
      mass: '1.8e-8 Earths',
      atmosphere: 'None',
      temp: '-40°C',
      features: 'Captured asteroid origin, orbits extremely close to Mars.'
    }
  },
  {
    name: 'Deimos',
    type: 'Rocky Moon',
    parentName: 'Mars',
    color: '#bda89b',
    radius: 0.8,
    isMoon: true,
    parentIdx: 3,
    moonOrbitRadius: 13,
    moonOrbitSpeed: 3.8,
    moonOffsetAngle: 4.5,
    stats: {
      diameter: '12.6 km (Irregular)',
      distanceOrOrbit: '30.3 Hours around Mars',
      mass: '2.4e-9 Earths',
      atmosphere: 'None',
      temp: '-40°C',
      features: 'Smallest and outermost moon of Mars, highly cratered.'
    }
  },
  {
    name: 'Jupiter',
    type: 'Gas Giant',
    parentName: null,
    color: '#c88b3a',
    radius: 11,
    isMoon: false,
    stats: {
      diameter: '139,820 km',
      distanceOrOrbit: '5.203 AU from Sun',
      mass: '317.8 Earths',
      atmosphere: 'Hydrogen/Helium',
      temp: '-110°C',
      moonsCount: '95',
      features: 'Great Red Spot storm, massive magnetic field, largest planet.'
    }
  },
  {
    name: 'Io',
    type: 'Volcanic Moon',
    parentName: 'Jupiter',
    color: '#e3e33b',
    radius: 1.6,
    isMoon: true,
    parentIdx: 4,
    moonOrbitRadius: 21,
    moonOrbitSpeed: 4.8,
    moonOffsetAngle: 0.5,
    stats: {
      diameter: '3,643 km',
      distanceOrOrbit: '1.77 Days around Jupiter',
      mass: '0.015 Earths',
      atmosphere: 'Thin SO2 (Sulfur)',
      temp: '-130°C',
      features: 'Most geologically active body, over 400 active volcanoes.'
    }
  },
  {
    name: 'Europa',
    type: 'Icy Moon',
    parentName: 'Jupiter',
    color: '#a6d6f5',
    radius: 1.5,
    isMoon: true,
    parentIdx: 4,
    moonOrbitRadius: 26,
    moonOrbitSpeed: 3.2,
    moonOffsetAngle: 2.1,
    stats: {
      diameter: '3,121 km',
      distanceOrOrbit: '3.55 Days around Jupiter',
      mass: '0.008 Earths',
      atmosphere: 'Oxygen trace',
      temp: '-160°C',
      features: 'Subsurface liquid water ocean under a thick water-ice shell.'
    }
  },
  {
    name: 'Ganymede',
    type: 'Icy Moon',
    parentName: 'Jupiter',
    color: '#b09f8a',
    radius: 2.0,
    isMoon: true,
    parentIdx: 4,
    moonOrbitRadius: 31,
    moonOrbitSpeed: 2.2,
    moonOffsetAngle: 3.8,
    stats: {
      diameter: '5,268 km',
      distanceOrOrbit: '7.15 Days around Jupiter',
      mass: '0.025 Earths',
      atmosphere: 'Oxygen trace',
      temp: '-160°C',
      features: 'Largest moon in the Solar System, possesses an active magnetic field.'
    }
  },
  {
    name: 'Callisto',
    type: 'Icy Moon',
    parentName: 'Jupiter',
    color: '#7a776c',
    radius: 1.8,
    isMoon: true,
    parentIdx: 4,
    moonOrbitRadius: 37,
    moonOrbitSpeed: 1.5,
    moonOffsetAngle: 5.2,
    stats: {
      diameter: '4,821 km',
      distanceOrOrbit: '16.7 Days around Jupiter',
      mass: '0.018 Earths',
      atmosphere: 'Carbon dioxide trace',
      temp: '-140°C',
      features: 'Extremely cratered ancient icy surface, potential subsurface ocean.'
    }
  },
  {
    name: 'Saturn',
    type: 'Gas Giant',
    parentName: null,
    color: '#e4d191',
    radius: 9,
    isMoon: false,
    stats: {
      diameter: '116,460 km',
      distanceOrOrbit: '9.537 AU from Sun',
      mass: '95.2 Earths',
      atmosphere: 'Hydrogen/Helium',
      temp: '-140°C',
      moonsCount: '146',
      features: 'Stunning rings made of ice & rock particles, lowest density.'
    }
  },
  {
    name: 'Mimas',
    type: 'Icy Moon',
    parentName: 'Saturn',
    color: '#9c9c9c',
    radius: 1.0,
    isMoon: true,
    parentIdx: 5,
    moonOrbitRadius: 18,
    moonOrbitSpeed: 5.0,
    moonOffsetAngle: 1.2,
    stats: {
      diameter: '396 km',
      distanceOrOrbit: '22.6 Hours around Saturn',
      mass: '6.3e-6 Earths',
      atmosphere: 'None',
      temp: '-180°C',
      features: 'Dominated by the Herschel impact crater (Death Star likeness).'
    }
  },
  {
    name: 'Enceladus',
    type: 'Icy Moon',
    parentName: 'Saturn',
    color: '#eef8ff',
    radius: 1.1,
    isMoon: true,
    parentIdx: 5,
    moonOrbitRadius: 22,
    moonOrbitSpeed: 3.8,
    moonOffsetAngle: 2.9,
    stats: {
      diameter: '504 km',
      distanceOrOrbit: '32.9 Hours around Saturn',
      mass: '1.8e-5 Earths',
      atmosphere: 'Water vapor trace',
      temp: '-200°C',
      features: 'Active ice geysers at south pole venting water into space.'
    }
  },
  {
    name: 'Titan',
    type: 'Aerosol Moon',
    parentName: 'Saturn',
    color: '#e3a830',
    radius: 1.9,
    isMoon: true,
    parentIdx: 5,
    moonOrbitRadius: 28,
    moonOrbitSpeed: 2.0,
    moonOffsetAngle: 4.1,
    stats: {
      diameter: '5,149 km',
      distanceOrOrbit: '15.9 Days around Saturn',
      mass: '0.022 Earths',
      atmosphere: 'Thick Nitrogen (1.5 bar)',
      temp: '-179°C',
      features: 'Dense atmosphere, liquid methane lakes, organic haze layers.'
    }
  },
  {
    name: 'Iapetus',
    type: 'Icy Moon',
    parentName: 'Saturn',
    color: '#54463d',
    radius: 1.3,
    isMoon: true,
    parentIdx: 5,
    moonOrbitRadius: 35,
    moonOrbitSpeed: 0.8,
    moonOffsetAngle: 5.6,
    stats: {
      diameter: '1,469 km',
      distanceOrOrbit: '79.3 Days around Saturn',
      mass: '3.0e-4 Earths',
      atmosphere: 'None',
      temp: '-150°C',
      features: 'Stark two-toned dark/light color split, equatorial ridge.'
    }
  },
  {
    name: 'Uranus',
    type: 'Ice Giant',
    parentName: null,
    color: '#7de8e8',
    radius: 7,
    isMoon: false,
    stats: {
      diameter: '50,724 km',
      distanceOrOrbit: '19.19 AU from Sun',
      mass: '14.5 Earths',
      atmosphere: 'H2/He/CH4',
      temp: '-195°C',
      moonsCount: '28',
      features: 'Tilted 98 degrees on its axis, vertical rings, coldest planet.'
    }
  },
  {
    name: 'Neptune',
    type: 'Ice Giant',
    parentName: null,
    color: '#3f54ba',
    radius: 7,
    isMoon: false,
    stats: {
      diameter: '49,244 km',
      distanceOrOrbit: '30.07 AU from Sun',
      mass: '17.1 Earths',
      atmosphere: 'H2/He/CH4',
      temp: '-200°C',
      moonsCount: '16',
      features: 'Deep blue color, supersonic winds up to 2,100 km/h.'
    }
  },
  {
    name: 'Triton',
    type: 'Cryovolcanic Moon',
    parentName: 'Neptune',
    color: '#9ec9cf',
    radius: 1.4,
    isMoon: true,
    parentIdx: 7,
    moonOrbitRadius: 24,
    moonOrbitSpeed: -2.5,
    moonOffsetAngle: 1.8,
    stats: {
      diameter: '2,706 km',
      distanceOrOrbit: '5.87 Days around Neptune',
      mass: '0.0037 Earths',
      atmosphere: 'Nitrogen trace',
      temp: '-235°C',
      features: 'Only large moon with retrograde orbit, active nitrogen geysers.'
    }
  }
]

const DAYS_PER_MS = 365.25 / (12 * 1000)
const MAX_AU = 30.07

function orbitRadius(au: number, minOrbit: number, maxOrbit: number): number {
  return minOrbit + (maxOrbit - minOrbit) * Math.sqrt(au / MAX_AU)
}

const STARS: { x: number; y: number }[] = Array.from({ length: 200 }, () => ({
  x: Math.random(),
  y: Math.random()
}))

type ZoomPhase = 'idle' | 'zooming_in' | 'watching' | 'zooming_out'

interface ZoomState {
  phase: ZoomPhase
  targetIdx: number
  progress: number
  watchTimer: number
  idleTimer: number
}

const ZOOM_IDLE_MS = 6000
const ZOOM_IN_MS = 1500
const ZOOM_WATCH_MS = 6000
const ZOOM_OUT_MS = 1500
const ZOOM_TARGET = 8
const ZOOM_OVERVIEW = 1

function easeInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(t * Math.PI)
}

function drawInfoBox(
  ctx: CanvasRenderingContext2D,
  target: ZoomTarget,
  W: number,
  H: number,
  alpha: number
) {
  const minDim = Math.min(W, H)
  const fontSize = Math.max(10, Math.min(13, Math.round(minDim * 0.026)))
  const titleSize = fontSize + 3
  const lineH = fontSize + 6
  const padX = 14
  const padY = 12

  const lines = [
    `Classification: ${target.type}`,
    `Dimension: ${target.stats.diameter}`,
    `Orbital Info: ${target.stats.distanceOrOrbit}`,
    `Mass Index: ${target.stats.mass}`,
    `Atmosphere: ${target.stats.atmosphere}`,
    `Surface Temp: ${target.stats.temp}`
  ]

  if (!target.isMoon && target.stats.moonsCount) {
    lines.push(`Known Moons: ${target.stats.moonsCount}`)
  }

  // Measure widths using modern proportional fonts (system sans-serif)
  ctx.font = `bold ${titleSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  let maxW = ctx.measureText(`${target.name} ${target.isMoon ? `(Moon of ${target.parentName})` : ''}`).width
  
  ctx.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  for (const line of lines) {
    maxW = Math.max(maxW, ctx.measureText(line).width)
  }
  
  // Also measure features block
  const featMaxW = Math.min(320, W * 0.4)
  
  const boxW = Math.max(maxW, featMaxW) + padX * 2
  
  // Calculate height including features text wrap
  let boxH = 30 + lines.length * lineH + padY * 2 + 30

  // Placed centered horizontally on the right half
  const bx = W * 0.72 - boxW / 2
  const by = (H - boxH) / 2

  // Background Glassmorphism layout
  ctx.globalAlpha = alpha * 0.82
  ctx.fillStyle = '#0a0d18'
  ctx.fillRect(bx, by, boxW, boxH)

  // Glowing Steel Blue / Amber tactical border
  ctx.globalAlpha = alpha * 0.95
  ctx.strokeStyle = target.isMoon ? '#d97706' : '#2563eb' // Amber for moons, Blue for planets
  ctx.lineWidth = 1.5
  ctx.strokeRect(bx, by, boxW, boxH)

  // Title
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${titleSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  ctx.fillText(
    `${target.name}${target.isMoon ? ` (${target.parentName} Satellite)` : ''}`,
    bx + padX,
    by + padY
  )

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(bx + padX, by + padY + titleSize + 5)
  ctx.lineTo(bx + boxW - padX, by + padY + titleSize + 5)
  ctx.stroke()

  // Stats Text
  let cy = by + padY + titleSize + 14
  ctx.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  
  lines.forEach((line) => {
    const parts = line.split(':')
    const key = parts[0] + ':'
    const val = parts.slice(1).join(':')
    
    ctx.fillStyle = '#94a3b8' // Slate label
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.fillText(key, bx + padX, cy)
    
    const keyW = ctx.measureText(key).width
    ctx.fillStyle = '#f8fafc' // Slate light value
    ctx.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.fillText(val, bx + padX + keyW, cy)
    
    cy += lineH
  })

  // Features description wrap
  cy += 4
  ctx.fillStyle = target.isMoon ? '#fde047' : '#93c5fd' // Golden text for moons, light blue for planets
  ctx.font = `italic ${fontSize - 0.5}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  
  const words = target.stats.features.split(' ')
  let currentLine = ''
  for (const word of words) {
    const test = currentLine + word + ' '
    if (ctx.measureText(test).width > boxW - padX * 2) {
      ctx.fillText(currentLine, bx + padX, cy)
      currentLine = word + ' '
      cy += fontSize + 2
    } else {
      currentLine = test
    }
  }
  ctx.fillText(currentLine, bx + padX, cy)

  ctx.globalAlpha = 1
}

function SolarSystemPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    let unsubscribe: (() => void) | null = null
    let running = true

    const resize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const startTime = performance.now()
    let prevTime = startTime

    const zoom: ZoomState = {
      phase: 'idle',
      targetIdx: 0,
      progress: 0,
      watchTimer: 0,
      idleTimer: 0
    }

    let viewZoom = ZOOM_OVERVIEW
    let viewCenterX = 0
    let viewCenterY = 0

    let overviewCenterX = 0
    let overviewCenterY = 0

    function loop(now: number) {
      if (!running) return

      const W = canvas!.width
      const H = canvas!.height
      if (W === 0 || H === 0) return

      const dt = now - prevTime
      prevTime = now

      const elapsedMs = now - startTime
      const simDays = elapsedMs * DAYS_PER_MS

      const cx = W / 2
      const cy = H / 2
      const minDim = Math.min(W, H)
      const sunR = minDim * 0.05
      const minOrbit = sunR + 14
      const maxOrbit = minDim * 0.44

      // ── Calculate Planets coordinates ──────────────────────────────────────
      const START_ANGLES = [4.4, 2.1, 0.0, 5.5, 0.8, 2.3, 4.0, 5.0]
      const planetPositions = PLANET_DATA.map((p, i) => {
        const orbitR = orbitRadius(p.au, minOrbit, maxOrbit)
        const angle = START_ANGLES[i] + (simDays / p.period) * Math.PI * 2
        return {
          wx: Math.cos(angle) * orbitR,
          wy: Math.sin(angle) * orbitR,
          orbitR
        }
      })

      // ── Calculate Zoom Target coordinates ──────────────────────────────────
      const activeTarget = ZOOM_TARGETS[zoom.targetIdx]
      let targetWx = 0
      let targetWy = 0

      if (activeTarget.isMoon && activeTarget.parentIdx !== undefined) {
        const parentPos = planetPositions[activeTarget.parentIdx]
        const moonAngle = (activeTarget.moonOffsetAngle || 0) + (simDays / (activeTarget.moonOrbitSpeed || 1)) * 0.08
        targetWx = parentPos.wx + Math.cos(moonAngle) * (activeTarget.moonOrbitRadius || 12)
        targetWy = parentPos.wy + Math.sin(moonAngle) * (activeTarget.moonOrbitRadius || 12)
      } else {
        const idx = PLANET_DATA.findIndex(p => p.name === activeTarget.name)
        if (idx !== -1) {
          targetWx = planetPositions[idx].wx
          targetWy = planetPositions[idx].wy
        }
      }

      // ── Zoom State Machine ────────────────────────────────────────────────
      if (zoom.phase === 'idle') {
        zoom.idleTimer += dt
        if (zoom.idleTimer >= ZOOM_IDLE_MS) {
          zoom.targetIdx = (zoom.targetIdx + 1) % ZOOM_TARGETS.length
          zoom.idleTimer = 0
          zoom.progress = 0
          zoom.phase = 'zooming_in'
          overviewCenterX = viewCenterX
          overviewCenterY = viewCenterY
        }
      } else if (zoom.phase === 'zooming_in') {
        zoom.progress += dt / ZOOM_IN_MS
        if (zoom.progress >= 1) {
          zoom.progress = 1
          zoom.watchTimer = 0
          zoom.phase = 'watching'
        }
        // Offset camera slightly to place the zoomed body in the left half
        const shiftX = (W * 0.20) / ZOOM_TARGET
        const t = easeInOut(zoom.progress)
        viewZoom = ZOOM_OVERVIEW + (ZOOM_TARGET - ZOOM_OVERVIEW) * t
        viewCenterX = overviewCenterX + (targetWx + shiftX - overviewCenterX) * t
        viewCenterY = overviewCenterY + (targetWy - overviewCenterY) * t
      } else if (zoom.phase === 'watching') {
        zoom.watchTimer += dt
        const shiftX = (W * 0.20) / ZOOM_TARGET
        viewZoom = ZOOM_TARGET
        viewCenterX = targetWx + shiftX
        viewCenterY = targetWy
        if (zoom.watchTimer >= ZOOM_WATCH_MS) {
          zoom.progress = 0
          zoom.phase = 'zooming_out'
          overviewCenterX = viewCenterX
          overviewCenterY = viewCenterY
        }
      } else if (zoom.phase === 'zooming_out') {
        zoom.progress += dt / ZOOM_OUT_MS
        if (zoom.progress >= 1) {
          zoom.progress = 1
          zoom.idleTimer = 0
          zoom.phase = 'idle'
        }
        const t = easeInOut(zoom.progress)
        viewZoom = ZOOM_TARGET + (ZOOM_OVERVIEW - ZOOM_TARGET) * t
        viewCenterX = overviewCenterX + (0 - overviewCenterX) * t
        viewCenterY = overviewCenterY + (0 - overviewCenterY) * t
      }

      // Projection mapping Helper
      const toScreen = (wx: number, wy: number): [number, number] => [
        cx + (wx - viewCenterX) * viewZoom,
        cy + (wy - viewCenterY) * viewZoom
      ]

      // Background
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // Starfield Parallax stars
      ctx.fillStyle = 'rgba(255,255,255,0.48)'
      for (const star of STARS) {
        const sx = star.x * W - viewCenterX * viewZoom * 0.08
        const sy = star.y * H - viewCenterY * viewZoom * 0.08
        const swx = ((sx % W) + W) % W
        const swy = ((sy % H) + H) % H
        ctx.beginPath()
        ctx.arc(swx, swy, 0.7, 0, Math.PI * 2)
        ctx.fill()
      }

      // Sun
      const [sunSx, sunSy] = toScreen(0, 0)
      const scaledSunR = sunR * viewZoom
      
      const glow = ctx.createRadialGradient(sunSx, sunSy, scaledSunR * 0.6, sunSx, sunSy, scaledSunR * 1.5)
      glow.addColorStop(0, 'rgba(255,180,60,0.3)')
      glow.addColorStop(0.5, 'rgba(255,100,0,0.1)')
      glow.addColorStop(1, 'rgba(255,50,0,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(sunSx, sunSy, scaledSunR * 1.5, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ff7b00'
      ctx.beginPath()
      ctx.arc(sunSx, sunSy, scaledSunR, 0, Math.PI * 2)
      ctx.fill()

      // ── Render Planetary Orbits ───────────────────────────────────────────
      PLANET_DATA.forEach((_, i) => {
        const { orbitR } = planetPositions[i]
        const scaledOrbitR = orbitR * viewZoom
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)'
        ctx.lineWidth = 1.0
        ctx.beginPath()
        ctx.arc(sunSx, sunSy, scaledOrbitR, 0, Math.PI * 2)
        ctx.stroke()
      })

      // ── Render Planets and Moons ──────────────────────────────────────────
      PLANET_DATA.forEach((planet, i) => {
        const { wx, wy } = planetPositions[i]
        const [px, py] = toScreen(wx, wy)
        const scaledRadius = Math.max(1.8, planet.radius * Math.sqrt(viewZoom) * 0.7)

        // Draw Saturn Rings
        if (planet.name === 'Saturn') {
          ctx.save()
          ctx.translate(px, py)
          ctx.strokeStyle = 'rgba(228, 209, 145, 0.45)'
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.ellipse(0, 0, scaledRadius * 2.1, scaledRadius * 0.45, -0.15, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }

        // Draw Planet Body
        ctx.fillStyle = planet.color
        ctx.beginPath()
        ctx.arc(px, py, scaledRadius, 0, Math.PI * 2)
        ctx.fill()

        // Planet Label overlay (overview mode or focused)
        const isFocused = zoom.phase === 'watching' && ZOOM_TARGETS[zoom.targetIdx].name === planet.name
        if (viewZoom < 2 || isFocused) {
          ctx.font = '10px monospace'
          ctx.fillStyle = '#94a3b8'
          ctx.textAlign = 'center'
          ctx.fillText(planet.name, px, py - scaledRadius - 5)
        }

        // ── Render Moons for this Planet ────────────────────────────────────
        ZOOM_TARGETS.forEach((target) => {
          if (target.isMoon && target.parentIdx === i) {
            const moonAngle = (target.moonOffsetAngle || 0) + (simDays / (target.moonOrbitSpeed || 1)) * 0.08
            const mwx = wx + Math.cos(moonAngle) * (target.moonOrbitRadius || 12)
            const mwy = wy + Math.sin(moonAngle) * (target.moonOrbitRadius || 12)
            const [mx, my] = toScreen(mwx, mwy)
            
            const scaledMoonOrbitR = (target.moonOrbitRadius || 12) * viewZoom

            // Draw moon orbit path (only when somewhat zoomed in on parent or moon)
            if (viewZoom > 2) {
              ctx.strokeStyle = 'rgba(74, 85, 104, 0.08)'
              ctx.lineWidth = 0.5
              ctx.beginPath()
              ctx.arc(px, py, scaledMoonOrbitR, 0, Math.PI * 2)
              ctx.stroke()
            }

            // Draw Moon body
            ctx.fillStyle = target.color
            ctx.beginPath()
            ctx.arc(mx, my, Math.max(1.0, target.radius * Math.sqrt(viewZoom) * 0.6), 0, Math.PI * 2)
            ctx.fill()

            // Moon Label when focused
            const isMoonFocused = zoom.phase === 'watching' && ZOOM_TARGETS[zoom.targetIdx].name === target.name
            if (isMoonFocused) {
              ctx.font = '9px monospace'
              ctx.fillStyle = '#f59e0b'
              ctx.textAlign = 'center'
              ctx.fillText(target.name, mx, my - 6)
            }
          }
        })
      })

      // ── Reticle Over Target ────────────────────────────────────────────────
      if (zoom.phase === 'watching' || zoom.phase === 'zooming_in' || zoom.phase === 'zooming_out') {
        const [tx, ty] = toScreen(targetWx, targetWy)
        const reticleR = Math.max(12, 14 * viewZoom)
        
        ctx.strokeStyle = activeTarget.isMoon ? '#d97706' : '#2563eb'
        ctx.lineWidth = 0.8
        
        // Target corner brackets
        ctx.beginPath()
        ctx.moveTo(tx - reticleR, ty - reticleR + 4); ctx.lineTo(tx - reticleR, ty - reticleR); ctx.lineTo(tx - reticleR + 4, ty - reticleR)
        ctx.moveTo(tx + reticleR, ty - reticleR + 4); ctx.lineTo(tx + reticleR, ty - reticleR); ctx.lineTo(tx + reticleR - 4, ty - reticleR)
        ctx.moveTo(tx - reticleR, ty + reticleR - 4); ctx.lineTo(tx - reticleR, ty + reticleR); ctx.lineTo(tx - reticleR + 4, ty + reticleR)
        ctx.moveTo(tx + reticleR, ty + reticleR - 4); ctx.lineTo(tx + reticleR, ty + reticleR); ctx.lineTo(tx + reticleR - 4, ty + reticleR)
        ctx.stroke()

        // Core dot
        ctx.fillStyle = activeTarget.isMoon ? '#d97706' : '#2563eb'
        ctx.beginPath()
        ctx.arc(tx, ty, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Info Overlay Box ──────────────────────────────────────────────────
      let infoAlpha = 0
      if (zoom.phase === 'watching') {
        infoAlpha = Math.min(1, zoom.watchTimer / 300)
      } else if (zoom.phase === 'zooming_out') {
        infoAlpha = Math.max(0, 1 - zoom.progress * (ZOOM_OUT_MS / 400))
      }

      if (infoAlpha > 0.01) {
        drawInfoBox(ctx, activeTarget, W, H, infoAlpha)
      }

      // ── Solar System Telemetry HUD ─────────────────────────────────────────
      ctx.fillStyle = 'rgba(74,222,128,0.5)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText('SOLAR SYSTEM // ORBITAL SCANNER ACTIVE', 10, H - 10)

      ctx.textAlign = 'right'
      ctx.fillText(
        `TOTAL BODIES CLASSIFIED: 8 PLANETS // 435+ MOONS // FEATURED SATELLITES: 12`,
        W - 10,
        H - 10
      )
    }

    unsubscribe = subscribe(loop)

    return () => {
      running = false
      if (unsubscribe) unsubscribe()
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="HELIOCENTRIC ORBIT MODEL // LIVE TELEMETRY SURVEY">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}

export default memo(SolarSystemPanel)
