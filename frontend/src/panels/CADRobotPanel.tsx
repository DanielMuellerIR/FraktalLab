import { memo, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ─────────────────────────────────────────────────────────────────────────────
// CADRobotPanel: Simuliert eine CAD-Software — vier 3D-Wireframe-Figuren
// rotieren automatisch auf einer Drehbühne. Kein WebGL, nur Canvas 2D mit
// einfacher Rotation (Euler) + perspektivischer Projektion.
// Die Flächen werden mit Farbkategorien (Materialien), Painter's Algorithm
// und diffusem Licht in einem Farbschema (Metall, Kupfer, Orange, Neon-Blau) schattiert.
// ─────────────────────────────────────────────────────────────────────────────

interface Vec3 { x: number; y: number; z: number }
interface Edge {
  a: number
  b: number
  colorType?: 'base' | 'accent' | 'joint' | 'visor' | 'energy'
}
interface Face {
  verts: number[]
  colorType?: 'base' | 'accent' | 'joint' | 'visor' | 'energy'
}

interface ModelDef {
  name: string
  polyCount: number
  dimensions: string
  vertices: Vec3[]
  edges: Edge[]
  faces: Face[]
}

// ─────────────────────────────────────────────────────────────────────────────
// ROTATIONSMATRIX
// ─────────────────────────────────────────────────────────────────────────────
function rotateVec3(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
  // X-Achse
  const y = v.y * Math.cos(rx) - v.z * Math.sin(rx)
  const z = v.y * Math.sin(rx) + v.z * Math.cos(rx)
  const x = v.x

  // Y-Achse
  const x2 = x * Math.cos(ry) + z * Math.sin(ry)
  const z2 = -x * Math.sin(ry) + z * Math.cos(ry)

  // Z-Achse
  const x3 = x2 * Math.cos(rz) - y * Math.sin(rz)
  const y3 = x2 * Math.sin(rz) + y * Math.cos(rz)

  return { x: x3, y: y3, z: z2 }
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSPEKTIVISCHE PROJEKTION
// ─────────────────────────────────────────────────────────────────────────────
function project(
  v: Vec3,
  cx: number,
  cy: number,
  scale: number,
  focalLen: number
): { sx: number; sy: number } {
  const zShifted = v.z + focalLen
  const perspDiv = focalLen / Math.max(zShifted, 0.001)
  return {
    sx: cx + v.x * scale * perspDiv,
    sy: cy - v.y * scale * perspDiv,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HILFSFUNKTIONEN FÜR GEOMETRIE
// ─────────────────────────────────────────────────────────────────────────────
function makeBox(
  cx: number, cy: number, cz: number,
  hw: number, hh: number, hd: number,
  offset: number,
  colorType: 'base' | 'accent' | 'joint' | 'visor' | 'energy' = 'base'
): { verts: Vec3[]; edges: Edge[]; faces: Face[] } {
  const verts: Vec3[] = [
    { x: cx - hw, y: cy - hh, z: cz - hd },
    { x: cx + hw, y: cy - hh, z: cz - hd },
    { x: cx + hw, y: cy + hh, z: cz - hd },
    { x: cx - hw, y: cy + hh, z: cz - hd },
    { x: cx - hw, y: cy - hh, z: cz + hd },
    { x: cx + hw, y: cy - hh, z: cz + hd },
    { x: cx + hw, y: cy + hh, z: cz + hd },
    { x: cx - hw, y: cy + hh, z: cz + hd },
  ]
  const o = offset
  const edges: Edge[] = [
    { a: o + 0, b: o + 1, colorType }, { a: o + 1, b: o + 2, colorType }, { a: o + 2, b: o + 3, colorType }, { a: o + 3, b: o + 0, colorType },
    { a: o + 4, b: o + 5, colorType }, { a: o + 5, b: o + 6, colorType }, { a: o + 6, b: o + 7, colorType }, { a: o + 7, b: o + 4, colorType },
    { a: o + 0, b: o + 4, colorType }, { a: o + 1, b: o + 5, colorType }, { a: o + 2, b: o + 6, colorType }, { a: o + 3, b: o + 7, colorType },
  ]
  const faces: Face[] = [
    { verts: [o + 0, o + 3, o + 2, o + 1], colorType },
    { verts: [o + 5, o + 6, o + 7, o + 4], colorType },
    { verts: [o + 0, o + 1, o + 5, o + 4], colorType },
    { verts: [o + 3, o + 7, o + 6, o + 2], colorType },
    { verts: [o + 0, o + 4, o + 7, o + 3], colorType },
    { verts: [o + 1, o + 2, o + 6, o + 5], colorType },
  ]
  return { verts, edges, faces }
}

function makeRing(
  cx: number, cy: number, cz: number,
  r: number,
  n: number,
  plane: 'xy' | 'xz' | 'yz',
  offset: number,
  colorType: 'base' | 'accent' | 'joint' | 'visor' | 'energy' = 'base'
): { verts: Vec3[]; edges: Edge[] } {
  const verts: Vec3[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const cos = Math.cos(a) * r
    const sin = Math.sin(a) * r
    if (plane === 'xz') verts.push({ x: cx + cos, y: cy, z: cz + sin })
    else if (plane === 'yz') verts.push({ x: cx, y: cy + cos, z: cz + sin })
    else verts.push({ x: cx + cos, y: cy + sin, z: cz })
  }
  const edges: Edge[] = []
  for (let i = 0; i < n; i++) {
    edges.push({ a: offset + i, b: offset + ((i + 1) % n), colorType })
  }
  return { verts, edges }
}

function makeRingStrip(
  n: number,
  offsetA: number,
  offsetB: number,
  colorType: 'base' | 'accent' | 'joint' | 'visor' | 'energy' = 'base'
): Face[] {
  const faces: Face[] = []
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    faces.push({ verts: [offsetA + i, offsetA + next, offsetB + next, offsetB + i], colorType })
  }
  return faces
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELL-BUILDER MIT GEZIELTEN MATERIAL-TYPEN
// ─────────────────────────────────────────────────────────────────────────────

function buildHumanoidRobot(): { vertices: Vec3[]; edges: Edge[]; faces: Face[] } {
  const verts: Vec3[] = []
  const edges: Edge[] = []
  const faces: Face[] = []

  function addBox(cx: number, cy: number, cz: number, hw: number, hh: number, hd: number, colorType: 'base' | 'accent' | 'joint' | 'visor' | 'energy' = 'base') {
    const { verts: bv, edges: be, faces: bf } = makeBox(cx, cy, cz, hw, hh, hd, verts.length, colorType)
    verts.push(...bv)
    edges.push(...be)
    faces.push(...bf)
  }

  // Torso
  addBox(0, 0.1, 0, 0.22, 0.30, 0.12, 'base')
  // Schulterplatten (Akzente)
  addBox(-0.25, 0.32, 0, 0.08, 0.06, 0.10, 'accent')
  addBox(0.25, 0.32, 0, 0.08, 0.06, 0.10, 'accent')

  // Kopf
  addBox(0, 0.58, 0, 0.13, 0.13, 0.12, 'base')

  // Hals (Kupfer-Joint)
  const neckBase = verts.length
  verts.push({ x: -0.04, y: 0.40, z: 0 }, { x: 0.04, y: 0.40, z: 0 })
  verts.push({ x: -0.04, y: 0.44, z: 0 }, { x: 0.04, y: 0.44, z: 0 })
  edges.push(
    { a: neckBase, b: neckBase + 1, colorType: 'joint' },
    { a: neckBase, b: neckBase + 2, colorType: 'joint' },
    { a: neckBase + 1, b: neckBase + 3, colorType: 'joint' },
    { a: neckBase + 2, b: neckBase + 3, colorType: 'joint' },
  )
  faces.push({ verts: [neckBase, neckBase + 1, neckBase + 3, neckBase + 2], colorType: 'joint' })

  // Beine
  addBox(-0.13, -0.30, 0, 0.07, 0.18, 0.08, 'base') // Oberschenkel L
  addBox(-0.13, -0.62, 0, 0.06, 0.15, 0.07, 'base') // Unterschenkel L
  addBox(-0.13, -0.82, 0, 0.09, 0.05, 0.12, 'accent') // Fuß L

  addBox(0.13, -0.30, 0, 0.07, 0.18, 0.08, 'base') // Oberschenkel R
  addBox(0.13, -0.62, 0, 0.06, 0.15, 0.07, 'base') // Unterschenkel R
  addBox(0.13, -0.82, 0, 0.09, 0.05, 0.12, 'accent') // Fuß R

  // Arme
  addBox(-0.35, 0.15, 0, 0.05, 0.14, 0.05, 'base') // Oberarm L
  addBox(-0.35, -0.12, 0, 0.04, 0.12, 0.04, 'base') // Unterarm L
  addBox(-0.35, -0.28, 0, 0.06, 0.04, 0.06, 'accent') // Hand L

  addBox(0.35, 0.15, 0, 0.05, 0.14, 0.05, 'base') // Oberarm R
  addBox(0.35, -0.12, 0, 0.04, 0.12, 0.04, 'base') // Unterarm R
  addBox(0.35, -0.28, 0, 0.06, 0.04, 0.06, 'accent') // Hand R

  // Augen (leuchtendes Cyan Visier)
  addBox(-0.05, 0.60, -0.12, 0.03, 0.03, 0.015, 'visor')
  addBox(0.05, 0.60, -0.12, 0.03, 0.03, 0.015, 'visor')

  // Brust-Reaktor (Gold/Energie)
  addBox(0, 0.18, -0.12, 0.06, 0.06, 0.015, 'energy')

  // Antenne auf dem Kopf
  const antennaBase = verts.length
  verts.push(
    { x: 0, y: 0.71, z: 0 },
    { x: 0, y: 0.90, z: 0 },
    { x: -0.04, y: 0.83, z: 0 },
    { x: 0.04, y: 0.83, z: 0 },
  )
  edges.push(
    { a: antennaBase, b: antennaBase + 1, colorType: 'visor' },
    { a: antennaBase + 2, b: antennaBase + 3, colorType: 'visor' },
  )

  return { vertices: verts, edges, faces }
}

function buildAlien(): { vertices: Vec3[]; edges: Edge[]; faces: Face[] } {
  const verts: Vec3[] = []
  const edges: Edge[] = []
  const faces: Face[] = []

  // Kopf aus Ringen (Alien Grey-Ästhetik)
  const headRings = [
    { y: 0.80, r: 0.04, n: 8, mat: 'base' as const },
    { y: 0.72, r: 0.10, n: 10, mat: 'base' as const },
    { y: 0.62, r: 0.16, n: 12, mat: 'accent' as const },
    { y: 0.52, r: 0.19, n: 14, mat: 'accent' as const },
    { y: 0.42, r: 0.18, n: 14, mat: 'base' as const },
    { y: 0.32, r: 0.15, n: 12, mat: 'base' as const },
    { y: 0.22, r: 0.11, n: 10, mat: 'base' as const },
    { y: 0.14, r: 0.07, n: 8, mat: 'base' as const },
  ]

  const ringStartIndices: number[] = []
  for (const ring of headRings) {
    ringStartIndices.push(verts.length)
    const { verts: rv, edges: re } = makeRing(0, ring.y, 0, ring.r, ring.n, 'xz', verts.length, ring.mat)
    verts.push(...rv)
    edges.push(...re)
  }

  // Längsverbindungen Kopf
  for (let ri = 0; ri + 1 < headRings.length; ri++) {
    const rA = headRings[ri]
    const rB = headRings[ri + 1]
    const nConn = Math.min(rA.n, rB.n)
    const startA = ringStartIndices[ri]
    const startB = ringStartIndices[ri + 1]
    const mat = rA.mat
    for (let k = 0; k < nConn; k += 2) {
      edges.push({ a: startA + k, b: startB + k, colorType: mat })
    }
    faces.push(...makeRingStrip(nConn, startA, startB, mat))
  }

  // Riesige leuchtende Käferaugen (Visier-Klasse)
  const eyeL = makeRing(-0.08, 0.30, -0.12, 0.08, 10, 'xy', verts.length, 'visor')
  verts.push(...eyeL.verts); edges.push(...eyeL.edges)
  const eyeR = makeRing(0.08, 0.30, -0.12, 0.08, 10, 'xy', verts.length, 'visor')
  verts.push(...eyeR.verts); edges.push(...eyeR.edges)

  // Hals (Kupfer-Joints)
  const neckRings = [
    { y: 0.08, r: 0.04, n: 6 },
    { y: 0.00, r: 0.04, n: 6 },
    { y: -0.08, r: 0.04, n: 6 },
  ]
  const neckStarts: number[] = []
  for (const ring of neckRings) {
    neckStarts.push(verts.length)
    const { verts: rv, edges: re } = makeRing(0, ring.y, 0, ring.r, ring.n, 'xz', verts.length, 'joint')
    verts.push(...rv); edges.push(...re)
  }
  for (let ri = 0; ri + 1 < neckRings.length; ri++) {
    const n = neckRings[ri].n
    for (let k = 0; k < n; k++) {
      edges.push({ a: neckStarts[ri] + k, b: neckStarts[ri + 1] + k, colorType: 'joint' })
    }
    faces.push(...makeRingStrip(n, neckStarts[ri], neckStarts[ri + 1], 'joint'))
  }

  // Schmaler Torso
  const { verts: tv, edges: te, faces: tf } = makeBox(0, -0.28, 0, 0.12, 0.18, 0.08, verts.length, 'base')
  verts.push(...tv); edges.push(...te); faces.push(...tf)

  // Arme und Beine (dünne Linien mit Kupfergelenken)
  const limbMat = 'base'
  const armL = verts.length
  verts.push(
    { x: -0.12, y: -0.12, z: 0 },
    { x: -0.24, y: -0.25, z: 0 },
    { x: -0.28, y: -0.42, z: 0 },
  )
  edges.push(
    { a: armL, b: armL + 1, colorType: limbMat },
    { a: armL + 1, b: armL + 2, colorType: 'joint' },
  )

  const armR = verts.length
  verts.push(
    { x: 0.12, y: -0.12, z: 0 },
    { x: 0.24, y: -0.25, z: 0 },
    { x: 0.28, y: -0.42, z: 0 },
  )
  edges.push(
    { a: armR, b: armR + 1, colorType: limbMat },
    { a: armR + 1, b: armR + 2, colorType: 'joint' },
  )

  const legL = verts.length
  verts.push(
    { x: -0.08, y: -0.46, z: 0 },
    { x: -0.14, y: -0.65, z: 0.04 },
    { x: -0.14, y: -0.85, z: 0.0 },
  )
  edges.push(
    { a: legL, b: legL + 1, colorType: limbMat },
    { a: legL + 1, b: legL + 2, colorType: 'joint' },
  )

  const legR = verts.length
  verts.push(
    { x: 0.08, y: -0.46, z: 0 },
    { x: 0.14, y: -0.65, z: 0.04 },
    { x: 0.14, y: -0.85, z: 0.0 },
  )
  edges.push(
    { a: legR, b: legR + 1, colorType: limbMat },
    { a: legR + 1, b: legR + 2, colorType: 'joint' },
  )

  return { vertices: verts, edges, faces }
}

function buildCombatMech(): { vertices: Vec3[]; edges: Edge[]; faces: Face[] } {
  const verts: Vec3[] = []
  const edges: Edge[] = []
  const faces: Face[] = []

  function addBox(cx: number, cy: number, cz: number, hw: number, hh: number, hd: number, colorType: 'base' | 'accent' | 'joint' | 'visor' | 'energy' = 'base') {
    const { verts: bv, edges: be, faces: bf } = makeBox(cx, cy, cz, hw, hh, hd, verts.length, colorType)
    verts.push(...bv); edges.push(...be); faces.push(...bf)
  }

  // Wuchtiger Torso
  addBox(0, 0.15, 0, 0.32, 0.24, 0.20, 'base')
  addBox(0, -0.12, 0, 0.24, 0.10, 0.16, 'base')

  // Große schwere Schultergelenke (Kupfer/Joints) + Schulterpanzer (Rot/Akzent)
  addBox(-0.40, 0.22, 0, 0.09, 0.08, 0.12, 'accent')
  addBox(0.40, 0.22, 0, 0.09, 0.08, 0.12, 'accent')

  // Arme mit dicken Kanonen (Schadenslaser in Orange/Energy)
  addBox(-0.42, 0.00, 0, 0.06, 0.14, 0.06, 'base') // L Oberarm
  addBox(-0.42, -0.22, 0.04, 0.05, 0.12, 0.05, 'base') // L Unterarm
  addBox(-0.42, -0.36, 0.08, 0.04, 0.04, 0.15, 'energy') // L Plasmakanone

  addBox(0.42, 0.00, 0, 0.06, 0.14, 0.06, 'base') // R Oberarm
  addBox(0.42, -0.22, 0.04, 0.05, 0.12, 0.05, 'base') // R Unterarm
  addBox(0.42, -0.36, 0.08, 0.04, 0.04, 0.15, 'energy') // R Plasmakanone

  // Kopf / Pilotenkanzel (Großes leuchtendes Visier)
  addBox(0, 0.44, 0.05, 0.15, 0.12, 0.15, 'base')
  addBox(0, 0.42, -0.11, 0.10, 0.06, 0.02, 'visor') // Visier

  // Schwere Beine
  addBox(-0.16, -0.34, 0, 0.10, 0.16, 0.10, 'base') // Oberschenkel L
  addBox(-0.16, -0.62, 0.04, 0.08, 0.14, 0.08, 'base') // Unterschenkel L
  addBox(-0.16, -0.80, 0.06, 0.12, 0.06, 0.14, 'accent') // Riesenfuß L

  addBox(0.16, -0.34, 0, 0.10, 0.16, 0.10, 'base') // Oberschenkel R
  addBox(0.16, -0.62, 0.04, 0.08, 0.14, 0.08, 'base') // Unterschenkel R
  addBox(0.16, -0.80, 0.06, 0.12, 0.06, 0.14, 'accent') // Riesenfuß R

  return { vertices: verts, edges, faces }
}

function buildSpiderBot(): { vertices: Vec3[]; edges: Edge[]; faces: Face[] } {
  const verts: Vec3[] = []
  const edges: Edge[] = []
  const faces: Face[] = []

  // Runder Rumpf (aus Ringen)
  const torsoRings = [
    { y: 0.06, r: 0.22, n: 14, mat: 'base' as const },
    { y: 0.00, r: 0.26, n: 14, mat: 'accent' as const },
    { y: -0.06, r: 0.22, n: 14, mat: 'base' as const },
  ]
  const torsoStarts: number[] = []
  for (const ring of torsoRings) {
    torsoStarts.push(verts.length)
    const { verts: rv, edges: re } = makeRing(0, ring.y, 0, ring.r, ring.n, 'xz', verts.length, ring.mat)
    verts.push(...rv); edges.push(...re)
  }
  for (let ri = 0; ri + 1 < torsoRings.length; ri++) {
    const mat = torsoRings[ri].mat
    for (let k = 0; k < torsoRings[ri].n; k += 2) {
      edges.push({ a: torsoStarts[ri] + k, b: torsoStarts[ri + 1] + k, colorType: mat })
    }
    faces.push(...makeRingStrip(torsoRings[ri].n, torsoStarts[ri], torsoStarts[ri + 1], mat))
  }

  // Kuppel oben (Sensorkopf)
  const domeRing = makeRing(0, 0.12, 0, 0.12, 10, 'xz', verts.length, 'visor')
  verts.push(...domeRing.verts); edges.push(...domeRing.edges)
  const domeBaseIdx = torsoStarts[0]
  for (let k = 0; k < 10; k++) {
    edges.push({ a: domeBaseIdx + k, b: domeRing.edges[k].a, colorType: 'visor' })
  }

  // 4 Spinnenbeine, weit ausgreifend (jeweils aus 4 Segmenten)
  const legAngles = [
    Math.PI * 0.2, // Vorne Links
    Math.PI * 0.8, // Hinten Links
    Math.PI * 1.2, // Hinten Rechts
    Math.PI * 1.8, // Vorne Rechts
  ]

  legAngles.forEach((ang) => {
    const cos = Math.cos(ang)
    const sin = Math.sin(ang)

    const basePt = verts.length
    verts.push(
      { x: cos * 0.20, y: 0.0, z: sin * 0.20 }, // Ansatz am Rumpf (Kupfer-Joint)
      { x: cos * 0.38, y: 0.22, z: sin * 0.38 }, // Knie Oben (Base)
      { x: cos * 0.58, y: -0.15, z: sin * 0.58 }, // Knie Unten (Base)
      { x: cos * 0.70, y: -0.42, z: sin * 0.70 }, // Fußspitze (Kupfer-Spike)
    )

    edges.push(
      { a: basePt, b: basePt + 1, colorType: 'joint' },
      { a: basePt + 1, b: basePt + 2, colorType: 'base' },
      { a: basePt + 2, b: basePt + 3, colorType: 'joint' },
    )
  })

  // Leuchtende Energiewaffe an der Unterseite
  const weaponIdx = verts.length
  verts.push(
    { x: 0, y: -0.15, z: 0.0 },
    { x: 0, y: -0.15, z: -0.22 },
  )
  edges.push({ a: weaponIdx, b: weaponIdx + 1, colorType: 'energy' })

  return { vertices: verts, edges, faces }
}

const MODELS: ModelDef[] = [
  {
    name: 'HUMANOID-BOT MK-7',
    polyCount: 1248,
    dimensions: '1.82m × 0.58m × 0.38m',
    ...buildHumanoidRobot(),
  },
  {
    name: 'XENOMORPH-GREY UNIT',
    polyCount: 2016,
    dimensions: '1.90m × 0.28m × 0.22m',
    ...buildAlien(),
  },
  {
    name: 'TACTICAL MECH V-4',
    polyCount: 2640,
    dimensions: '2.10m × 1.35m × 1.10m',
    ...buildCombatMech(),
  },
  {
    name: 'ARACHNO-DRONE T-8',
    polyCount: 3104,
    dimensions: '0.42m × 1.40m × 1.40m',
    ...buildSpiderBot(),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// SOLID-RENDERING HILFSFUNKTIONEN
// ─────────────────────────────────────────────────────────────────────────────
function faceNormal(pts: Vec3[]): Vec3 {
  const ax = pts[1].x - pts[0].x, ay = pts[1].y - pts[0].y, az = pts[1].z - pts[0].z
  const bx = pts[2].x - pts[0].x, by = pts[2].y - pts[0].y, bz = pts[2].z - pts[0].z
  return {
    x: ay * bz - az * by,
    y: az * bx - ax * bz,
    z: ax * by - ay * bx,
  }
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (len < 0.0001) return { x: 0, y: 0, z: 1 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

// ─────────────────────────────────────────────────────────────────────────────
// HAUPTKOMPONENTE
// ─────────────────────────────────────────────────────────────────────────────
function CADRobotPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const _canvas = canvasRef.current
    const container = containerRef.current
    if (!_canvas || !container) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return
    const canvas: HTMLCanvasElement = _canvas
    const ctx: CanvasRenderingContext2D = _ctx

    let rafId: number
    let alive = true

    const resize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    let modelIdx = 0
    let ry = Math.random() * Math.PI * 2
    let rxPhase = Math.random() * Math.PI * 2
    let switchTimer = 12000
    let fadeAlpha = 0
    let fadingOut = false
    let fadingIn = false
    let blinkPhase = 0

    // Gitterboden (Blueprint-Style)
    function drawGrid(W: number, H: number) {
      const horizY = H * 0.62
      const vanishX = W * 0.5

      ctx.strokeStyle = 'rgba(0, 110, 220, 0.25)'
      ctx.lineWidth = 0.5

      // Horizontale Linien
      const hLines = 8
      for (let i = 1; i <= hLines; i++) {
        const t = i / hLines
        const lineY = horizY + (H - horizY) * t
        const lineW = W * 0.5 * t + W * 0.05
        ctx.beginPath()
        ctx.moveTo(vanishX - lineW, lineY)
        ctx.lineTo(vanishX + lineW, lineY)
        ctx.stroke()
      }

      // Vertikale Linien
      const vLines = 10
      for (let i = 0; i <= vLines; i++) {
        const t = i / vLines
        const bottomX = W * 0.05 + (W * 0.9) * t
        ctx.beginPath()
        ctx.moveTo(vanishX, horizY)
        ctx.lineTo(bottomX, H * 0.98)
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(0, 110, 220, 0.40)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(0, horizY)
      ctx.lineTo(W, horizY)
      ctx.stroke()
    }

    // Koordinatenachsen standardisiert RGB für XYZ
    function drawAxes(cx: number, cy: number, scale: number, rx: number, ry: number) {
      const axisLen = 0.50
      const focalLen = 6.0

      const origin: Vec3 = { x: 0, y: -0.95, z: 0 }
      const xEnd: Vec3 = { x: axisLen, y: -0.95, z: 0 }
      const yEnd: Vec3 = { x: 0, y: -0.95 + axisLen, z: 0 }
      const zEnd: Vec3 = { x: 0, y: -0.95, z: axisLen }

      const projO = project(rotateVec3(origin, rx, ry, 0), cx, cy, scale, focalLen)
      const projX = project(rotateVec3(xEnd, rx, ry, 0), cx, cy, scale, focalLen)
      const projY = project(rotateVec3(yEnd, rx, ry, 0), cx, cy, scale, focalLen)
      const projZ = project(rotateVec3(zEnd, rx, ry, 0), cx, cy, scale, focalLen)

      ctx.lineWidth = 1.8
      ctx.textBaseline = 'middle'
      const labelFSize = Math.max(8, scale * 0.05)
      ctx.font = `bold ${labelFSize}px monospace`

      // X-Achse (Rot)
      ctx.strokeStyle = '#ff3366'
      ctx.fillStyle = '#ff3366'
      ctx.beginPath()
      ctx.moveTo(projO.sx, projO.sy)
      ctx.lineTo(projX.sx, projX.sy)
      ctx.stroke()
      ctx.fillText('X', projX.sx + 4, projX.sy)

      // Y-Achse (Grün)
      ctx.strokeStyle = '#33cc66'
      ctx.fillStyle = '#33cc66'
      ctx.beginPath()
      ctx.moveTo(projO.sx, projO.sy)
      ctx.lineTo(projY.sx, projY.sy)
      ctx.stroke()
      ctx.fillText('Y', projY.sx + 4, projY.sy)

      // Z-Achse (Blau)
      ctx.strokeStyle = '#3366ff'
      ctx.fillStyle = '#3366ff'
      ctx.beginPath()
      ctx.moveTo(projO.sx, projO.sy)
      ctx.lineTo(projZ.sx, projZ.sy)
      ctx.stroke()
      ctx.fillText('Z', projZ.sx + 4, projZ.sy)
    }

    // Material-Farbzuordnung für solid schattierte Flächen
    function getMaterialColors(type: 'base' | 'accent' | 'joint' | 'visor' | 'energy', intensity: number) {
      switch (type) {
        case 'visor': // Neon Cyan
          return {
            fill: `rgba(${Math.round(intensity * 40 + 10)}, ${Math.round(intensity * 180 + 75)}, ${Math.round(intensity * 200 + 55)}, 0.9)`,
            stroke: 'rgba(0, 240, 255, 0.95)',
          }
        case 'accent': // Warmes Rot/Orange
          return {
            fill: `rgba(${Math.round(intensity * 210 + 45)}, ${Math.round(intensity * 60 + 15)}, ${Math.round(intensity * 20 + 5)}, 0.85)`,
            stroke: 'rgba(255, 80, 50, 0.9)',
          }
        case 'joint': // Kupfer/Bronze
          return {
            fill: `rgba(${Math.round(intensity * 160 + 50)}, ${Math.round(intensity * 100 + 30)}, ${Math.round(intensity * 40 + 10)}, 0.85)`,
            stroke: 'rgba(210, 130, 50, 0.85)',
          }
        case 'energy': // Goldgelb
          return {
            fill: `rgba(${Math.round(intensity * 230 + 25)}, ${Math.round(intensity * 180 + 10)}, ${Math.round(intensity * 10)}, 0.9)`,
            stroke: 'rgba(255, 210, 0, 0.95)',
          }
        case 'base':
        default: // Dunkler Anthrazit / Carbon
          return {
            fill: `rgba(${Math.round(intensity * 50 + 25)}, ${Math.round(intensity * 55 + 28)}, ${Math.round(intensity * 65 + 32)}, 0.85)`,
            stroke: 'rgba(120, 135, 155, 0.65)',
          }
      }
    }

    // CAD-Renderer mit Tiefensortierung und mehrfarbigem Lambertian Shading
    function drawModelCADMesh(
      model: ModelDef,
      cx: number, cy: number,
      scale: number,
      rx: number, ry: number,
      alpha: number
    ) {
      const focalLen = 6.0
      const light = normalize({ x: 0.5, y: 0.8, z: 1.0 })
      const camDir: Vec3 = { x: 0, y: 0, z: 1 }

      const rotated3D = model.vertices.map(v => rotateVec3(v, rx, ry, 0))
      const projected = rotated3D.map(v => project(v, cx, cy, scale, focalLen))

      const edgeInFace = new Set<string>()
      model.faces.forEach(face => {
        for (let i = 0; i < face.verts.length; i++) {
          const u = face.verts[i]
          const v = face.verts[(i + 1) % face.verts.length]
          const key = u < v ? `${u}_${v}` : `${v}_${u}`
          edgeInFace.add(key)
        }
      })

      type RenderItem =
        | { type: 'face'; face: Face; avgZ: number; intensity: number; visible: boolean }
        | { type: 'edge'; edge: Edge; avgZ: number }

      const items: RenderItem[] = []

      model.faces.forEach(face => {
        const pts3D = face.verts.map(i => rotated3D[i])
        const avgZ = pts3D.reduce((s, p) => s + p.z, 0) / pts3D.length
        const n = normalize(faceNormal(pts3D))
        const visible = dot(n, camDir) < 0
        const intensity = Math.max(0.12, dot(n, light))
        items.push({ type: 'face', face, avgZ, intensity, visible })
      })

      model.edges.forEach(edge => {
        const key = edge.a < edge.b ? `${edge.a}_${edge.b}` : `${edge.b}_${edge.a}`
        if (!edgeInFace.has(key)) {
          const avgZ = (rotated3D[edge.a].z + rotated3D[edge.b].z) / 2
          items.push({ type: 'edge', edge, avgZ })
        }
      })

      items.sort((a, b) => b.avgZ - a.avgZ)

      for (const item of items) {
        if (item.type === 'face') {
          if (!item.visible) continue
          const { face, intensity } = item
          const colorType = face.colorType || 'base'
          const colors = getMaterialColors(colorType, intensity)

          ctx.fillStyle = colors.fill
          ctx.beginPath()
          const firstPt = projected[face.verts[0]]
          ctx.moveTo(firstPt.sx, firstPt.sy)
          for (let k = 1; k < face.verts.length; k++) {
            const pt = projected[face.verts[k]]
            ctx.lineTo(pt.sx, pt.sy)
          }
          ctx.closePath()
          ctx.fill()

          ctx.strokeStyle = colors.stroke.replace(', 0.', `, ${0.8 * alpha * 0.9}`)
          ctx.lineWidth = 0.8
          ctx.stroke()
        } else {
          const { edge } = item
          const colorType = edge.colorType || 'base'
          const colors = getMaterialColors(colorType, 0.8)

          ctx.strokeStyle = colors.stroke.replace(', 0.', `, ${0.8 * alpha * 0.9}`)
          ctx.lineWidth = 1.0
          ctx.beginPath()
          ctx.moveTo(projected[edge.a].sx, projected[edge.a].sy)
          ctx.lineTo(projected[edge.b].sx, projected[edge.b].sy)
          ctx.stroke()
        }
      }
    }

    // Modernes CAD-Overlay
    function drawBlueprintHUD(
      W: number,
      H: number,
      rx: number,
      ry: number,
      alpha: number
    ) {
      ctx.save()

      // 1. Blueprint Grid
      ctx.strokeStyle = `rgba(0, 130, 255, ${0.05 * alpha})`
      ctx.lineWidth = 0.5
      const gridSize = 40
      ctx.beginPath()
      for (let x = 0; x < W; x += gridSize) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
      }
      ctx.stroke()

      const viewH = H * 0.88
      const cx = W * 0.5
      const cy = viewH * 0.48

      // 2. Fadenkreuz Cyan
      ctx.strokeStyle = `rgba(0, 200, 255, ${0.2 * alpha})`
      ctx.lineWidth = 0.8

      ctx.beginPath()
      ctx.arc(cx, cy, 12, 0, Math.PI * 2)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(cx - 50, cy)
      ctx.lineTo(cx - 20, cy)
      ctx.moveTo(cx + 20, cy)
      ctx.lineTo(cx + 50, cy)
      ctx.moveTo(cx, cy - 50)
      ctx.lineTo(cx, cy - 20)
      ctx.moveTo(cx, cy + 20)
      ctx.lineTo(cx, cy + 50)
      ctx.stroke()

      // Ticks an Achsen
      ctx.strokeStyle = `rgba(0, 150, 255, ${0.3 * alpha})`
      ctx.beginPath()
      for (let offset = 30; offset < W / 2; offset += 30) {
        ctx.moveTo(cx + offset, cy - 3)
        ctx.lineTo(cx + offset, cy + 3)
        ctx.moveTo(cx - offset, cy - 3)
        ctx.lineTo(cx - offset, cy + 3)
      }
      for (let offset = 30; offset < H / 2; offset += 30) {
        ctx.moveTo(cx - 3, cy + offset)
        ctx.lineTo(cx + 3, cy + offset)
        ctx.moveTo(cx - 3, cy - offset)
        ctx.lineTo(cx + 3, cy - offset)
      }
      ctx.stroke()

      // Eckwinkel
      const pad = 12
      const len = 15
      ctx.strokeStyle = `rgba(0, 170, 255, ${0.45 * alpha})`
      ctx.lineWidth = 1.0
      ctx.beginPath()
      ctx.moveTo(pad + len, pad); ctx.lineTo(pad, pad); ctx.lineTo(pad, pad + len)
      ctx.moveTo(W - pad - len, pad); ctx.lineTo(W - pad, pad); ctx.lineTo(W - pad, pad + len)
      const bottomY = H - 24
      ctx.moveTo(pad + len, bottomY); ctx.lineTo(pad, bottomY); ctx.lineTo(pad, bottomY - len)
      ctx.moveTo(W - pad - len, bottomY); ctx.lineTo(W - pad, bottomY); ctx.lineTo(W - pad, bottomY - len)
      ctx.stroke()

      // HUD Textwerte
      ctx.fillStyle = `rgba(0, 180, 255, ${0.8 * alpha})`
      ctx.font = '9px monospace'

      const degX = ((rx * 180 / Math.PI) % 360).toFixed(1)
      const degY = ((ry * 180 / Math.PI) % 360).toFixed(1)

      ctx.textAlign = 'right'
      ctx.fillText(`PROJ: 3D CAD ISO-VIEW`, W - 20, 24)
      ctx.fillText(`ROT-X: ${degX}°`, W - 20, 36)
      ctx.fillText(`ROT-Y: ${degY}°`, W - 20, 48)
      ctx.fillText(`RENDER: LAMBERTIAN SHADED`, W - 20, 60)

      ctx.textAlign = 'left'
      ctx.fillText(`SYS.STATUS : ANALYZING`, 10, 90)
      ctx.fillText(`GEOMETRY   : MULTI-MATERIAL MESH`, 10, 102)
      ctx.fillText(`LIGHTING   : FLAT DIFFUSE`, 10, 114)
      ctx.fillText(`SHADING    : COLOR_BLENDED`, 10, 126)

      ctx.restore()
    }

    // Info-Box oben links
    function drawInfoOverlay(W: number, model: ModelDef, alpha: number) {
      const fSize = Math.max(8, Math.min(11, W * 0.028))
      ctx.font = `${fSize}px monospace`
      ctx.textBaseline = 'top'

      const boxW = fSize * 18
      const boxH = fSize * 4.5
      ctx.fillStyle = `rgba(0, 15, 30, ${0.7 * alpha})`
      ctx.fillRect(6, 4, boxW, boxH)

      ctx.strokeStyle = `rgba(0, 120, 255, ${0.4 * alpha})`
      ctx.strokeRect(6, 4, boxW, boxH)

      ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`
      ctx.fillText(`MODEL  : ${model.name}`, 12, 8)
      ctx.fillText(`POLYS  : ${model.polyCount}`, 12, 8 + fSize * 1.3)
      ctx.fillText(`DIMS   : ${model.dimensions}`, 12, 8 + fSize * 2.6)
    }

    function drawModeLabel(W: number, alpha: number) {
      const fSize = Math.max(8, Math.min(11, W * 0.028))
      ctx.font = `bold ${fSize}px monospace`
      ctx.textBaseline = 'top'

      const label = 'CAD VIEWPORT'
      const measured = ctx.measureText(label)
      const boxPad = 4
      const boxX = W - measured.width - boxPad * 2 - 8
      const boxY = 4

      ctx.fillStyle = `rgba(0, 15, 30, ${0.7 * alpha})`
      ctx.fillRect(boxX, boxY, measured.width + boxPad * 2, fSize + boxPad * 2)
      ctx.strokeStyle = `rgba(0, 120, 255, ${0.4 * alpha})`
      ctx.strokeRect(boxX, boxY, measured.width + boxPad * 2, fSize + boxPad * 2)

      ctx.fillStyle = `rgba(255, 128, 0, ${alpha})` // Orange Akzent
      ctx.fillText(label, boxX + boxPad, boxY + boxPad)
    }

    // Statuszeile unten (Amber/Orange)
    function drawStatusBar(W: number, H: number, model: ModelDef) {
      const fSize = Math.max(7, Math.min(10, W * 0.025))
      ctx.font = `${fSize}px monospace`
      ctx.textBaseline = 'bottom'

      const cursor = blinkPhase < 0.5 ? '█' : ' '
      const statusText = `CAD ANALYZER // SCANNING TARGET: ${model.name} ${cursor}`
      ctx.fillStyle = 'rgba(255, 150, 0, 0.85)'
      ctx.fillText(statusText, 8, H - 4)

      ctx.strokeStyle = 'rgba(0, 110, 220, 0.40)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, H - fSize - 8)
      ctx.lineTo(W, H - fSize - 8)
      ctx.stroke()
    }

    let lastT = 0
    function loop(t: number) {
      if (!alive) return

      const dt = Math.min((t - lastT) / 1000, 0.08)
      lastT = t

      const W = canvas.width
      const H = canvas.height

      ry += 0.30 * dt
      rxPhase += 0.35 * dt
      const rx = 0.22 + Math.sin(rxPhase) * 0.12
      blinkPhase = (blinkPhase + dt) % 1.0

      switchTimer -= dt * 1000

      if (!fadingOut && !fadingIn && switchTimer <= 1000) {
        fadingOut = true
        fadeAlpha = 1.0
      }

      if (fadingOut) {
        fadeAlpha -= dt * 1.5
        if (fadeAlpha <= 0) {
          fadeAlpha = 0
          fadingOut = false
          modelIdx = (modelIdx + 1) % MODELS.length
          ry = Math.random() * Math.PI * 2
          rxPhase = Math.random() * Math.PI * 2
          switchTimer = 12000
          fadingIn = true
        }
      }

      if (fadingIn) {
        fadeAlpha += dt * 1.5
        if (fadeAlpha >= 1) {
          fadeAlpha = 1.0
          fadingIn = false
        }
      }

      const modelAlpha = fadingOut || fadingIn ? fadeAlpha : 1.0

      ctx.fillStyle = '#02050b' // Sehr dunkles Blau statt hartem Schwarz
      ctx.fillRect(0, 0, W, H)

      drawBlueprintHUD(W, H, rx, ry, modelAlpha)
      drawGrid(W, H)

      const viewH = H * 0.88
      const centerX = W * 0.5
      const centerY = viewH * 0.48
      const scale = Math.min(W, viewH) * 0.65

      drawAxes(centerX, centerY, scale, rx, ry)
      drawModelCADMesh(MODELS[modelIdx], centerX, centerY, scale, rx, ry, modelAlpha)
      drawInfoOverlay(W, MODELS[modelIdx], modelAlpha)
      drawModeLabel(W, modelAlpha)
      drawStatusBar(W, H, MODELS[modelIdx])

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame((t) => { lastT = t; loop(t) })

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="CAD VIEWER // MODEL ANALYSIS ACTIVE">
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </Panel>
  )
}

export default memo(CADRobotPanel)
