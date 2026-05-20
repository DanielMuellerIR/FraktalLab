import { useEffect, useState } from 'react'

// PanelSlot: wechselt zufällig zwischen Panel-Komponenten aus einem Pool.
// Fade-Out → Komponente tauschen → Fade-In mit CSS-Transition.
export default function PanelSlot({
  pool,
  className = '',
}: {
  pool: React.ComponentType[]
  className?: string
}) {
  const [idx, setIdx]         = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Keine Rotation nötig, wenn nur eine Komponente im Pool
    if (pool.length <= 1) return

    // Zufälliges Intervall: 30 s – 10 min
    const delay = 30_000 + Math.random() * 570_000
    const t = setTimeout(() => {
      setVisible(false)  // Fade-Out
      setTimeout(() => {
        setIdx(i => (i + 1) % pool.length)  // Nächste Komponente
        setVisible(true)                     // Fade-In
      }, 400)
    }, delay)
    return () => clearTimeout(t)
  }, [idx, pool.length])

  const Component = pool[idx]
  return (
    <div
      className={`transition-opacity duration-[400ms] min-h-0 h-full ${visible ? 'opacity-100' : 'opacity-0'} ${className}`}
    >
      <Component />
    </div>
  )
}
