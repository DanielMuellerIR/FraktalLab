import FractalCanvas from '../components/FractalCanvas'

// FractalView hält sein 3:2-Seitenverhältnis im Flex-Layout durch
// aspect-ratio + maxHeight, damit es nie den ganzen Platz wegfrisst.
export default function FractalView() {
  return (
    <div
      className="border border-green-900 bg-black flex flex-col overflow-hidden"
      style={{ aspectRatio: '3/2', width: '100%', maxHeight: '60vh' }}
    >
      <div className="border-b border-green-900 px-2 py-0.5 flex items-center gap-2 shrink-0">
        <span className="text-green-800 text-xs">■</span>
        <span className="font-mono text-xs text-green-600 uppercase tracking-widest">
          NEURAL FRACTAL DIMENSION — TARGET VISUALISER
        </span>
        <span className="ml-auto text-red-900 text-xs animate-pulse">● LIVE</span>
      </div>
      <div className="flex-1 min-h-0">
        <FractalCanvas />
      </div>
    </div>
  )
}
