import React, { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── HSL→RGB Helfer ───────────────────────────────────────────────────────────
function hsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2*l - 1)) * s
  const x = c * (1 - Math.abs((h/60) % 2 - 1))
  const m = l - c/2
  let r = 0, g = 0, b = 0
  if      (h < 60)  { r=c; g=x }
  else if (h < 120) { r=x; g=c }
  else if (h < 180) { g=c; b=x }
  else if (h < 240) { g=x; b=c }
  else if (h < 300) { r=x; b=c }
  else              { r=c; b=x }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)]
}

// ── Factory: erstellt Panel-Komponente aus Render-Callback ───────────────────
// Zustand wird per Ref gehalten → kein Re-render bei Frame-Updates.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeScene(
  title: string,
  W: number,
  H: number,
  mkState: () => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draw: (buf: Uint8ClampedArray, W: number, H: number, t: number, s: any) => void,
): () => React.JSX.Element {
  return function Scene() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateRef = useRef<any>(null)

    useEffect(() => {
      stateRef.current = mkState()
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      let raf: number
      let alive = true

      function loop(t: number) {
        if (!alive) return
        const img = ctx.createImageData(W, H)
        draw(img.data, W, H, t, stateRef.current)
        ctx.putImageData(img, 0, 0)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => { alive = false; cancelAnimationFrame(raf) }
    }, [])

    return (
      <Panel title={title}>
        {/* Zentrierende Wrapper-Box: Canvas skaliert mit korrektem Seitenverhältnis */}
        <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <canvas
            ref={canvasRef}
            width={W} height={H}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '100%',
              aspectRatio: `${W} / ${H}`,
              imageRendering: 'pixelated',
              display: 'block',
            }}
          />
        </div>
      </Panel>
    )
  }
}

// ── Effekt 1: Feuer — Doom-Algorithmus ───────────────────────────────────────
// Hitze von unten nach oben propagieren + leicht abkühlen → typisches Flammen-Muster
export const FireScene = makeScene(
  'CORE MELTDOWN // STATUS: CRITICAL', 80, 50,
  () => new Uint8Array(80 * 50),
  (buf, W, H, _t, heat: Uint8Array) => {
    for (let x = 0; x < W; x++)
      heat[(H-1)*W+x] = Math.random() > 0.2 ? 255 : 180 + Math.floor(Math.random()*75)

    for (let y = 1; y < H; y++)
      for (let x = 0; x < W; x++) {
        const a = heat[y*W+x], bl = heat[y*W+Math.max(0,x-1)], br = heat[y*W+Math.min(W-1,x+1)]
        heat[(y-1)*W+x] = Math.max(0, Math.floor((a+bl+br)/3) - 4)
      }

    for (let i = 0; i < W*H; i++) {
      const h = heat[i], pi = i*4
      if      (h < 64)  { buf[pi]=h*4;  buf[pi+1]=0;        buf[pi+2]=0 }
      else if (h < 128) { buf[pi]=255;  buf[pi+1]=(h-64)*4; buf[pi+2]=0 }
      else if (h < 192) { buf[pi]=255;  buf[pi+1]=255;      buf[pi+2]=(h-128)*4 }
      else              { buf[pi]=255;  buf[pi+1]=255;      buf[pi+2]=255 }
      buf[pi+3] = 255
    }
  },
)

// ── Effekt 2: Starfield — 3D-Sterne fliegen auf die Kamera zu ────────────────
type Star = { x: number; y: number; z: number }
export const StarfieldScene = makeScene(
  'DEEP SPACE // SCANNING SECTOR 9', 80, 50,
  (): Star[] => Array.from({length:150}, () => ({
    x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2, z: Math.random(),
  })),
  (buf, W, H, _t, stars: Star[]) => {
    buf.fill(0)
    for (let i = 3; i < buf.length; i+=4) buf[i] = 255

    for (const s of stars) {
      s.z -= 0.006
      if (s.z <= 0.01) { s.x=(Math.random()-0.5)*2; s.y=(Math.random()-0.5)*2; s.z=1; continue }
      const sx = Math.round(s.x/s.z*W*0.45 + W/2)
      const sy = Math.round(s.y/s.z*H*0.45 + H/2)
      if (sx<0||sx>=W||sy<0||sy>=H) continue
      const br  = Math.round(255*(1-s.z))
      const ext = s.z < 0.15 ? 1 : 0  // helle Sterne nahe der Kamera etwas größer
      for (let dy=-ext; dy<=ext; dy++)
        for (let dx=-ext; dx<=ext; dx++) {
          const px=sx+dx, py=sy+dy
          if (px<0||px>=W||py<0||py>=H) continue
          const pi=(py*W+px)*4
          buf[pi]=br; buf[pi+1]=br; buf[pi+2]=br; buf[pi+3]=255
        }
    }
  },
)

// ── Effekt 3: Tunnel — rotierendes Schachbrett-Tunnel (Amiga-Klassiker) ──────
export const TunnelScene = makeScene(
  'WORMHOLE // TRANSIT ACTIVE', 80, 50,
  () => null,
  (buf, W, H, t) => {
    const ts = t * 0.001
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const cx=x-W/2, cy=y-H/2, r=Math.sqrt(cx*cx+cy*cy)+0.001
        const u = Math.atan2(cy,cx)/Math.PI + ts*0.3
        const v = 20/r + ts*0.6
        const checker = (Math.floor(u*3) + Math.floor(v*3)) & 1
        const [ri,gi,bi] = hsl((r*5+ts*50)%360, 1, checker ? 0.6 : 0.07)
        const pi=(y*W+x)*4
        buf[pi]=ri; buf[pi+1]=gi; buf[pi+2]=bi; buf[pi+3]=255
      }
  },
)

// ── Effekt 4: Rotozoom — rotierende + zoomende Kacheln ───────────────────────
export const RotozoomScene = makeScene(
  'TESSERACT ROTATION // DECRYPTING', 80, 50,
  () => null,
  (buf, W, H, t) => {
    const ts  = t * 0.001
    const z   = 0.04 + 0.03*Math.sin(ts*0.5)
    const cos = Math.cos(ts*0.6)*z, sin = Math.sin(ts*0.6)*z
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const cx=x-W/2, cy=y-H/2
        const sx=cx*cos-cy*sin, sy=cx*sin+cy*cos
        const checker = (Math.floor(sx) + Math.floor(sy)) & 1
        const [ri,gi,bi] = hsl(Math.abs(((sx+sy)*10+ts*40)%360), 1, checker ? 0.55 : 0.05)
        const pi=(y*W+x)*4
        buf[pi]=ri; buf[pi+1]=gi; buf[pi+2]=bi; buf[pi+3]=255
      }
  },
)

// ── Effekt 5: Metaballs — flüssige Blobs mit Farbgewichtung ─────────────────
type Ball = { x:number; y:number; vx:number; vy:number; r:number; hue:number }
export const MetaballsScene = makeScene(
  'LIQUID CODE // RENDERING', 80, 50,
  // Zufällige Startpositionen — jeder Mount sieht andere Blob-Konfiguration
  (): Ball[] => Array.from({length:5}, (_,i) => ({
    x:5+Math.random()*70, y:5+Math.random()*40,
    vx:(Math.random()-0.5)*0.9, vy:(Math.random()-0.5)*0.9,
    r:7+Math.random()*10, hue:(i*72 + Math.floor(Math.random()*30))%360,
  })),
  (buf, W, H, _t, balls: Ball[]) => {
    for (const b of balls) {
      b.x+=b.vx; b.y+=b.vy
      if (b.x<0||b.x>W) b.vx*=-1
      if (b.y<0||b.y>H) b.vy*=-1
    }
    for (let y=0; y<H; y++)
      for (let x=0; x<W; x++) {
        let sum=0, rW=0, gW=0, bW=0
        for (const b of balls) {
          const w = b.r*b.r / ((x-b.x)**2 + (y-b.y)**2 + 1)
          sum+=w
          const [br,bg,bb]=hsl(b.hue,1,0.5)
          rW+=br*w; gW+=bg*w; bW+=bb*w
        }
        const pi=(y*W+x)*4
        if (sum>1) { buf[pi]=Math.min(255,rW/sum); buf[pi+1]=Math.min(255,gW/sum); buf[pi+2]=Math.min(255,bW/sum) }
        else       { buf[pi]=0; buf[pi+1]=0; buf[pi+2]=0 }
        buf[pi+3]=255
      }
  },
)

// ── Effekt 6: Dotcloud — rotierende 3D-Punktwolke (Fibonacci-Kugel) ──────────
type Dot = { x:number; y:number; z:number; hue:number }
export const DotCloudScene = makeScene(
  'NEURAL NET // 300 NODES ACTIVE', 80, 50,
  (): Dot[] => Array.from({length:300}, (_,i) => {
    const phi=Math.acos(1-2*(i+0.5)/300), theta=Math.PI*(1+Math.sqrt(5))*i
    return { x:Math.sin(phi)*Math.cos(theta), y:Math.sin(phi)*Math.sin(theta), z:Math.cos(phi), hue:i*1.2%360 }
  }),
  (buf, W, H, t, dots: Dot[]) => {
    buf.fill(0); for (let i=3;i<buf.length;i+=4) buf[i]=255
    const ts=t*0.001
    const cy=Math.cos(ts*0.3), sy=Math.sin(ts*0.3)
    const cx=Math.cos(ts*0.19), sx=Math.sin(ts*0.19)
    for (const p of dots) {
      const x1=p.x*cy-p.z*sy, z1=p.x*sy+p.z*cy
      const y2=p.y*cx-z1*sx,  z2=p.y*sx+z1*cx
      const d=z2+2, px2=Math.round(x1*W*0.6/d+W/2), py2=Math.round(y2*W*0.6/d+H/2)
      if (px2<0||px2>=W||py2<0||py2>=H) continue
      const [r,g,b]=hsl(p.hue,1,((z2+1)/2)*0.5)
      const pi=(py2*W+px2)*4
      buf[pi]=r; buf[pi+1]=g; buf[pi+2]=b; buf[pi+3]=255
    }
  },
)

// ── Effekt 7: Boing — klassischer Amiga-Demo-Ball ────────────────────────────
// Rotierender rot-weißer Karierter Ball hüpft im Panel
export const BoingScene = makeScene(
  'OBJECT 7 // TRAJECTORY STABLE', 60, 60,
  () => null,
  (buf, W, H, t) => {
    buf.fill(0); for (let i=3;i<buf.length;i+=4) buf[i]=255
    const ts=t*0.001
    const bx=W/2+Math.sin(ts*0.7)*W*0.28
    const by=H*0.55 - Math.abs(Math.sin(ts*1.1))*H*0.38
    const rad=Math.min(W,H)*0.33
    const rot=ts*1.8

    for (let y=0; y<H; y++)
      for (let x=0; x<W; x++) {
        const dx=x-bx, dy=y-by, d2=dx*dx+dy*dy
        if (d2>rad*rad) continue
        const nz=Math.sqrt(Math.max(0,1-d2/(rad*rad)))
        const nx=dx/rad, ny=dy/rad
        const light=Math.max(0.15, 0.4*nx-0.3*ny+0.85*nz)
        // Kugel-UV aus Normale → Schachbrettmuster
        const ua=(Math.atan2(ny,nx)+rot)/(Math.PI/3)
        const ub=Math.asin(Math.max(-1,Math.min(1,nz)))/(Math.PI/3)
        const checker=((Math.floor(ua)+Math.floor(ub))&1)
        const c=Math.round(light*255), pi=(y*W+x)*4
        if (checker) { buf[pi]=c;   buf[pi+1]=0; buf[pi+2]=0 }  // Rot
        else         { buf[pi]=c;   buf[pi+1]=c; buf[pi+2]=c }  // Weiß
        buf[pi+3]=255
      }
  },
)

// ── Effekt 8: Lissajous — animierte Kurve mit Nachleucht-Spur ────────────────
export const LissajousScene = makeScene(
  'SIGNAL TRACE // LISSAJOUS Ω', 80, 50,
  () => new Uint8Array(80*50),
  (buf, W, H, t, trail: Uint8Array) => {
    const ts=t*0.001
    for (let i=0;i<trail.length;i++) trail[i]=Math.max(0,trail[i]-5)
    // Parametrisch 30 Punkte pro Frame einzeichnen
    for (let i=0;i<30;i++) {
      const ft=ts+i*0.008
      const px=Math.round((Math.sin(3*ft+0.2*Math.sin(ts*0.13))*0.45+0.5)*(W-1))
      const py=Math.round((Math.sin(4*ft)*0.45+0.5)*(H-1))
      if (px>=0&&px<W&&py>=0&&py<H) trail[py*W+px]=255
    }
    for (let i=0;i<W*H;i++) {
      const pi=i*4, v=trail[i]
      if (v===0) { buf[pi]=buf[pi+1]=buf[pi+2]=0 }
      else { const [r,g,b]=hsl((i*0.4+ts*25)%360,1,v/510); buf[pi]=r; buf[pi+1]=g; buf[pi+2]=b }
      buf[pi+3]=255
    }
  },
)
