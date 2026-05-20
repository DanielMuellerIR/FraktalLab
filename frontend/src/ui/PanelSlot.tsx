import { useEffect, useState } from 'react'

// PanelSlot: wechselt zufällig zwischen Panel-Komponenten aus einem Pool.
// Fade-Out → Komponente tauschen → Fade-In mit CSS-Transition.
// Kleiner ⟳-Button oben rechts zum manuellen Weiterschalten.
export default function PanelSlot({
  pool,
  className = '',
}: {
  pool: React.ComponentType[]
  className?: string
}) {
  const [idx, setIdx]         = useState(() => Math.floor(Math.random() * pool.length))
  const [visible, setVisible] = useState(true)

  // Zum nächsten Panel wechseln (nie dasselbe zweimal hintereinander)
  function skipTo(next?: number) {
    setVisible(false)
    setTimeout(() => {
      setIdx(i => {
        if (next !== undefined) return next
        let n = i
        while (n === i) n = Math.floor(Math.random() * pool.length)
        return n
      })
      setVisible(true)
    }, 300)
  }

  useEffect(() => {
    // Keine Rotation nötig, wenn nur eine Komponente im Pool
    if (pool.length <= 1) return

    // Zufälliges Intervall: 45 s – 8 min
    const delay = 45_000 + Math.random() * 435_000
    const t = setTimeout(() => skipTo(), delay)
    return () => clearTimeout(t)
  }, [idx, pool.length])  // eslint-disable-line react-hooks/exhaustive-deps

  const Component = pool[idx]
  return (
    <div
      className={`relative transition-opacity duration-[300ms] min-h-0 h-full ${visible ? 'opacity-100' : 'opacity-0'} ${className}`}
    >
      <Component />
      {/* Skip-Button: nur sichtbar wenn mehrere Panels im Pool */}
      {pool.length > 1 && (
        <button
          onClick={() => skipTo()}
          title="Zufälliges Panel"
          className="absolute top-[2px] right-[2px] z-10 w-5 h-4 text-[9px]
                     text-green-900 hover:text-green-400 transition-colors leading-none
                     flex items-center justify-center"
        >
          ⟳
        </button>
      )}
    </div>
  )
}
