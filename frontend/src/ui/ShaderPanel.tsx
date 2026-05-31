import React, { useEffect, useRef, useState, memo } from 'react'
import Panel from './Panel'
import { subscribe } from '../utils/raf-coordinator'
import {
  acquireWebGLSlot,
  releaseWebGLSlot,
  updateWebGLSlotActivity,
} from '../utils/webgl-pool'

interface ShaderPanelProps {
  fragmentShader: string
  uniforms?: Record<string, number | number[]>
  title: string
  attribution?: string
  textureData?: {
    data: Uint8Array | HTMLImageElement | HTMLCanvasElement
    width?: number
    height?: number
  }
  noPanel?: boolean
}

const VERTEX_SHADER_SOURCE = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

function ShaderPanel({ fragmentShader, uniforms, title, attribution, textureData, noPanel = false }: ShaderPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Status for WebGL Context Pool eviction
  const [hasContext, setHasContext] = useState(true)
  const [wakeTrigger, setWakeTrigger] = useState(0)

  // Track mouse coordinates for iMouse Shadertoy uniform
  const mouseRef = useRef({ x: 0, y: 0, clickX: 0, clickY: 0, active: false })

  // Keep a unique ID for the pool registration
  const panelIdRef = useRef<string | null>(null)
  if (!panelIdRef.current) {
    panelIdRef.current = `shader-panel-${Math.random().toString(36).substr(2, 9)}`
  }
  const panelId = panelIdRef.current

  // Store custom uniforms in ref to prevent stale closures and avoid unnecessary WebGL teardowns
  const currentUniformsRef = useRef(uniforms)
  currentUniformsRef.current = uniforms

  const uniformsKeys = Object.keys(uniforms || {}).join(',')

  useEffect(() => {
    let alive = true
    let isVisible = true
    let gl: WebGLRenderingContext | null = null
    let program: WebGLProgram | null = null
    let tex: WebGLTexture | null = null
    let unsubscribeRaf: (() => void) | null = null

    // Helper: Compile individual shaders
    function compileShader(source: string, type: number): WebGLShader | null {
      if (!gl) return null
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`[ShaderPanel] Shader compile error (${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'}):`, gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    // Main WebGL initializer
    function initGL() {
      const canvas = canvasRef.current
      if (!canvas) return false

      const options = { preserveDrawingBuffer: true }
      gl = (canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options)) as WebGLRenderingContext | null
      if (!gl) {
        console.error('[ShaderPanel] Failed to retrieve WebGL context.')
        return false
      }

      // Enable standard derivatives extension for fwidth/dFdx/dFdy support
      gl.getExtension('OES_standard_derivatives')

      // Compile Shaders
      const vs = compileShader(VERTEX_SHADER_SOURCE, gl.VERTEX_SHADER)
      if (!vs) return false

      // Generate complete Fragment Shader (Shadertoy Adapter)
      let fullFragmentShader = fragmentShader
      if (fragmentShader.includes('mainImage') && !fragmentShader.includes('void main()')) {
        let customUniformsDecl = ''
        if (textureData && !new RegExp(`uniform\\s+sampler2D\\s+uHeightmap\\b`).test(fragmentShader)) {
          customUniformsDecl += 'uniform sampler2D uHeightmap;\n'
        }
        if (uniforms) {
          for (const key of Object.keys(uniforms)) {
            if (key === 'iTime' || key === 'iResolution' || key === 'iMouse') continue
            const isAlreadyDeclared = new RegExp(`uniform\\s+\\w+\\s+${key}\\b`).test(fragmentShader)
            if (isAlreadyDeclared) continue
            const val = uniforms[key]
            if (Array.isArray(val)) {
              if (val.length === 2) customUniformsDecl += `uniform vec2 ${key};\n`
              else if (val.length === 3) customUniformsDecl += `uniform vec3 ${key};\n`
              else if (val.length === 4) customUniformsDecl += `uniform vec4 ${key};\n`
            } else {
              customUniformsDecl += `uniform float ${key};\n`
            }
          }
        }

        fullFragmentShader = `
          #extension GL_OES_standard_derivatives : enable
          precision highp float;
          uniform vec3 iResolution;
          uniform float iTime;
          uniform vec4 iMouse;
          ${customUniformsDecl}

          ${fragmentShader}

          void main() {
            mainImage(gl_FragColor, gl_FragCoord.xy);
          }
        `
      }

      const fs = compileShader(fullFragmentShader, gl.FRAGMENT_SHADER)
      if (!fs) return false

      // Link program
      program = gl.createProgram()
      if (!program) return false
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.linkProgram(program)

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('[ShaderPanel] Program link error:', gl.getProgramInfoLog(program))
        return false
      }

      gl.useProgram(program)

      // Setup screen filling quad buffer
      const vertices = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ])
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

      const positionLoc = gl.getAttribLocation(program, 'position')
      gl.enableVertexAttribArray(positionLoc)
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

      if (textureData && textureData.data) {
        tex = gl.createTexture()
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        if (textureData.data instanceof Uint8Array) {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.LUMINANCE,
            textureData.width || 256,
            textureData.height || 128,
            0,
            gl.LUMINANCE,
            gl.UNSIGNED_BYTE,
            textureData.data
          )
        } else {
          // HTMLImageElement or HTMLCanvasElement
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            textureData.data
          )
        }

        // WebGL 1.0 requires NPOT textures to have CLAMP_TO_EDGE wrapping and no mipmaps
        const isPowerOf2 = (v: number) => v > 0 && (v & (v - 1)) === 0
        const texW = textureData.width || (textureData.data instanceof HTMLImageElement ? textureData.data.width : 256)
        const texH = textureData.height || (textureData.data instanceof HTMLImageElement ? textureData.data.height : 128)
        const isPOT = isPowerOf2(texW) && isPowerOf2(texH)

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, isPOT ? gl.REPEAT : gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, isPOT ? gl.REPEAT : gl.CLAMP_TO_EDGE)

        const texLoc = gl.getUniformLocation(program, 'uHeightmap')
        if (texLoc) {
          gl.uniform1i(texLoc, 0)
        }
      }

      return true
    }

    // Core render frame
    function renderFrame(t: number) {
      if (!alive || !isVisible || !gl || !program) return

      const canvas = canvasRef.current
      if (!canvas) return

      // Dynamic resize check
      const cw = containerRef.current?.clientWidth || 300
      const ch = containerRef.current?.clientHeight || 200
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
        gl.viewport(0, 0, cw, ch)
      }

      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      // Map Built-in Shadertoy Uniforms
      const timeLoc = gl.getUniformLocation(program, 'iTime')
      if (timeLoc) {
        gl.uniform1f(timeLoc, t / 1000.0)
      }

      const resLoc = gl.getUniformLocation(program, 'iResolution')
      if (resLoc) {
        gl.uniform3f(resLoc, canvas.width, canvas.height, 1.0)
      }

      const mouseLoc = gl.getUniformLocation(program, 'iMouse')
      if (mouseLoc) {
        const m = mouseRef.current
        gl.uniform4f(mouseLoc, m.x, m.y, m.clickX, m.clickY)
      }

      // Map Custom Uniforms
      const currentUniforms = currentUniformsRef.current
      if (currentUniforms) {
        for (const key of Object.keys(currentUniforms)) {
          const val = currentUniforms[key]
          const loc = gl.getUniformLocation(program, key)
          if (!loc) continue

          if (Array.isArray(val)) {
            if (val.length === 2) gl.uniform2f(loc, val[0], val[1])
            else if (val.length === 3) gl.uniform3f(loc, val[0], val[1], val[2])
            else if (val.length === 4) gl.uniform4f(loc, val[0], val[1], val[2], val[3])
          } else {
            gl.uniform1f(loc, val)
          }
        }
      }

      if (gl && tex && textureData && textureData.data) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        if (textureData.data instanceof HTMLCanvasElement) {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            textureData.data
          )
        } else if (textureData.data instanceof Uint8Array) {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.LUMINANCE,
            textureData.width || 256,
            textureData.height || 128,
            0,
            gl.LUMINANCE,
            gl.UNSIGNED_BYTE,
            textureData.data
          )
        } else if (textureData.data instanceof HTMLImageElement) {
          if (textureData.data.complete && textureData.data.naturalWidth !== 0) {
            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              gl.RGBA,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              textureData.data
            )
          }
        }
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    // Context loss handler triggered by pool eviction
    function onEvicted() {
      if (!alive) return
      setHasContext(false)
      if (unsubscribeRaf) {
        unsubscribeRaf()
        unsubscribeRaf = null
      }
      try {
        if (gl) {
          const ext = gl.getExtension('WEBGL_lose_context')
          if (ext) {
            ext.loseContext()
          }
        }
      } catch (e) {
        console.warn('[ShaderPanel] Failed to cleanly lose WebGL context:', e)
      }
      gl = null
      program = null
    }

    // Try to acquire slot and initialize
    function acquireAndStart() {
      if (!alive) return

      const acquired = acquireWebGLSlot(panelId, onEvicted, isVisible)
      if (acquired) {
        setHasContext(true)
        // Request frame loop registration
        setTimeout(() => {
          if (alive && initGL()) {
            if (!unsubscribeRaf && isVisible) {
              unsubscribeRaf = subscribe(renderFrame)
            }
          }
        }, 30)
      }
    }

    // Setup viewport intersection observer
    const io = new IntersectionObserver(([e]) => {
      isVisible = e.isIntersecting
      updateWebGLSlotActivity(panelId, isVisible)

      if (isVisible) {
        if (hasContext) {
          if (!unsubscribeRaf) {
            unsubscribeRaf = subscribe(renderFrame)
          }
        } else {
          acquireAndStart()
        }
      } else {
        if (unsubscribeRaf) {
          unsubscribeRaf()
          unsubscribeRaf = null
        }
      }
    })

    const containerEl = containerRef.current
    if (containerEl) {
      io.observe(containerEl)
    }

    // Initial activation
    acquireAndStart()

    return () => {
      alive = false
      if (unsubscribeRaf) {
        unsubscribeRaf()
      }
      if (containerEl) {
        io.unobserve(containerEl)
      }
      releaseWebGLSlot(panelId)
      try {
        if (gl) {
          if (tex) gl.deleteTexture(tex)
          const ext = gl.getExtension('WEBGL_lose_context')
          if (ext) ext.loseContext()
        }
      } catch (_) {}
    }
  }, [fragmentShader, uniformsKeys, wakeTrigger, panelId, textureData?.data, textureData?.width, textureData?.height])

  // Mouse Listeners mapping coordinates matching Shadertoy specifications
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = rect.height - (e.clientY - rect.top) // Flip Y-axis matching GLSL

    if (mouseRef.current.active) {
      mouseRef.current.x = x
      mouseRef.current.y = y
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = rect.height - (e.clientY - rect.top)

    mouseRef.current.active = true
    mouseRef.current.x = x
    mouseRef.current.y = y
    mouseRef.current.clickX = x
    mouseRef.current.clickY = y
  }

  const handleMouseUp = () => {
    mouseRef.current.active = false
    // Shadertoy keeps click coordinates negative on release
    mouseRef.current.clickX = -Math.abs(mouseRef.current.clickX)
    mouseRef.current.clickY = -Math.abs(mouseRef.current.clickY)
  }

  const content = (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative bg-black select-none cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {hasContext && (
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      )}
      {attribution && hasContext && (
        <div className="absolute bottom-1 left-2 px-1 bg-black/60 border border-green-950/20 text-[8px] font-mono text-green-700/60 rounded select-none pointer-events-none uppercase tracking-wider">
          {attribution}
        </div>
      )}
      {!hasContext && (
        <div
          onClick={() => {
            setHasContext(true)
            setWakeTrigger(prev => prev + 1)
          }} // Clicking wakes up the context
          className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/90 border border-dashed border-green-950/40 text-center cursor-pointer group hover:bg-green-950/10 active:bg-green-950/20 transition-all duration-200 z-10"
        >
          {/* Hacker decoration brackets */}
          <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-green-900 group-hover:border-green-600 transition-colors" />
          <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-green-900 group-hover:border-green-600 transition-colors" />
          <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-green-900 group-hover:border-green-600 transition-colors" />
          <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-green-900 group-hover:border-green-600 transition-colors" />

          <div className="text-green-800 group-hover:text-green-500 font-mono text-[10px] tracking-widest font-bold mb-2 transition-colors uppercase">
            [ GPU CONTEXT EVACUATED ]
          </div>
          <div className="text-neutral-500 group-hover:text-neutral-300 font-mono text-[9px] transition-colors leading-relaxed">
            SLOT EVICTED TO CONSERVE POWER.<br />
            CLICK INSIDE GRID TO AWAKEN INTERLUDE.
          </div>
        </div>
      )}
    </div>
  )

  if (noPanel) {
    return content
  }

  return (
    <Panel title={title}>
      {content}
    </Panel>
  )
}

export default memo(ShaderPanel)
