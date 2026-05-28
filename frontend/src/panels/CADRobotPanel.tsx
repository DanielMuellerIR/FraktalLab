import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ─────────────────────────────────────────────────────────────────────────────
// CADRobotPanel: Simuliert eine CAD-Software — vier 3D-Wireframe-Figuren
// rotieren automatisch auf einer Drehbühne. Kein WebGL, nur Canvas 2D mit
// einfacher Rotation (Euler) + perspektivischer Projektion.
// Jeder zweite Modell-Slot wird im Solid-Modus gerendert (gefüllte Flächen,
// Painter's Algorithm + diffuses Licht). Wireframe-Slots bleiben wie gehabt.
// ─────────────────────────────────────────────────────────────────────────────

// ── 3D-Hilfstypen ─────────────────────────────────────────────────────────────
interface Vec3 { x: number; y: number; z: number }
interface Edge  { a: number; b: number }  // Indizes in das Vertices-Array
// Face: Liste von Vertex-Indizes (konvex, in Reihenfolge) — für Solid-Rendering
interface Face  { verts: number[] }

// ── Modell-Beschreibung (wird oben-links im Panel angezeigt) ─────────────────
interface ModelDef {
  name:       string       // Modell-Name (z.B. "HUMANOID-BOT")
  polyCount:  number       // Fake-Polycount (rein kosmetisch)
  dimensions: string       // Abmessungen als Text (z.B. "1.8m × 0.5m × 0.4m")
  vertices:   Vec3[]
  edges:      Edge[]
  faces:      Face[]       // Flächen für den Solid-Render-Modus
}

// ─────────────────────────────────────────────────────────────────────────────
// ROTATIONSMATRIX
// Dreht einen 3D-Punkt um alle drei Achsen (Euler-Winkel in Radiant).
// Reihenfolge: erst X, dann Y, dann Z (standard intrinsisch).
// ─────────────────────────────────────────────────────────────────────────────
function rotateVec3(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
  // ── Rotation um X-Achse (Kippen nach vorne/hinten) ──────────────────────
  const y  =  v.y * Math.cos(rx) - v.z * Math.sin(rx)
  const z  =  v.y * Math.sin(rx) + v.z * Math.cos(rx)
  const x  =  v.x

  // ── Rotation um Y-Achse (Drehbühne, links/rechts) ───────────────────────
  const x2 =  x  * Math.cos(ry) + z * Math.sin(ry)
  const z2 = -x  * Math.sin(ry) + z * Math.cos(ry)

  // ── Rotation um Z-Achse (Kippen zur Seite) ──────────────────────────────
  const x3 = x2 * Math.cos(rz) - y * Math.sin(rz)
  const y3 = x2 * Math.sin(rz) + y * Math.cos(rz)

  return { x: x3, y: y3, z: z2 }
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSPEKTIVISCHE PROJEKTION
// Projiziert einen 3D-Punkt auf 2D-Schirmkoordinaten.
// focalLen: je größer, desto weniger Perspektive (gegen unendlich = orthografisch).
// cx, cy: Bildschirmmittelpunkt. scale: Skalierungsfaktor.
// ─────────────────────────────────────────────────────────────────────────────
function project(
  v: Vec3,
  cx: number, cy: number,
  scale: number,
  focalLen: number
): { sx: number; sy: number } {
  // Z-Verschiebung damit das Modell vor der Kamera bleibt
  const zShifted = v.z + focalLen
  // Perspektivische Division: weiter entfernte Punkte erscheinen kleiner
  const perspDiv = focalLen / Math.max(zShifted, 0.001)
  return {
    sx: cx + v.x * scale * perspDiv,
    sy: cy - v.y * scale * perspDiv,   // Y ist im Canvas invertiert
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HILFSFUNKTIONEN FÜR MODELL-GEOMETRIE
// Box aus 8 Eckpunkten + 12 Kanten + 6 Flächen, normiert auf gegebene Halbmaße.
// Gibt neue Vertices, Edges und Faces zurück, wobei die Vertex-Indizes um
// `offset` verschoben sind (damit mehrere Boxen im selben Array leben).
// ─────────────────────────────────────────────────────────────────────────────
function makeBox(
  cx: number, cy: number, cz: number,  // Mittelpunkt
  hw: number, hh: number, hd: number,  // Halbmaße (half-width, half-height, half-depth)
  offset: number                        // Vertex-Index-Offset
): { verts: Vec3[]; edges: Edge[]; faces: Face[] } {
  // 8 Ecken einer Quader in lokalen Koordinaten
  const verts: Vec3[] = [
    { x: cx - hw, y: cy - hh, z: cz - hd },  // 0: links  unten  vorne
    { x: cx + hw, y: cy - hh, z: cz - hd },  // 1: rechts unten  vorne
    { x: cx + hw, y: cy + hh, z: cz - hd },  // 2: rechts oben   vorne
    { x: cx - hw, y: cy + hh, z: cz - hd },  // 3: links  oben   vorne
    { x: cx - hw, y: cy - hh, z: cz + hd },  // 4: links  unten  hinten
    { x: cx + hw, y: cy - hh, z: cz + hd },  // 5: rechts unten  hinten
    { x: cx + hw, y: cy + hh, z: cz + hd },  // 6: rechts oben   hinten
    { x: cx - hw, y: cy + hh, z: cz + hd },  // 7: links  oben   hinten
  ]
  const o = offset
  const edges: Edge[] = [
    // Vordere Fläche
    { a: o+0, b: o+1 }, { a: o+1, b: o+2 }, { a: o+2, b: o+3 }, { a: o+3, b: o+0 },
    // Hintere Fläche
    { a: o+4, b: o+5 }, { a: o+5, b: o+6 }, { a: o+6, b: o+7 }, { a: o+7, b: o+4 },
    // Verbindungskanten (vorne→hinten)
    { a: o+0, b: o+4 }, { a: o+1, b: o+5 }, { a: o+2, b: o+6 }, { a: o+3, b: o+7 },
  ]
  // 6 Flächen des Quaders (je 4 Eckpunkte, im Uhrzeigersinn von außen gesehen)
  // Normalen zeigen nach außen, damit Back-Face Culling korrekt funktioniert.
  const faces: Face[] = [
    { verts: [o+0, o+3, o+2, o+1] },  // vorne  (-Z), Normale zeigt in -Z
    { verts: [o+5, o+6, o+7, o+4] },  // hinten (+Z), Normale zeigt in +Z
    { verts: [o+0, o+1, o+5, o+4] },  // unten  (-Y)
    { verts: [o+3, o+7, o+6, o+2] },  // oben   (+Y)
    { verts: [o+0, o+4, o+7, o+3] },  // links  (-X)
    { verts: [o+1, o+2, o+6, o+5] },  // rechts (+X)
  ]
  return { verts, edges, faces }
}

// Kreisring aus n Punkten auf einer gegebenen Ebene (XY, XZ oder YZ).
// plane: 'xy' | 'xz' | 'yz'. Gibt Vertices + geschlossene Kantenschleife zurück.
// Keine Flächen — für Solid-Rendering werden Zylinderstreifen per makeRingStrip erzeugt.
function makeRing(
  cx: number, cy: number, cz: number,  // Mittelpunkt
  r: number,                            // Radius
  n: number,                            // Anzahl Segmente
  plane: 'xy' | 'xz' | 'yz',          // Orientierung
  offset: number                        // Vertex-Index-Offset
): { verts: Vec3[]; edges: Edge[] } {
  const verts: Vec3[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const cos = Math.cos(a) * r
    const sin = Math.sin(a) * r
    if (plane === 'xz')      verts.push({ x: cx + cos, y: cy,        z: cz + sin })
    else if (plane === 'yz') verts.push({ x: cx,       y: cy + cos,  z: cz + sin })
    else                     verts.push({ x: cx + cos, y: cy + sin,  z: cz       })
  }
  const edges: Edge[] = []
  for (let i = 0; i < n; i++) {
    edges.push({ a: offset + i, b: offset + ((i + 1) % n) })
  }
  return { verts, edges }
}

// ─────────────────────────────────────────────────────────────────────────────
// makeRingStrip: erzeugt rechteckige Flächen zwischen zwei Ringen gleicher Länge.
// Wird für Solid-Rendering des Aliens und SpiderBots verwendet.
// offsetA/B: globale Vertex-Indizes des unteren bzw. oberen Rings.
// ─────────────────────────────────────────────────────────────────────────────
function makeRingStrip(n: number, offsetA: number, offsetB: number): Face[] {
  const faces: Face[] = []
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    // Rechteck aus zwei benachbarten Vertex-Paaren der beiden Ringe
    faces.push({ verts: [offsetA + i, offsetA + next, offsetB + next, offsetB + i] })
  }
  return faces
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELL 1: HUMANOID-ROBOTER
// Torso, Kopf, 2 Arme mit Ellenbogen, 2 Beine mit Knien.
// Alle Teile als Boxen, verbunden durch einzelne Linien (Gelenkknochen).
// ─────────────────────────────────────────────────────────────────────────────
function buildHumanoidRobot(): { vertices: Vec3[]; edges: Edge[]; faces: Face[] } {
  const verts: Vec3[] = []
  const edges: Edge[] = []
  const faces: Face[] = []

  // Hilfsfunktion: Box einbauen und Indizes merken
  function addBox(cx: number, cy: number, cz: number, hw: number, hh: number, hd: number) {
    const { verts: bv, edges: be, faces: bf } = makeBox(cx, cy, cz, hw, hh, hd, verts.length)
    verts.push(...bv)
    edges.push(...be)
    faces.push(...bf)
  }

  // ── Torso (Hauptkörper) ──────────────────────────────────────────────────
  addBox(0, 0.1, 0, 0.22, 0.30, 0.12)

  // ── Kopf (kleinere Box, auf dem Torso) ──────────────────────────────────
  addBox(0, 0.58, 0, 0.14, 0.14, 0.12)

  // ── Hals (Verbindungslinie Torso→Kopf) ──────────────────────────────────
  const neckBase = verts.length
  verts.push({ x: -0.04, y: 0.40, z: 0 }, { x: 0.04, y: 0.40, z: 0 })
  verts.push({ x: -0.04, y: 0.44, z: 0 }, { x: 0.04, y: 0.44, z: 0 })
  edges.push(
    { a: neckBase, b: neckBase+1 },
    { a: neckBase, b: neckBase+2 },
    { a: neckBase+1, b: neckBase+3 },
    { a: neckBase+2, b: neckBase+3 },
  )
  // Halsfläche (Rechteck) für Solid-Modus
  faces.push({ verts: [neckBase, neckBase+1, neckBase+3, neckBase+2] })

  // ── Linkes Bein: Oberschenkel-Box + Unterschenkel-Box ───────────────────
  addBox(-0.13, -0.30, 0, 0.07, 0.18, 0.08)   // Oberschenkel
  addBox(-0.13, -0.62, 0, 0.06, 0.15, 0.07)   // Unterschenkel
  addBox(-0.13, -0.82, 0, 0.09, 0.05, 0.12)   // Fuß

  // ── Rechtes Bein ────────────────────────────────────────────────────────
  addBox( 0.13, -0.30, 0, 0.07, 0.18, 0.08)
  addBox( 0.13, -0.62, 0, 0.06, 0.15, 0.07)
  addBox( 0.13, -0.82, 0, 0.09, 0.05, 0.12)

  // ── Linker Arm: Schulter-Box + Unterarm-Box ──────────────────────────────
  addBox(-0.36, 0.18, 0, 0.06, 0.06, 0.06)    // Schultergelenk
  addBox(-0.36, 0.0,  0, 0.05, 0.14, 0.05)    // Oberarm
  addBox(-0.36, -0.22, 0, 0.04, 0.12, 0.04)   // Unterarm
  addBox(-0.36, -0.38, 0.0, 0.07, 0.04, 0.07) // Hand

  // ── Rechter Arm ─────────────────────────────────────────────────────────
  addBox( 0.36, 0.18, 0, 0.06, 0.06, 0.06)
  addBox( 0.36, 0.0,  0, 0.05, 0.14, 0.05)
  addBox( 0.36, -0.22, 0, 0.04, 0.12, 0.04)
  addBox( 0.36, -0.38, 0.0, 0.07, 0.04, 0.07)

  // ── Augen (zwei kleine Boxen am Kopf) ───────────────────────────────────
  addBox(-0.06, 0.60, -0.12, 0.03, 0.03, 0.02)  // linkes Auge
  addBox( 0.06, 0.60, -0.12, 0.03, 0.03, 0.02)  // rechtes Auge

  // ── Antenne oben auf dem Kopf ────────────────────────────────────────────
  const antennaBase = verts.length
  verts.push(
    { x:  0, y: 0.72, z: 0 },    // Antennenwurzel
    { x:  0, y: 0.90, z: 0 },    // Antennenspitze
    { x: -0.04, y: 0.85, z: 0 }, // kleiner Querbalken links
    { x:  0.04, y: 0.85, z: 0 }, // kleiner Querbalken rechts
  )
  edges.push(
    { a: antennaBase,   b: antennaBase+1 },  // Stab
    { a: antennaBase+2, b: antennaBase+3 },  // Querbalken
  )

  return { vertices: verts, edges, faces }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELL 2: ALIEN (GREYS-ÄSTHETIK)
// Länglicher ovalförmiger Kopf aus gestapelten Ringen, große runde Augen,
// schmaler Körper, dünne Extremitäten.
// ─────────────────────────────────────────────────────────────────────────────
function buildAlien(): { vertices: Vec3[]; edges: Edge[]; faces: Face[] } {
  const verts: Vec3[] = []
  const edges: Edge[] = []
  const faces: Face[] = []

  // ── Kopf: gestapelte Ringe bilden ein Ovoid ─────────────────────────────
  // Ringprofil: Radius nimmt nach oben und unten ab (Ellipsoid-Annäherung)
  const headRings = [
    { y: 0.80, r: 0.04, n: 8 },   // ganz oben (Spitze)
    { y: 0.72, r: 0.10, n: 10 },
    { y: 0.62, r: 0.16, n: 12 },
    { y: 0.52, r: 0.19, n: 14 },  // größte Breite (Schädelkalotte)
    { y: 0.42, r: 0.18, n: 14 },
    { y: 0.32, r: 0.15, n: 12 },  // Jochbeinlinie
    { y: 0.22, r: 0.11, n: 10 },
    { y: 0.14, r: 0.07, n: 8 },   // Kinn (sehr schmal)
  ]

  const ringStartIndices: number[] = []
  for (const ring of headRings) {
    ringStartIndices.push(verts.length)
    const { verts: rv, edges: re } = makeRing(0, ring.y, 0, ring.r, ring.n, 'xz', verts.length)
    verts.push(...rv)
    edges.push(...re)
  }

  // Längsverbindungen zwischen benachbarten Ringen (jede zweite Kante für saubereres Bild)
  for (let ri = 0; ri + 1 < headRings.length; ri++) {
    const rA = headRings[ri]
    const rB = headRings[ri + 1]
    const nConn = Math.min(rA.n, rB.n)
    const startA = ringStartIndices[ri]
    const startB = ringStartIndices[ri + 1]
    for (let k = 0; k < nConn; k += 2) {
      edges.push({ a: startA + k, b: startB + k })
    }
    // Solid-Flächen: Streifen zwischen benachbarten gleichgroßen Ringen hinzufügen
    // Für Ringe unterschiedlicher Größe nehmen wir den kleineren
    const nStrip = nConn
    faces.push(...makeRingStrip(nStrip, startA, startB))
  }

  // ── Große Augen (je ein Ring in der XY-Ebene, leicht zur Seite verschoben) ─
  const eyeRingL = makeRing(-0.09, 0.28, -0.12, 0.07, 10, 'xy', verts.length)
  verts.push(...eyeRingL.verts); edges.push(...eyeRingL.edges)
  const eyeRingR = makeRing( 0.09, 0.28, -0.12, 0.07, 10, 'xy', verts.length)
  verts.push(...eyeRingR.verts); edges.push(...eyeRingR.edges)

  // ── Hals (dünner Zylinder aus Ringen) ────────────────────────────────────
  const neckRings = [
    { y: 0.08, r: 0.04, n: 6 },
    { y: 0.00, r: 0.04, n: 6 },
    { y:-0.08, r: 0.04, n: 6 },
  ]
  const neckStarts: number[] = []
  for (const ring of neckRings) {
    neckStarts.push(verts.length)
    const { verts: rv, edges: re } = makeRing(0, ring.y, 0, ring.r, ring.n, 'xz', verts.length)
    verts.push(...rv); edges.push(...re)
  }
  // Hals-Längsverbindungen + Flächen
  for (let ri = 0; ri + 1 < neckRings.length; ri++) {
    const n = neckRings[ri].n
    for (let k = 0; k < n; k += 2) {
      edges.push({ a: neckStarts[ri] + k, b: neckStarts[ri+1] + k })
    }
    faces.push(...makeRingStrip(n, neckStarts[ri], neckStarts[ri+1]))
  }

  // ── Schmaler Torso ────────────────────────────────────────────────────────
  const { verts: tv, edges: te, faces: tf } = makeBox(0, -0.28, 0, 0.12, 0.18, 0.08, verts.length)
  verts.push(...tv); edges.push(...te); faces.push(...tf)

  // ── Linker Arm (sehr dünn, drei Segmente) ────────────────────────────────
  const armLPoints = verts.length
  verts.push(
    { x: -0.12, y: -0.12, z: 0 },    // Schulter
    { x: -0.22, y: -0.25, z: 0 },    // Ellenbogen
    { x: -0.28, y: -0.42, z: 0 },    // Handgelenk
    { x: -0.30, y: -0.50, z: 0 },    // Fingerspitzen Mitte
    { x: -0.26, y: -0.51, z:-0.03 }, // Finger links
    { x: -0.34, y: -0.51, z: 0.03 }, // Finger rechts
  )
  edges.push(
    { a: armLPoints,   b: armLPoints+1 },
    { a: armLPoints+1, b: armLPoints+2 },
    { a: armLPoints+2, b: armLPoints+3 },
    { a: armLPoints+2, b: armLPoints+4 },
    { a: armLPoints+2, b: armLPoints+5 },
  )

  // ── Rechter Arm (gespiegelt) ──────────────────────────────────────────────
  const armRPoints = verts.length
  verts.push(
    { x:  0.12, y: -0.12, z: 0 },
    { x:  0.22, y: -0.25, z: 0 },
    { x:  0.28, y: -0.42, z: 0 },
    { x:  0.30, y: -0.50, z: 0 },
    { x:  0.26, y: -0.51, z:-0.03 },
    { x:  0.34, y: -0.51, z: 0.03 },
  )
  edges.push(
    { a: armRPoints,   b: armRPoints+1 },
    { a: armRPoints+1, b: armRPoints+2 },
    { a: armRPoints+2, b: armRPoints+3 },
    { a: armRPoints+2, b: armRPoints+4 },
    { a: armRPoints+2, b: armRPoints+5 },
  )

  // ── Linkes Bein (sehr dünn) ───────────────────────────────────────────────
  const legLPoints = verts.length
  verts.push(
    { x: -0.06, y: -0.46, z: 0 },   // Hüfte
    { x: -0.08, y: -0.65, z: 0 },   // Knie
    { x: -0.07, y: -0.85, z: 0 },   // Knöchel
    { x: -0.10, y: -0.90, z:-0.05 },// Fuß vorne
  )
  edges.push(
    { a: legLPoints,   b: legLPoints+1 },
    { a: legLPoints+1, b: legLPoints+2 },
    { a: legLPoints+2, b: legLPoints+3 },
  )

  // ── Rechtes Bein ─────────────────────────────────────────────────────────
  const legRPoints = verts.length
  verts.push(
    { x:  0.06, y: -0.46, z: 0 },
    { x:  0.08, y: -0.65, z: 0 },
    { x:  0.07, y: -0.85, z: 0 },
    { x:  0.10, y: -0.90, z:-0.05 },
  )
  edges.push(
    { a: legRPoints,   b: legRPoints+1 },
    { a: legRPoints+1, b: legRPoints+2 },
    { a: legRPoints+2, b: legRPoints+3 },
  )

  return { vertices: verts, edges, faces }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELL 3: ACTIONFIGUR
// Muskulöser Humanoid: breite Schultern, Helm mit Visier, anatomische Blöcke.
// ─────────────────────────────────────────────────────────────────────────────
function buildActionFigure(): { vertices: Vec3[]; edges: Edge[]; faces: Face[] } {
  const verts: Vec3[] = []
  const edges: Edge[] = []
  const faces: Face[] = []

  function addBox(cx: number, cy: number, cz: number, hw: number, hh: number, hd: number) {
    const { verts: bv, edges: be, faces: bf } = makeBox(cx, cy, cz, hw, hh, hd, verts.length)
    verts.push(...bv); edges.push(...be); faces.push(...bf)
  }

  // ── Torso (breit und muskulös) ────────────────────────────────────────────
  addBox(0, 0.10, 0,  0.28, 0.28, 0.14)  // Brust (groß)
  addBox(0, -0.20, 0, 0.20, 0.10, 0.12)  // Bauch (etwas schmaler)

  // ── Helm (doppelwandig: äußere Box + innere Visier-Box) ──────────────────
  addBox(0, 0.62, 0,   0.16, 0.18, 0.15)  // Helmkorpus
  addBox(0, 0.55, -0.10, 0.10, 0.08, 0.04) // Visier (nach vorne versetzt, flach)

  // ── Hals ─────────────────────────────────────────────────────────────────
  addBox(0, 0.42, 0,   0.07, 0.06, 0.07)

  // ── Schultern (große Epauletten-ähnliche Blöcke) ─────────────────────────
  addBox(-0.38, 0.26, 0, 0.08, 0.07, 0.08)  // linke Schulterplatte
  addBox( 0.38, 0.26, 0, 0.08, 0.07, 0.08)  // rechte Schulterplatte

  // ── Linker Arm (Oberarm + Unterarm, kräftiger) ────────────────────────────
  addBox(-0.40, 0.08, 0,  0.07, 0.14, 0.07) // Oberarm
  addBox(-0.40, -0.14, 0, 0.06, 0.12, 0.06) // Unterarm
  addBox(-0.40, -0.30, 0, 0.08, 0.04, 0.08) // Hand-Box

  // ── Rechter Arm ────────────────────────────────────────────────────────────
  addBox( 0.40, 0.08, 0,  0.07, 0.14, 0.07)
  addBox( 0.40, -0.14, 0, 0.06, 0.12, 0.06)
  addBox( 0.40, -0.30, 0, 0.08, 0.04, 0.08)

  // ── Linkes Bein (Ober- und Unterschenkel, breiter als Roboter) ─────────────
  addBox(-0.14, -0.40, 0, 0.09, 0.18, 0.09)  // Oberschenkel
  addBox(-0.14, -0.66, 0, 0.08, 0.12, 0.08)  // Unterschenkel
  addBox(-0.14, -0.82, 0.02, 0.10, 0.05, 0.13) // Stiefelkappe

  // ── Rechtes Bein ───────────────────────────────────────────────────────────
  addBox( 0.14, -0.40, 0, 0.09, 0.18, 0.09)
  addBox( 0.14, -0.66, 0, 0.08, 0.12, 0.08)
  addBox( 0.14, -0.82, 0.02, 0.10, 0.05, 0.13)

  // ── Gürtellinie (horizontale Linien zwischen Torso und Bauch) ─────────────
  const beltBase = verts.length
  verts.push(
    { x: -0.20, y: -0.08, z: -0.12 },
    { x:  0.20, y: -0.08, z: -0.12 },
    { x: -0.20, y: -0.08, z:  0.12 },
    { x:  0.20, y: -0.08, z:  0.12 },
  )
  edges.push(
    { a: beltBase,   b: beltBase+1 },  // vorderer Gurtstreifen
    { a: beltBase+2, b: beltBase+3 },  // hinterer Gurtstreifen
    { a: beltBase,   b: beltBase+2 },  // linke Seite
    { a: beltBase+1, b: beltBase+3 },  // rechte Seite
  )
  // Gürtel-Fläche für Solid-Modus
  faces.push({ verts: [beltBase, beltBase+2, beltBase+3, beltBase+1] })

  return { vertices: verts, edges, faces }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELL 4: ROBOTER-SPINNE
// 8 Beine mit je 3 Gelenken, runder Torso (aus Ringen), Antennenpaar,
// niedrig und breit — typische Science-Fiction-Drohne.
// ─────────────────────────────────────────────────────────────────────────────
function buildSpiderBot(): { vertices: Vec3[]; edges: Edge[]; faces: Face[] } {
  const verts: Vec3[] = []
  const edges: Edge[] = []
  const faces: Face[] = []

  // ── Torso: zwei gestapelte Ringe (Draufsicht Ellipse) ───────────────────
  const torsoRings = [
    { y:  0.06, r: 0.22, n: 14 },  // Oberer Ring
    { y:  0.00, r: 0.26, n: 14 },  // Mittlerer Ring (größte Breite)
    { y: -0.06, r: 0.22, n: 14 },  // Unterer Ring
  ]
  const torsoStarts: number[] = []
  for (const ring of torsoRings) {
    torsoStarts.push(verts.length)
    const { verts: rv, edges: re } = makeRing(0, ring.y, 0, ring.r, ring.n, 'xz', verts.length)
    verts.push(...rv); edges.push(...re)
  }
  // Längsstreben des Torsos + Flächen
  for (let ri = 0; ri + 1 < torsoRings.length; ri++) {
    for (let k = 0; k < torsoRings[ri].n; k += 3) {
      edges.push({ a: torsoStarts[ri] + k, b: torsoStarts[ri+1] + k })
    }
    faces.push(...makeRingStrip(torsoRings[ri].n, torsoStarts[ri], torsoStarts[ri+1]))
  }

  // ── Zentrale Kuppel oben (kleiner Ring) ──────────────────────────────────
  const domeStart = verts.length
  const { verts: dv, edges: de } = makeRing(0, 0.16, 0, 0.10, 10, 'xz', verts.length)
  verts.push(...dv); edges.push(...de)
  // Verbindungsstreben Kuppel→oberer Torso-Ring
  for (let k = 0; k < 10; k += 2) {
    // Verbinde jeden zweiten Kuppel-Punkt mit dem nächsten Torso-Punkt
    edges.push({ a: domeStart + k, b: torsoStarts[0] + (k * Math.floor(14/10)) % 14 })
  }

  // ── 8 Beine: gleichmäßig um den Torso verteilt ──────────────────────────
  // Beingeometrie: Schulter → Knie (nach außen oben) → Fußspitze (nach unten)
  for (let legIdx = 0; legIdx < 8; legIdx++) {
    const baseAngle = (legIdx / 8) * Math.PI * 2  // Winkel des Beins um Y-Achse

    // Befestigungspunkt am Torso-Rand
    const attachX = Math.cos(baseAngle) * 0.24
    const attachZ = Math.sin(baseAngle) * 0.24
    const attachY = -0.02

    // Schultergelenk: leicht nach außen und oben
    const shoulderX = Math.cos(baseAngle) * 0.38
    const shoulderZ = Math.sin(baseAngle) * 0.38
    const shoulderY = 0.08

    // Kniegelenk: noch weiter außen, auf Bodenhöhe
    const kneeX = Math.cos(baseAngle) * 0.60
    const kneeZ = Math.sin(baseAngle) * 0.60
    const kneeY = -0.10

    // Fußspitze: leicht nach innen gezogen, am Boden
    const footX = Math.cos(baseAngle) * 0.50
    const footZ = Math.sin(baseAngle) * 0.50
    const footY = -0.28

    const legBase = verts.length
    verts.push(
      { x: attachX,  y: attachY,  z: attachZ  },  // 0: Torso-Ansatz
      { x: shoulderX, y: shoulderY, z: shoulderZ },// 1: Schultergelenk
      { x: kneeX,    y: kneeY,    z: kneeZ    },  // 2: Kniegelenk
      { x: footX,    y: footY,    z: footZ    },  // 3: Fußspitze
    )
    edges.push(
      { a: legBase,   b: legBase+1 },  // Torso → Schulter
      { a: legBase+1, b: legBase+2 },  // Schulter → Knie
      { a: legBase+2, b: legBase+3 },  // Knie → Fuß
    )

    // Kleiner Fuß-Querstrich (Grip-Klaue)
    const clawOffset = 0.04
    const perpX = -Math.sin(baseAngle) * clawOffset  // senkrecht zur Beinrichtung
    const perpZ =  Math.cos(baseAngle) * clawOffset
    const clawBase = verts.length
    verts.push(
      { x: footX - perpX, y: footY, z: footZ - perpZ },
      { x: footX + perpX, y: footY, z: footZ + perpZ },
    )
    edges.push({ a: clawBase, b: clawBase+1 })
  }

  // ── Antennenpaar (vorne oben) ─────────────────────────────────────────────
  // Die Antennen zeigen schräg nach vorne (Richtung negatives Z = Kamera)
  const ant1Base = verts.length
  verts.push(
    { x: -0.06, y: 0.16, z: -0.08 },   // Antenne links, Wurzel
    { x: -0.14, y: 0.40, z: -0.22 },   // Antenne links, Spitze
  )
  edges.push({ a: ant1Base, b: ant1Base+1 })

  const ant2Base = verts.length
  verts.push(
    { x:  0.06, y: 0.16, z: -0.08 },   // Antenne rechts, Wurzel
    { x:  0.14, y: 0.40, z: -0.22 },   // Antenne rechts, Spitze
  )
  edges.push({ a: ant2Base, b: ant2Base+1 })

  return { vertices: verts, edges, faces }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELL-DEFINITIONEN: alle vier Modelle zusammengefasst
// ─────────────────────────────────────────────────────────────────────────────
const MODELS: ModelDef[] = [
  {
    name:       'HUMANOID-BOT MK-7',
    polyCount:  1248,
    dimensions: '1.82m × 0.58m × 0.38m',
    ...buildHumanoidRobot(),
  },
  {
    name:       'XENOMORPH-GREY UNIT',
    polyCount:  2016,
    dimensions: '1.90m × 0.28m × 0.22m',
    ...buildAlien(),
  },
  {
    name:       'COMBAT-FIGURE ALPHA',
    polyCount:  1840,
    dimensions: '1.95m × 0.72m × 0.45m',
    ...buildActionFigure(),
  },
  {
    name:       'ARACHNO-DRONE T-8',
    polyCount:  3104,
    dimensions: '0.42m × 0.72m × 0.72m',
    ...buildSpiderBot(),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// SOLID-RENDERING HILFSFUNKTIONEN
// ─────────────────────────────────────────────────────────────────────────────

// Berechnet die Normale einer planaren Fläche (konvex) aus den ersten 3 Punkten.
// Verwendet Kreuzprodukt der beiden ersten Kanten.
function faceNormal(pts: Vec3[]): Vec3 {
  // Zwei Kantenvektoren der Fläche
  const ax = pts[1].x - pts[0].x, ay = pts[1].y - pts[0].y, az = pts[1].z - pts[0].z
  const bx = pts[2].x - pts[0].x, by = pts[2].y - pts[0].y, bz = pts[2].z - pts[0].z
  // Kreuzprodukt a × b ergibt die Flächennormale
  return {
    x: ay * bz - az * by,
    y: az * bx - ax * bz,
    z: ax * by - ay * bx,
  }
}

// Normiert einen Vektor auf Länge 1.
function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z)
  if (len < 0.0001) return { x: 0, y: 0, z: 1 }
  return { x: v.x/len, y: v.y/len, z: v.z/len }
}

// Skalarprodukt zweier Vektoren.
function dot(a: Vec3, b: Vec3): number {
  return a.x*b.x + a.y*b.y + a.z*b.z
}

// ─────────────────────────────────────────────────────────────────────────────
// HAUPTKOMPONENTE
// ─────────────────────────────────────────────────────────────────────────────
function CADRobotPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // TypeScript-Closure-Pattern (wie in ElitePanel.tsx):
    // _canvas/_ctx werden am Anfang geholt, dann als finale Konstanten weitergenutzt.
    const _canvas   = canvasRef.current
    const container = containerRef.current
    if (!_canvas || !container) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return
    const canvas: HTMLCanvasElement        = _canvas
    const ctx:    CanvasRenderingContext2D = _ctx

    let rafId: number
    let alive = true

    // ── Canvas-Größe dynamisch an Container anpassen ─────────────────────────
    const resize = () => {
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Animationszustand ────────────────────────────────────────────────────

    // Aktuell angezeigtes Modell (Index in MODELS)
    let modelIdx     = 0
    // Y-Rotationswinkel (Drehbühne-Effekt)
    let ry           = Math.random() * Math.PI * 2
    // X-Kipp-Winkel (leichtes Kippen für 3D-Eindruck)
    // Schwingt hin und her um einen festen Offset
    let rxPhase      = Math.random() * Math.PI * 2
    // Timer für den Modell-Wechsel (in Millisekunden)
    let switchTimer  = 12000
    // Überblende-Alpha (0 = voll sichtbar, 1 = unsichtbar — wird für Fade-Out/-In genutzt)
    let fadeAlpha    = 0
    let fadingOut    = false  // true = Modell wird ausgeblendet
    let fadingIn     = false  // true = neues Modell wird eingeblendet

    // Blinke-Status für die Statuszeile (simuliert Cursor-Blinken)
    let blinkPhase = 0

    // Render-Modus-Zähler: gerader Index = WIRE, ungerader Index = SOLID
    // Wird bei jedem Modell-Wechsel erhöht (unabhängig vom modelIdx).
    let slotCount = 0

    // ── Hilfsfunktion: Perspektivgitter zeichnen ─────────────────────────────
    // Klassisches CAD-Bodenraster, perspektivisch zusammenlaufend.
    function drawGrid(W: number, H: number) {
      const horizY = H * 0.62  // Horizont-Linie (wo Boden auf Himmel trifft)
      const vanishX = W * 0.5  // Fluchtpunkt in der Mitte

      ctx.strokeStyle = 'rgba(0, 80, 40, 0.35)'
      ctx.lineWidth   = 0.5

      // Horizontale Linien (Boden-Tiefenlinien)
      const hLines = 8  // Anzahl horizontaler Rasterlinien
      for (let i = 1; i <= hLines; i++) {
        const t = i / hLines          // 0..1 von Horizont bis Bildrand unten
        const lineY = horizY + (H - horizY) * t
        // Breite der horizontalen Linie nimmt mit Entfernung ab
        const lineW = W * 0.5 * t + W * 0.05
        ctx.beginPath()
        ctx.moveTo(vanishX - lineW, lineY)
        ctx.lineTo(vanishX + lineW, lineY)
        ctx.stroke()
      }

      // Vertikale Linien (laufen zum Fluchtpunkt zusammen)
      const vLines = 10  // Anzahl Fluchtpunktlinien
      for (let i = 0; i <= vLines; i++) {
        const t = i / vLines  // 0=links, 1=rechts
        // Breite der untersten Rasterlinie (am Bildrand)
        const bottomX = W * 0.05 + (W * 0.9) * t
        ctx.beginPath()
        ctx.moveTo(vanishX, horizY)
        ctx.lineTo(bottomX, H * 0.98)
        ctx.stroke()
      }

      // Horizont-Linie (etwas heller)
      ctx.strokeStyle = 'rgba(0, 120, 60, 0.25)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(0, horizY)
      ctx.lineTo(W, horizY)
      ctx.stroke()
    }

    // ── Hilfsfunktion: Koordinatenachsen zeichnen ────────────────────────────
    // X=Grün (hell), Y=Grün (heller), Z=Grün (mittel) — Monochrom-Look.
    // Die Achsen zeigen die aktuelle Ausrichtung des Modells.
    function drawAxes(cx: number, cy: number, scale: number, rx: number, ry: number) {
      const axisLen = 0.55  // Länge der Achsen in Modell-Einheiten
      const focalLen = 6.0  // muss zur focalLen in drawModel passen

      // Achsen-Endpunkte in 3D
      const origin: Vec3 = { x: 0, y: -0.95, z: 0 }  // Ursprung liegt unter dem Modell
      const xEnd:   Vec3 = { x: axisLen, y: -0.95, z: 0 }
      const yEnd:   Vec3 = { x: 0, y: -0.95 + axisLen, z: 0 }
      const zEnd:   Vec3 = { x: 0, y: -0.95, z: axisLen }

      // Alle Punkte mit der aktuellen Modell-Rotation drehen
      const projO = project(rotateVec3(origin, rx, ry, 0), cx, cy, scale, focalLen)
      const projX = project(rotateVec3(xEnd,   rx, ry, 0), cx, cy, scale, focalLen)
      const projY = project(rotateVec3(yEnd,   rx, ry, 0), cx, cy, scale, focalLen)
      const projZ = project(rotateVec3(zEnd,   rx, ry, 0), cx, cy, scale, focalLen)

      ctx.lineWidth = 1.5
      ctx.textBaseline = 'middle'
      const labelFSize = Math.max(7, scale * 0.05)
      ctx.font = `bold ${labelFSize}px monospace`

      // X-Achse (hellstes Grün)
      ctx.strokeStyle = '#00ff80'
      ctx.fillStyle   = '#00ff80'
      ctx.beginPath()
      ctx.moveTo(projO.sx, projO.sy)
      ctx.lineTo(projX.sx, projX.sy)
      ctx.stroke()
      ctx.fillText('X', projX.sx + 4, projX.sy)

      // Y-Achse (mittleres Grün)
      ctx.strokeStyle = '#00cc60'
      ctx.fillStyle   = '#00cc60'
      ctx.beginPath()
      ctx.moveTo(projO.sx, projO.sy)
      ctx.lineTo(projY.sx, projY.sy)
      ctx.stroke()
      ctx.fillText('Y', projY.sx + 4, projY.sy)

      // Z-Achse (dunkelstes Grün)
      ctx.strokeStyle = '#009940'
      ctx.fillStyle   = '#009940'
      ctx.beginPath()
      ctx.moveTo(projO.sx, projO.sy)
      ctx.lineTo(projZ.sx, projZ.sy)
      ctx.stroke()
      ctx.fillText('Z', projZ.sx + 4, projZ.sy)
    }

    // ── Hilfsfunktion: CAD-Mesh (Solid + Wireframe) zeichnen ─────────────────
    // Zeichnet zuerst alle Flächen (Painter's Algorithm) gefüllt und schattiert,
    // und zeichnet direkt danach ihre Außenlinien sowie freie Kanten (z. B. Antennen).
    function drawModelCADMesh(
      model: ModelDef,
      cx: number, cy: number,
      scale: number,
      rx: number, ry: number,
      alpha: number
    ) {
      const focalLen = 6.0

      // Lichtrichtung (normiert) — von leicht oben-links-vorne
      const light = normalize({ x: 0.5, y: 0.8, z: 1.0 })
      // Kamerarichtung: wir schauen in +Z-Richtung (Kamera bei z = -focalLen)
      const camDir: Vec3 = { x: 0, y: 0, z: 1 }

      // Alle Vertices rotieren (3D) und projizieren (2D)
      const rotated3D = model.vertices.map(v => rotateVec3(v, rx, ry, 0))
      const projected = rotated3D.map(v => project(v, cx, cy, scale, focalLen))

      // Kanten ermitteln, die zu Flächen gehören, um freie Kanten (z. B. Antennen) separat zu zeichnen
      const edgeInFace = new Set<string>()
      model.faces.forEach(face => {
        for (let i = 0; i < face.verts.length; i++) {
          const u = face.verts[i]
          const v = face.verts[(i + 1) % face.verts.length]
          const key = u < v ? `${u}_${v}` : `${v}_${u}`
          edgeInFace.add(key)
        }
      })

      // Flächen und freie Kanten in ein gemeinsames Tiefensortierungs-Array packen
      type RenderItem = 
        | { type: 'face'; face: Face; avgZ: number; intensity: number; visible: boolean }
        | { type: 'edge'; edge: Edge; avgZ: number }

      const items: RenderItem[] = []

      // 1. Flächen hinzufügen
      model.faces.forEach(face => {
        const pts3D = face.verts.map(i => rotated3D[i])
        const avgZ = pts3D.reduce((s, p) => s + p.z, 0) / pts3D.length
        const n = normalize(faceNormal(pts3D))
        const visible = dot(n, camDir) < 0
        const intensity = Math.max(0, dot(n, light))
        items.push({ type: 'face', face, avgZ, intensity, visible })
      })

      // 2. Freie Kanten hinzufügen
      model.edges.forEach(edge => {
        const key = edge.a < edge.b ? `${edge.a}_${edge.b}` : `${edge.b}_${edge.a}`
        if (!edgeInFace.has(key)) {
          const avgZ = (rotated3D[edge.a].z + rotated3D[edge.b].z) / 2
          items.push({ type: 'edge', edge, avgZ })
        }
      })

      // Sortierung nach Tiefe (hinten zuerst, absteigend)
      items.sort((a, b) => b.avgZ - a.avgZ)

      // Alle Elemente zeichnen
      for (const item of items) {
        if (item.type === 'face') {
          if (!item.visible) continue

          const { face, intensity } = item
          
          // Diffuses Shading: grüne Farbtöne mit Beleuchtungskontrast
          const r = Math.round(intensity * 25)
          const g = Math.round(intensity * 90 + 15) // gedecktes Grün
          const b = Math.round(intensity * 30 + 5)

          // Fläche füllen
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.85})`
          ctx.beginPath()
          const firstPt = projected[face.verts[0]]
          ctx.moveTo(firstPt.sx, firstPt.sy)
          for (let k = 1; k < face.verts.length; k++) {
            const pt = projected[face.verts[k]]
            ctx.lineTo(pt.sx, pt.sy)
          }
          ctx.closePath()
          ctx.fill()

          // Dünner, hell leuchtender Drahtgitter-Rand
          ctx.strokeStyle = `rgba(0, 255, 100, ${alpha * 0.9})`
          ctx.lineWidth   = 0.8
          ctx.stroke()
        } else {
          // Freie Kanten (z. B. Antennenstäbe, Klauen, freie Armsegmente)
          const { edge } = item
          ctx.strokeStyle = `rgba(0, 255, 100, ${alpha * 0.9})`
          ctx.lineWidth   = 0.8
          ctx.beginPath()
          ctx.moveTo(projected[edge.a].sx, projected[edge.a].sy)
          ctx.lineTo(projected[edge.b].sx, projected[edge.b].sy)
          ctx.stroke()
        }
      }
    }

    // ── Hilfsfunktion: Info-Overlay oben links ───────────────────────────────
    function drawInfoOverlay(W: number, _H: number, model: ModelDef, alpha: number) {
      const fSize = Math.max(8, Math.min(11, W * 0.028))
      ctx.font        = `${fSize}px monospace`
      ctx.textBaseline = 'top'

      // Halbtransparenter dunkler Hintergrund für den Text-Block
      const boxW = fSize * 18
      const boxH = fSize * 4.5
      ctx.fillStyle = `rgba(0, 0, 0, ${0.65 * alpha})`
      ctx.fillRect(6, 4, boxW, boxH)

      ctx.fillStyle = `rgba(0, 255, 128, ${alpha})`
      ctx.fillText(`MODEL  : ${model.name}`,        10, 8)
      ctx.fillText(`POLYS  : ${model.polyCount}`,   10, 8 + fSize * 1.3)
      ctx.fillText(`DIMS   : ${model.dimensions}`,  10, 8 + fSize * 2.6)
    }

    // ── Hilfsfunktion: Render-Modus-Label (SOLID / WIRE) ─────────────────────
    // Wird in der oberen rechten Ecke angezeigt.
    function drawModeLabel(W: number, alpha: number) {
      const fSize = Math.max(8, Math.min(11, W * 0.028))
      ctx.font        = `bold ${fSize}px monospace`
      ctx.textBaseline = 'top'

      const label = 'CAD MESH SHADED'
      const measured = ctx.measureText(label)
      const boxPad = 4
      const boxX = W - measured.width - boxPad * 2 - 8
      const boxY = 4

      // Hintergrund-Rechteck
      ctx.fillStyle = `rgba(0, 0, 0, ${0.75 * alpha})`
      ctx.fillRect(boxX, boxY, measured.width + boxPad * 2, fSize + boxPad * 2)

      ctx.fillStyle = `rgba(0, 255, 128, ${alpha})`
      ctx.fillText(label, boxX + boxPad, boxY + boxPad)
    }

    // ── Hilfsfunktion: Technisches Blueprint HUD zeichnen ────────────────────
    function drawBlueprintHUD(
      W: number,
      H: number,
      rx: number,
      ry: number,
      _model: ModelDef,
      alpha: number
    ) {
      ctx.save()

      // 1. Orthogonales technisches Gitter (Blueprint-Stil)
      ctx.strokeStyle = `rgba(0, 255, 128, ${0.03 * alpha})`
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

      // Viewport-Mitte
      const viewH  = H * 0.88
      const cx = W * 0.5
      const cy = viewH * 0.48

      // 2. Fadenkreuz in der Mitte
      ctx.strokeStyle = `rgba(0, 255, 128, ${0.15 * alpha})`
      ctx.lineWidth = 0.8
      
      // Kleiner Innenkreis
      ctx.beginPath()
      ctx.arc(cx, cy, 10, 0, Math.PI * 2)
      ctx.stroke()

      // Fadenkreuzstriche mit Lücke
      ctx.beginPath()
      // Links
      ctx.moveTo(cx - 55, cy)
      ctx.lineTo(cx - 15, cy)
      // Rechts
      ctx.moveTo(cx + 15, cy)
      ctx.lineTo(cx + 55, cy)
      // Oben
      ctx.moveTo(cx, cy - 55)
      ctx.lineTo(cx, cy - 15)
      // Unten
      ctx.moveTo(cx, cy + 15)
      ctx.lineTo(cx, cy + 55)
      ctx.stroke()

      // Dünne Hauptachsen durch das Zentrum
      ctx.strokeStyle = `rgba(0, 255, 128, ${0.06 * alpha})`
      ctx.beginPath()
      ctx.moveTo(0, cy)
      ctx.lineTo(W, cy)
      ctx.moveTo(cx, 0)
      ctx.lineTo(cx, H - 25)
      ctx.stroke()

      // Skalenstriche (Ticks) auf den Hauptachsen
      ctx.strokeStyle = `rgba(0, 255, 128, ${0.20 * alpha})`
      ctx.beginPath()
      // Horizontale Ticks
      for (let offset = 20; offset < W / 2; offset += 20) {
        ctx.moveTo(cx + offset, cy - 3)
        ctx.lineTo(cx + offset, cy + 3)
        ctx.moveTo(cx - offset, cy - 3)
        ctx.lineTo(cx - offset, cy + 3)
      }
      // Vertikale Ticks
      for (let offset = 20; offset < H / 2; offset += 20) {
        ctx.moveTo(cx - 3, cy + offset)
        ctx.lineTo(cx + 3, cy + offset)
        ctx.moveTo(cx - 3, cy - offset)
        ctx.lineTo(cx + 3, cy - offset)
      }
      ctx.stroke()

      // 3. Technische Eckwinkel
      const pad = 12
      const len = 15
      ctx.strokeStyle = `rgba(0, 255, 128, ${0.35 * alpha})`
      ctx.lineWidth = 1.0
      ctx.beginPath()
      // Oben-Links
      ctx.moveTo(pad + len, pad)
      ctx.lineTo(pad, pad)
      ctx.lineTo(pad, pad + len)
      // Oben-Rechts
      ctx.moveTo(W - pad - len, pad)
      ctx.lineTo(W - pad, pad)
      ctx.lineTo(W - pad, pad + len)
      // Unten-Links (über Statuszeile)
      const bottomY = H - 24
      ctx.moveTo(pad + len, bottomY)
      ctx.lineTo(pad, bottomY)
      ctx.lineTo(pad, bottomY - len)
      // Unten-Rechts
      ctx.moveTo(W - pad - len, bottomY)
      ctx.lineTo(W - pad, bottomY)
      ctx.lineTo(W - pad, bottomY - len)
      ctx.stroke()

      // 4. Technische HUD-Texte & Winkelanzeige
      ctx.fillStyle = `rgba(0, 255, 128, ${0.7 * alpha})`
      ctx.font = '9px monospace'
      
      const degX = ((rx * 180 / Math.PI) % 360).toFixed(1)
      const degY = ((ry * 180 / Math.PI) % 360).toFixed(1)

      // Rechtsbündige Labels
      ctx.textAlign = 'right'
      ctx.fillText(`PROJ: ISO-A (3D CAD)`, W - 20, 24)
      ctx.fillText(`ROT-X: ${degX}°`, W - 20, 36)
      ctx.fillText(`ROT-Y: ${degY}°`, W - 20, 48)
      ctx.fillText(`SCALE: 0.70x`, W - 20, 60)

      // Linksbündige Diagnostics (unter dem Haupt-Overlay)
      ctx.textAlign = 'left'
      const diagY = 90
      ctx.fillText(`SYS.STATUS : NOMINAL`, 10, diagY)
      ctx.fillText(`MESH_TYPE  : SHADED_WIREFRAME`, 10, diagY + 12)
      ctx.fillText(`DRAW_CALLS : 1`, 10, diagY + 24)
      ctx.fillText(`BUFFERS    : DOUBLE`, 10, diagY + 36)

      ctx.restore()
    }

    // ── Hilfsfunktion: Statuszeile unten ─────────────────────────────────────
    function drawStatusBar(W: number, H: number, model: ModelDef) {
      const fSize = Math.max(7, Math.min(10, W * 0.025))
      ctx.font        = `${fSize}px monospace`
      ctx.textBaseline = 'bottom'

      // Blinke-Cursor: alle 500ms wechseln
      const cursor = blinkPhase < 0.5 ? '█' : ' '

      const statusText = `ROTATING VIEW · AUTO-ANALYZE ACTIVE · ${model.name} ${cursor}`
      ctx.fillStyle = 'rgba(0, 200, 90, 0.70)'
      ctx.fillText(statusText, 8, H - 4)

      // Separatorlinie über der Statuszeile
      ctx.strokeStyle = 'rgba(0, 120, 50, 0.50)'
      ctx.lineWidth   = 0.5
      ctx.beginPath()
      ctx.moveTo(0, H - fSize - 8)
      ctx.lineTo(W, H - fSize - 8)
      ctx.stroke()
    }

    // ── Haupt-Render-Loop ─────────────────────────────────────────────────────
    let lastT = 0

    function loop(t: number) {
      if (!alive) return

      // dt auf max. 80ms begrenzen (verhindert Sprünge nach Tab-Wechsel)
      const dt = Math.min((t - lastT) / 1000, 0.08)
      lastT = t

      const W = canvas.width
      const H = canvas.height

      // ── Zustand aktualisieren ──────────────────────────────────────────────

      // Y-Rotation: gleichmäßige Drehbühne (~0.35 Umdrehungen pro Sekunde)
      ry += 0.35 * dt

      // X-Kipp-Phase: langsam schwingende Bewegung für den 3D-Eindruck
      rxPhase += 0.4 * dt
      const rx = 0.18 + Math.sin(rxPhase) * 0.12  // leichtes Vor-/Zurückkippen

      // Blinke-Phase: 0..1, zyklisch (~ 1s Periode)
      blinkPhase = (blinkPhase + dt) % 1.0

      // ── Modell-Wechsel-Logik ───────────────────────────────────────────────
      switchTimer -= dt * 1000

      if (!fadingOut && !fadingIn && switchTimer <= 1000) {
        // 1 Sekunde vor dem Wechsel: Fade-Out starten
        fadingOut = true
        fadeAlpha = 1.0
      }

      if (fadingOut) {
        fadeAlpha -= dt * 1.5   // in ~0.65s ausblenden
        if (fadeAlpha <= 0) {
          fadeAlpha = 0
          fadingOut = false
          // Modell wechseln + neue Startrotation
          modelIdx   = (modelIdx + 1) % MODELS.length
          slotCount  = slotCount + 1   // Slot-Zähler
          ry         = Math.random() * Math.PI * 2
          rxPhase    = Math.random() * Math.PI * 2
          switchTimer = 12000
          // Direkt mit Fade-In beginnen
          fadingIn  = true
        }
      }

      if (fadingIn) {
        fadeAlpha += dt * 1.5   // in ~0.65s einblenden
        if (fadeAlpha >= 1) {
          fadeAlpha = 1.0
          fadingIn  = false
        }
      }

      // Wenn weder ein Fade läuft: volles Alpha
      const modelAlpha = fadingOut || fadingIn ? fadeAlpha : 1.0

      // ── Rendering ─────────────────────────────────────────────────────────

      // Schritt 1: Schwarzer Hintergrund
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // Schritt 2: Technisches Blueprint-Gitter & Fadenkreuz im Hintergrund
      drawBlueprintHUD(W, H, rx, ry, MODELS[modelIdx], modelAlpha)

      // Schritt 3: Perspektivgitter im Hintergrund (Bodenraster)
      drawGrid(W, H)

      // Schritt 4: Modell zentriert im oberen 85% des Canvas
      const viewH  = H * 0.88
      const centerX = W * 0.5
      const centerY = viewH * 0.48
      // Skalierung: 0.70x für größere 3D-Modelle (füllt 65-75% des Panels)
      const scale  = Math.min(W, viewH) * 0.70

      // Schritt 5: Koordinatenachsen zeichnen (hinter dem Modell, gleiche Rotation)
      drawAxes(centerX, centerY, scale, rx, ry)

      // Schritt 6: Modell zeichnen (Immer Shaded CAD Mesh: gefüllte Flächen + leuchtende Kanten)
      drawModelCADMesh(MODELS[modelIdx], centerX, centerY, scale, rx, ry, modelAlpha)

      // Schritt 7: Info-Overlay oben links
      drawInfoOverlay(W, H, MODELS[modelIdx], modelAlpha)

      // Schritt 8: Render-Modus-Label oben rechts
      drawModeLabel(W, modelAlpha)

      // Schritt 9: Statuszeile unten
      drawStatusBar(W, H, MODELS[modelIdx])

      rafId = requestAnimationFrame(loop)
    }

    // Animationsloop starten
    rafId = requestAnimationFrame((t) => { lastT = t; loop(t) })

    // Cleanup: Loop stoppen, ResizeObserver trennen
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

export default memo(CADRobotPanel);
