import { useEffect, useState, useRef } from 'react'

export default function PanelSlot({
  pool,
  activeIdx,
  onSkip,
  className = '',
  locked = false,
}: {
  pool: React.ComponentType<any>[]
  activeIdx: number
  onSkip: () => void
  className?: string
  // locked = dieser Slot darf NICHT (auto-)rotieren. Für das garantierte
  // Audio-Panel: es soll im Layout bleiben, solange das Layout lebt
  // ("Player wechseln nie mittendrin").
  locked?: boolean
}) {
  const [localIdx, setLocalIdx] = useState(activeIdx)
  const [visible, setVisible] = useState(true)
  const isTransitioningRef = useRef(false)

  // Sync prop changes (e.g. from parent layout shifts)
  useEffect(() => {
    if (activeIdx !== localIdx) {
      if (!isTransitioningRef.current) {
        setLocalIdx(activeIdx)
      }
    }
  }, [activeIdx, localIdx])

  function handleSkip() {
    if (locked) return  // gesperrter Slot (Audio-Panel) rotiert nicht
    if (isTransitioningRef.current) return
    isTransitioningRef.current = true
    setVisible(false)
    setTimeout(() => {
      onSkip()
      // Backup timeout: if parent doesn't change activeIdx (e.g. pool of size 1),
      // we restore visibility and reset transition flag.
      setTimeout(() => {
        if (isTransitioningRef.current) {
          setVisible(true)
          isTransitioningRef.current = false
        }
      }, 50)
    }, 300)
  }

  // When parent updates activeIdx after skip, fade back in
  useEffect(() => {
    if (isTransitioningRef.current && activeIdx !== localIdx) {
      setLocalIdx(activeIdx)
      setVisible(true)
      isTransitioningRef.current = false
    }
  }, [activeIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto rotation
  useEffect(() => {
    if (locked) return            // Audio-Panel-Slot: nie automatisch wechseln
    if (pool.length <= 1) return
    const delay = 45_000 + Math.random() * 435_000
    const t = setTimeout(() => handleSkip(), delay)
    return () => clearTimeout(t)
  }, [localIdx, pool.length, locked]) // eslint-disable-line react-hooks/exhaustive-deps

  const Component = pool[localIdx]
  if (!Component) return null

  return (
    <div
      className={`relative transition-opacity duration-[300ms] min-h-0 h-full ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      <Component onComplete={() => handleSkip()} />
      {pool.length > 1 && !locked && (
        <button
          onClick={() => handleSkip()}
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
