import { memo, useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

interface SpeciesData {
  name: string
  scientificName: string
  genomeSize: string
  chromosomes: string
  genes: string
  population: string
  fact: string
  seq: string
  color: string
}

const SPECIES_LIST: SpeciesData[] = [
  {
    name: 'Human',
    scientificName: 'Homo sapiens',
    genomeSize: '3.2 Gbp (Billion bp)',
    chromosomes: '46 (2n = 46)',
    genes: '~20,000 coding genes',
    population: '8.2 Billion',
    fact: 'Humans share about 98.8% of their DNA with chimpanzees.',
    seq: 'ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGTGGTGAGGCC',
    color: 'text-sky-400'
  },
  {
    name: 'Dog',
    scientificName: 'Canis lupus familiaris',
    genomeSize: '2.4 Gbp (Billion bp)',
    chromosomes: '78 (2n = 78)',
    genes: '~19,000 coding genes',
    population: '900 Million',
    fact: 'Dogs have an exceptionally diverse genome, allowing extreme skeletal variation.',
    seq: 'ATGAGCGGCTCCGGGGAGCTCAACTTCCAGGAGATCGTGGAGTCCTTGCGGGACTCGCTCCTGCGCTCGCCGGTGCAGCGCGCC',
    color: 'text-amber-400'
  },
  {
    name: 'Pig',
    scientificName: 'Sus scrofa',
    genomeSize: '2.7 Gbp (Billion bp)',
    chromosomes: '38 (2n = 38)',
    genes: '~21,000 coding genes',
    population: '780 Million',
    fact: 'Pig organs are structurally similar to humans, making them candidates for xenotransplantation.',
    seq: 'ATGTTGGCGGCGCCTGCGGGGGCGGCGGCGGGGTCGCTGTGGTTCTTCGCCTGGACCAGGGAGCTGGGGGCGCTGGCGGCCGAC',
    color: 'text-emerald-400'
  },
  {
    name: 'Fruit Fly',
    scientificName: 'Drosophila melanogaster',
    genomeSize: '140 Mbp (Million bp)',
    chromosomes: '8 (2n = 8)',
    genes: '~14,000 coding genes',
    population: 'Trillions / Ubiquitous',
    fact: '75% of human disease-causing genes have a functional homolog in fruit flies.',
    seq: 'ATGGCAGTCACCAACAACATCCCGGTGCGCGAGGTGGCCCGGCTGCAGGCCCTGGAGCGCCGCATCCAGCAGCTGCAGGAGTCG',
    color: 'text-rose-400'
  },
  {
    name: 'Blue Whale',
    scientificName: 'Balaenoptera musculus',
    genomeSize: '2.8 Gbp (Billion bp)',
    chromosomes: '44 (2n = 44)',
    genes: '~22,000 coding genes',
    population: '10,000 - 25,000',
    fact: 'Despite their colossal size, their genome has unique tumor suppression genes that prevent cancer.',
    seq: 'ATGGAGCGGCTGTGGGCCGGCCTGGTGGTGGGCCTGGCGGCGGCGGCGCTGCAGCTGCAGCTGCTGGACGCGGGCGCCGGGGGC',
    color: 'text-indigo-400'
  },
  {
    name: 'E. Coli',
    scientificName: 'Escherichia coli',
    genomeSize: '4.6 Mbp (Million bp)',
    chromosomes: '1 (circular plasmid)',
    genes: '~4,300 genes',
    population: 'Uncountable / Incalculable',
    fact: 'A model organism in molecular biology, dividing every 20 minutes under optimal conditions.',
    seq: 'ATGACCAATGTTTACACCATTCTGGATCAGCTGGAAACCCTGGATACCCTGACCGTTGCACAGCTGGCCGAACTGGGCCGTTAC',
    color: 'text-yellow-400'
  }
]

const BASE_COLORS: Record<string, [number, number, number]> = {
  A: [0, 255, 102],
  T: [0, 204, 255],
  C: [255, 68, 204],
  G: [255, 221, 0],
}

function DNAHelix() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Start bei zufälliger Spezies statt immer Mensch (Index 0).
  const [speciesIdx, setSpeciesIdx] = useState(() => Math.floor(Math.random() * SPECIES_LIST.length))

  // Cycle species
  useEffect(() => {
    const interval = setInterval(() => {
      setSpeciesIdx(prev => (prev + 1) % SPECIES_LIST.length)
    }, 7000)
    return () => clearInterval(interval)
  }, [])

  const currentSpecies = SPECIES_LIST[speciesIdx]

  useEffect(() => {
    const _canvas = canvasRef.current
    const _cont = containerRef.current
    if (!_canvas || !_cont) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return

    const canvas: HTMLCanvasElement = _canvas
    const ctx: CanvasRenderingContext2D = _ctx

    let unsubscribe: (() => void) | null = null
    let alive = true

    // Resize
    const resize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Visibility
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!unsubscribe && alive) unsubscribe = subscribe(loop, 'DNAHelix')
      } else {
        if (unsubscribe) {
          unsubscribe()
          unsubscribe = null
        }
      }
    })
    io.observe(canvas)

    function loop(t: number) {
      if (!alive) return

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      const ts = t * 0.001

      // Black background
      ctx.fillStyle = '#020205'
      ctx.fillRect(0, 0, W, H)

      const cx = W / 2
      const radius = Math.min(W * 0.35, 45)
      const helixH = H * 0.95
      const steps = Math.max(16, Math.min(45, Math.round(helixH / 10)))

      type Seg = {
        y: number
        x1: number
        x2: number
        z: number
        colorA: [number, number, number]
        colorB: [number, number, number]
      }
      const segs: Seg[] = []

      const seq = currentSpecies.seq

      for (let i = 0; i < steps; i++) {
        const frac = i / steps
        const angle = ts * 1.3 + frac * Math.PI * 3.5

        const y = H * 0.025 + frac * helixH

        const x1 = cx + Math.cos(angle) * radius
        const x2 = cx + Math.cos(angle + Math.PI) * radius

        const z = Math.sin(angle)

        const baseA = seq[i % seq.length]
        const complement: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' }
        const baseB = complement[baseA] || 'A'

        segs.push({
          y,
          x1,
          x2,
          z,
          colorA: BASE_COLORS[baseA] || [0, 255, 102],
          colorB: BASE_COLORS[baseB] || [255, 221, 0],
        })
      }

      type Drawable =
        | {
            type: 'rung'
            y: number
            x1: number
            x2: number
            z: number
            bright: number
          }
        | {
            type: 'sphere'
            y: number
            x: number
            z: number
            bright: number
            color: [number, number, number]
          }

      const drawables: Drawable[] = []

      for (const s of segs) {
        const brightA = Math.min(1.0, 0.25 + (s.z + 1) * 0.38)
        const brightB = Math.min(1.0, 0.25 + (-s.z + 1) * 0.38)
        const brightRung = 0.55

        drawables.push({
          type: 'rung',
          y: s.y,
          x1: s.x1,
          x2: s.x2,
          z: 0,
          bright: brightRung,
        })

        drawables.push({
          type: 'sphere',
          y: s.y,
          x: s.x1,
          z: s.z,
          bright: brightA,
          color: s.colorA,
        })

        drawables.push({
          type: 'sphere',
          y: s.y,
          x: s.x2,
          z: -s.z,
          bright: brightB,
          color: s.colorB,
        })
      }

      drawables.sort((a, b) => a.z - b.z)

      for (const d of drawables) {
        if (d.type === 'rung') {
          const alpha = d.bright * 0.45
          ctx.strokeStyle = `rgba(51, 65, 85, ${alpha})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(d.x1, d.y)
          ctx.lineTo(d.x2, d.y)
          ctx.stroke()
        } else {
          const dotR = Math.max(2.5, radius * 0.2 * d.bright)
          const [r, g, b] = d.color

          const grad = ctx.createRadialGradient(
            d.x - dotR * 0.25,
            d.y - dotR * 0.25,
            dotR * 0.05,
            d.x,
            d.y,
            dotR
          )

          const baseColor = `rgb(${Math.round(r * d.bright)}, ${Math.round(g * d.bright)}, ${Math.round(b * d.bright)})`
          const highlightColor = `rgb(${Math.round(
            Math.min(255, r * d.bright + (255 - r) * 0.5)
          )}, ${Math.round(Math.min(255, g * d.bright + (255 - g) * 0.5))}, ${Math.round(
            Math.min(255, b * d.bright + (255 - b) * 0.5)
          )})`

          grad.addColorStop(0, '#ffffff')
          grad.addColorStop(0.2, highlightColor)
          grad.addColorStop(1, baseColor)

          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(d.x, d.y, dotR, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    return () => {
      alive = false
      if (unsubscribe) unsubscribe()
      ro.disconnect()
      io.disconnect()
    }
  }, [speciesIdx, currentSpecies])

  return (
    <Panel title="DNA HYBRID SCAN // GENOME DATABASE">
      <div
        ref={containerRef}
        className="flex w-full h-full min-h-0 text-xs text-slate-300 font-mono select-none overflow-hidden"
      >
        {/* Left canvas: 3D Helix (35%) */}
        <div className="w-[35%] h-full relative border-r border-slate-800/50">
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        {/* Right content: Stats & Sequence Data (65%)
            WICHTIG: Kein Scrollbalken mehr. Statt fester Pixel-Schriftgrößen und
            festem Padding skaliert hier alles container-relativ (cqmin = kleinere
            Kantenlänge der Kachel via container-type am PanelSlot-Wrapper). So
            schrumpft der Inhalt in kleinen Kacheln mit und passt ohne Scrollen
            in die Kachel. `overflow-hidden` ersetzt das frühere `overflow-y-auto`. */}
        <div
          className="w-[65%] h-full flex flex-col overflow-hidden bg-black/40"
          // Padding, Abstände und Schrift wachsen/schrumpfen mit der Kachelgröße.
          style={{
            padding: 'clamp(3px, 1.6cqmin, 12px)',
            gap: 'clamp(2px, 1.2cqmin, 12px)',
            fontSize: 'clamp(6px, 2.6cqmin, 11px)',
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-800 shrink-0" style={{ paddingBottom: 'clamp(2px, 1cqmin, 8px)' }}>
            <div className="min-w-0">
              <div className="text-slate-500 uppercase tracking-wider" style={{ fontSize: 'clamp(5px, 2.2cqmin, 10px)' }}>Active Subject</div>
              <div className={`font-bold uppercase truncate ${currentSpecies.color}`} style={{ fontSize: 'clamp(9px, 4cqmin, 16px)' }}>
                {currentSpecies.name}
              </div>
              <div className="text-slate-400 italic font-sans truncate" style={{ fontSize: 'clamp(6px, 2.6cqmin, 11px)' }}>
                {currentSpecies.scientificName}
              </div>
            </div>
            <div className="text-right shrink-0" style={{ fontSize: 'clamp(5px, 2.2cqmin, 10px)' }}>
              <span className="text-slate-500 uppercase">Cycle status</span>
              <div className="text-emerald-400 animate-pulse">● DATABASE LIVE</div>
            </div>
          </div>

          {/* Stats Grid — Schrift erbt vom Container-clamp oben */}
          <div className="grid grid-cols-2 shrink-0" style={{ gap: 'clamp(2px, 1cqmin, 8px)' }}>
            <div className="border border-slate-800/80 bg-slate-950/40 rounded" style={{ padding: 'clamp(2px, 1cqmin, 6px)' }}>
              <span className="text-slate-500 uppercase block" style={{ fontSize: 'clamp(5px, 2cqmin, 9px)' }}>Genome Size</span>
              <span className="font-bold text-slate-200">{currentSpecies.genomeSize}</span>
            </div>
            <div className="border border-slate-800/80 bg-slate-950/40 rounded" style={{ padding: 'clamp(2px, 1cqmin, 6px)' }}>
              <span className="text-slate-500 uppercase block" style={{ fontSize: 'clamp(5px, 2cqmin, 9px)' }}>Chromosomes</span>
              <span className="font-bold text-slate-200">{currentSpecies.chromosomes}</span>
            </div>
            <div className="border border-slate-800/80 bg-slate-950/40 rounded" style={{ padding: 'clamp(2px, 1cqmin, 6px)' }}>
              <span className="text-slate-500 uppercase block" style={{ fontSize: 'clamp(5px, 2cqmin, 9px)' }}>Coding Genes</span>
              <span className="font-bold text-slate-200">{currentSpecies.genes}</span>
            </div>
            <div className="border border-slate-800/80 bg-slate-950/40 rounded" style={{ padding: 'clamp(2px, 1cqmin, 6px)' }}>
              <span className="text-slate-500 uppercase block" style={{ fontSize: 'clamp(5px, 2cqmin, 9px)' }}>Population (Est.)</span>
              <span className="font-bold text-slate-200">{currentSpecies.population}</span>
            </div>
          </div>

          {/* Fact Box */}
          <div className="border border-slate-800/80 bg-slate-950/60 rounded leading-relaxed shrink-0" style={{ padding: 'clamp(2px, 1.2cqmin, 8px)' }}>
            <span className="text-amber-500 uppercase font-bold block" style={{ fontSize: 'clamp(5px, 2cqmin, 9px)', marginBottom: 'clamp(1px, 0.5cqmin, 4px)' }}>
              Scientific Note:
            </span>
            <p className="text-slate-300 font-sans">{currentSpecies.fact}</p>
          </div>

          {/* Sequence Viewer — füllt den Rest, eigener Inhalt ohne Scrollbalken (overflow-hidden) */}
          <div className="flex-1 flex flex-col min-h-0 border border-slate-800/80 bg-slate-950/40 rounded" style={{ padding: 'clamp(2px, 1.2cqmin, 8px)' }}>
            <span className="text-slate-500 uppercase block shrink-0" style={{ fontSize: 'clamp(5px, 2cqmin, 9px)', marginBottom: 'clamp(1px, 0.7cqmin, 6px)' }}>
              Genomic Sequence Segment (5' -&gt; 3')
            </span>
            <div className="flex-1 overflow-hidden font-mono break-all leading-tight text-slate-400 bg-black/60 rounded border border-slate-900" style={{ fontSize: 'clamp(5px, 2.2cqmin, 10px)', padding: 'clamp(2px, 1cqmin, 6px)' }}>
              {currentSpecies.seq.split('').map((base, idx) => {
                let colorClass = 'text-slate-500'
                if (base === 'A') colorClass = 'text-emerald-400'
                else if (base === 'T') colorClass = 'text-sky-400'
                else if (base === 'C') colorClass = 'text-pink-400'
                else if (base === 'G') colorClass = 'text-yellow-400'
                return (
                  <span key={idx} className={colorClass}>
                    {base}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}

export default memo(DNAHelix)
