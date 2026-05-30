import React from 'react'
import ShaderPanel from '../ui/ShaderPanel'
import {
  MANDELBULB_SHADER,
  APOLLONIAN_SHADER,
  MENGER_SHADER
} from '../utils/de-fractals-shaders'

export const MandelbulbScene = React.memo(function MandelbulbScene() {
  return (
    <ShaderPanel
      fragmentShader={MANDELBULB_SHADER}
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
  return (
    <ShaderPanel
      fragmentShader={MENGER_SHADER}
      title="MENGER SPONGE // INFINITE GRID"
      attribution="Menger Sponge by Antigravity"
    />
  )
})
