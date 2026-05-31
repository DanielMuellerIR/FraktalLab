import { memo, useRef, useState, useEffect } from 'react'
import Panel from '../ui/Panel'
import { isSharedAudioContextRunning } from '../utils/shared-audio'
import {
  registerAudioFocusListener,
  requestAudioFocus,
  releaseAudioFocus,
  registerAudioCandidate,
  notifyAudioEnded,
} from '../utils/audio-focus'

const VIDEO_SRC = 'https://archive.org/download/youtube-dIQ53t0gv_4/dIQ53t0gv_4.mp4'
const AUDIO_ID = 'all-your-base'

function AllYourBase() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(() => !isSharedAudioContextRunning())

  // Handle Autoplay and Initial Muting
  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const initialMute = !isSharedAudioContextRunning()
    v.muted = initialMute
    setMuted(initialMute)
    
    v.play().catch(() => {
      // Autoplay with sound blocked -> play muted
      v.muted = true
      setMuted(true)
    })
  }, [])

  // Audio Focus Listener
  useEffect(() => {
    const unsubscribe = registerAudioFocusListener((focusedId) => {
      const v = videoRef.current
      if (!v) return
      
      // If someone else takes focus, we MUST mute
      if (focusedId !== null && focusedId !== AUDIO_ID) {
        v.muted = true
        setMuted(true)
      }
    })

    return () => {
      unsubscribe()
      releaseAudioFocus(AUDIO_ID)
    }
  }, [])

  // Als Election-Kandidat registrieren: start() spielt mit Ton + holt Fokus,
  // setMuted() schaltet stumm/laut (Video läuft visuell weiter — Pause-Verhalten).
  useEffect(() => {
    return registerAudioCandidate('all-your-base', {
      start: () => {
        const v = videoRef.current
        if (!v) return
        requestAudioFocus(AUDIO_ID)
        v.muted = false
        setMuted(false)
        v.play().catch(() => {})
      },
      setMuted: (m) => {
        const v = videoRef.current
        if (!v) return
        v.muted = m
        setMuted(m)
      },
    })
  }, [])

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    
    const newMute = !v.muted
    v.muted = newMute
    setMuted(newMute)

    if (!newMute) {
      // Request audio focus when unmuting
      requestAudioFocus(AUDIO_ID)
    } else {
      // Release focus when muting
      releaseAudioFocus(AUDIO_ID)
    }
  }

  return (
    <Panel title="ALL YOUR BASE // INCOMING TRANSMISSION">
      <div className="relative w-full h-full">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          autoPlay
          playsInline
          onEnded={() => notifyAudioEnded(AUDIO_ID)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
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
