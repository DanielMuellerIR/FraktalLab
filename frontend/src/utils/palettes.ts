// ── Neon & Retro Palette System ──────────────────────────────────────────────
// Based on Inigo Quilez procedural cosine palettes:
// color(t) = a + b * cos(2 * pi * (c * t + d))
//
// Each palette is defined by 4 vec3 parameters: a, b, c, d.

export interface CosinePalette {
  name: string
  a: [number, number, number]
  b: [number, number, number]
  c: [number, number, number]
  d: [number, number, number]
}

export const PALETTES: Record<string, CosinePalette> = {
  // Classic 80s Cyberpunk / Vaporwave: Pink, Indigo, Cyan
  vapor: {
    name: 'Vaporwave',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.3, 0.2, 0.2]
  },
  // Hot lava/magma: Red, Orange, Gold, Deep Purple
  magma: {
    name: 'Magma',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [2.0, 1.0, 0.0],
    d: [0.5, 0.20, 0.25]
  },
  // Cool ice/cyber: Cyan, Teal, Deep Blue, Silver
  ice: {
    name: 'Ice',
    a: [0.8, 0.9, 1.0],
    b: [0.2, 0.1, 0.0],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.1, 0.2]
  },
  // Warm Sunset/Outrun: Purple, Orange, Magenta, Gold
  sunset: {
    name: 'Sunset',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67]
  },
  // Bright Toxic: Lime, Green, Yellow, Emerald
  toxic: {
    name: 'Toxic',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.1, 0.3]
  },
  // Warm Amber / Retro Terminals: Gold, Yellow, Orange, Brown
  amber: {
    name: 'Amber',
    a: [0.5, 0.4, 0.2],
    b: [0.5, 0.4, 0.2],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.15, 0.3]
  },
  // Psychedelic Rainbow
  rainbow: {
    name: 'Rainbow',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67]
  },
  // Fire/Plasma: Red, Yellow, White, Orange
  fire: {
    name: 'Fire',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 0.7, 0.4],
    d: [0.0, 0.15, 0.20]
  }
}

// Get raw RGB triplet for a palette at parameter t [0, 1]
export function getPaletteColor(pal: CosinePalette, t: number): [number, number, number] {
  const r = pal.a[0] + pal.b[0] * Math.cos(2 * Math.PI * (pal.c[0] * t + pal.d[0]))
  const g = pal.a[1] + pal.b[1] * Math.cos(2 * Math.PI * (pal.c[1] * t + pal.d[1]))
  const b = pal.a[2] + pal.b[2] * Math.cos(2 * Math.PI * (pal.c[2] * t + pal.d[2]))
  
  return [
    Math.max(0, Math.min(1, r)),
    Math.max(0, Math.min(1, g)),
    Math.max(0, Math.min(1, b))
  ]
}

// Randomly select a palette name
export function getRandomPaletteName(): string {
  const keys = Object.keys(PALETTES)
  return keys[Math.floor(Math.random() * keys.length)]
}

// Helper to get uniforms for a given palette
export function getPaletteUniforms(palName: string, shift: number = 0) {
  const pal = PALETTES[palName] || PALETTES.vapor
  return {
    uPalA: pal.a,
    uPalB: pal.b,
    uPalC: pal.c,
    uPalD: pal.d,
    uPaletteShift: shift,
  }
}

