import { memo,  useRef, useState, useEffect } from 'react'
import Panel from '../ui/Panel'

// Korrekte Datei-URL: Dateiname = dIQ53t0gv_4.mp4 (ohne "youtube-"-Prefix).
// COEP: credentialless in vite.config.ts erlaubt das ohne crossOrigin-Attribut.
const VIDEO_SRC = 'https://archive.org/download/youtube-dIQ53t0gv_4/dIQ53t0gv_4.mp4'

function AllYourBase() {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Ton ist standardmäßig AN — "All your base" verdient Ton
  const [muted, setMuted] = useState(false)

  // React's `muted`-Prop hat einen bekannten Bug (wird nach erstem Render nicht aktualisiert).
  // Daher direkt über das DOM-Element steuern.
  // Browser blockieren oft autoplay mit Ton bis zur ersten User-Interaktion.
  // Wir versuchen es mit Ton, fallen aber bei Fehler auf stumm zurück.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = false
    v.play().catch(() => {
      // Autoplay mit Ton wurde vom Browser blockiert → stumm abspielen
      v.muted = true
      setMuted(true)
    })
  }, [])

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  return (
    <Panel title="ALL YOUR BASE // INCOMING TRANSMISSION">
      {/* objectFit: cover füllt den Container vollständig, beschneidet wenn nötig */}
      <div className="relative w-full h-full">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Ton-Toggle — dezent in der Ecke */}
        <button
          onClick={toggleMute}
          className="absolute bottom-1 right-1 border border-green-800 bg-black/80
                     text-green-500 font-mono text-xs px-1.5 py-0.5
                     hover:bg-green-900 hover:text-green-200 transition-colors"
        >
          {muted ? '[ MUTED ]' : '[ SOUND ON ]'}
        </button>
      </div>
    </Panel>
  )
}

export default memo(AllYourBase);
