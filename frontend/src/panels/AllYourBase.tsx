import { useRef, useState, useEffect } from 'react'
import Panel from '../ui/Panel'

// Korrekte Datei-URL: Dateiname = dIQ53t0gv_4.mp4 (ohne "youtube-"-Prefix).
// COEP: credentialless in vite.config.ts erlaubt das ohne crossOrigin-Attribut.
const VIDEO_SRC = 'https://archive.org/download/youtube-dIQ53t0gv_4/dIQ53t0gv_4.mp4'

export default function AllYourBase() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  // React's `muted`-Prop hat einen bekannten Bug (wird nach erstem Render nicht aktualisiert).
  // Daher direkt über das DOM-Element steuern.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = true
  }, [])

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  return (
    <Panel title="ALL YOUR BASE // INCOMING TRANSMISSION">
      <div className="relative w-full h-full">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          autoPlay
          loop
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
        {/* Ton-Toggle — dezent in der Ecke */}
        <button
          onClick={toggleMute}
          className="absolute bottom-1 right-1 border border-green-800 bg-black/80
                     text-green-500 font-mono text-xs px-1.5 py-0.5
                     hover:bg-green-900 hover:text-green-200 transition-colors"
        >
          {muted ? '[ MUTE ]' : '[ LIVE ]'}
        </button>
      </div>
    </Panel>
  )
}
