import { useEffect, useState } from 'react'

// Modul-globales Map: ordnet layoutId -> (slotId -> Komponente)
const activePanelsMap = new Map<string, Map<string, React.ComponentType<any>>>()

function getActivePanelsInOtherSlots(myLayoutId: string, mySlotId: string): Set<React.ComponentType<any>> {
  const active = new Set<React.ComponentType<any>>()
  const layoutMap = activePanelsMap.get(myLayoutId)
  if (layoutMap) {
    for (const [slotId, component] of layoutMap.entries()) {
      if (slotId !== mySlotId) {
        active.add(component)
      }
    }
  }
  return active
}

// PanelSlot: wechselt zufällig zwischen Panel-Komponenten aus einem Pool.
// Fade-Out → Komponente tauschen → Fade-In mit CSS-Transition.
// Kleiner ⟳-Button oben rechts zum manuellen Weiterschalten.
export default function PanelSlot({
  pool,
  className = '',
  layoutId = 'default',
  slotIndex = 0,
}: {
  pool: React.ComponentType<any>[]
  className?: string
  layoutId?: string
  slotIndex?: number
}) {
  const slotId = `slot_${slotIndex}`

  // Initiale Auswahl: bevorzugt eine Komponente, die noch nicht aktiv ist.
  const [idx, setIdx]         = useState(() => pickInitial(pool, layoutId, slotId))
  const [visible, setVisible] = useState(true)

  // Beim Render und bei Änderungen die gewählte Komponente für diesen Slot registrieren.
  useEffect(() => {
    const component = pool[idx]
    if (!activePanelsMap.has(layoutId)) {
      activePanelsMap.set(layoutId, new Map())
    }
    activePanelsMap.get(layoutId)!.set(slotId, component)

    // Cleanup: beim Unmount (Layout-Wechsel) aus dem globalen Map entfernen.
    return () => {
      const layoutMap = activePanelsMap.get(layoutId)
      if (layoutMap && layoutMap.get(slotId) === component) {
        layoutMap.delete(slotId)
        if (layoutMap.size === 0) {
          activePanelsMap.delete(layoutId)
        }
      }
    }
  }, [pool, idx, slotId, layoutId])

  // Zum nächsten Panel wechseln (nie dasselbe zweimal hintereinander, und
  // bevorzugt eine Komponente, die in keinem anderen Slot gerade sichtbar ist).
  function skipTo(next?: number) {
    setVisible(false)
    setTimeout(() => {
      setIdx(currentIdx => {
        // Wenn ein konkreter Ziel-Index übergeben wird, direkt dorthin.
        if (next !== undefined) {
          if (!activePanelsMap.has(layoutId)) {
            activePanelsMap.set(layoutId, new Map())
          }
          activePanelsMap.get(layoutId)!.set(slotId, pool[next])
          return next
        }

        // Kandidaten: alle Indizes außer dem aktuellen
        const candidates = pool
          .map((_, i) => i)
          .filter(i => i !== currentIdx)

        // Bevorzuge Panels, die gerade nicht in einem anderen Slot laufen.
        const otherActive = getActivePanelsInOtherSlots(layoutId, slotId)
        const free = candidates.filter(i => !otherActive.has(pool[i]))

        // Aus der besten verfügbaren Menge zufällig wählen.
        const pool2 = free.length > 0 ? free : candidates
        const chosen = pool2[Math.floor(Math.random() * pool2.length)]
        
        if (!activePanelsMap.has(layoutId)) {
          activePanelsMap.set(layoutId, new Map())
        }
        activePanelsMap.get(layoutId)!.set(slotId, pool[chosen])
        return chosen
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
      <Component onComplete={() => skipTo()} />
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

// ── Hilfsfunktion: initiale Panel-Auswahl ─────────────────────────────────────
// Wählt einen zufälligen Index aus dem Pool, der noch nicht in activePanelsMap ist.
// Falls alle belegt sind (unwahrscheinlich bei großen Pools), vollständig zufällig.
function pickInitial(pool: React.ComponentType<any>[], layoutId: string, slotId: string): number {
  const otherActive = getActivePanelsInOtherSlots(layoutId, slotId)
  // Indizes, deren Komponenten noch nicht aktiv sind
  const free = pool
    .map((comp, i) => ({ comp, i }))
    .filter(({ comp }) => !otherActive.has(comp))
    .map(({ i }) => i)

  const candidates = free.length > 0 ? free : pool.map((_, i) => i)
  const chosen = candidates[Math.floor(Math.random() * candidates.length)]
  
  // Sofort eintragen (nicht erst nach useEffect), damit parallel initialisierende
  // Slots diese Auswahl schon sehen und keine Duplikate wählen.
  if (!activePanelsMap.has(layoutId)) {
    activePanelsMap.set(layoutId, new Map())
  }
  activePanelsMap.get(layoutId)!.set(slotId, pool[chosen])
  return chosen
}

