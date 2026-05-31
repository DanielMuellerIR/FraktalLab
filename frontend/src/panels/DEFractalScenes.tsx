import React from 'react'
import ShaderPanel from '../ui/ShaderPanel'
import {
  MANDELBULB_SHADER,
  APOLLONIAN_SHADER,
  MENGER_SHADER
} from '../utils/de-fractals-shaders'

export const MandelbulbScene = React.memo(function MandelbulbScene() {
  // Random start hue per mount (0..2π) — different color each time.
  const hue = React.useMemo(() => Math.random() * Math.PI * 2, [])
  return (
    <ShaderPanel
      fragmentShader={MANDELBULB_SHADER}
      uniforms={{ uHueShift: hue }}
      title="MANDELBULB EXPLORER // POWER-8 MORPH"
      attribution="Mandelbulb by Antigravity (DE-Upgrade)"
    />
  )
})

export const ApollonianGasketScene = React.memo(function ApollonianGasketScene() {
  return (
    <ShaderPanel
      fragmentShader={APOLLONIAN_SHADER}
      title="APOLLONIAN GASKET // SPACE FOLD"
      attribution="Apollonian Gasket by Antigravity"
    />
  )
})

export const MengerSpongeScene = React.memo(function MengerSpongeScene() {
  // Random start hue per mount — not always orange.
  const hue = React.useMemo(() => Math.random() * Math.PI * 2, [])
  return (
    <ShaderPanel
      fragmentShader={MENGER_SHADER}
      uniforms={{ uHueShift: hue }}
      title="MENGER SPONGE // INFINITE GRID"
      attribution="Menger Sponge by Antigravity"
    />
  )
})
