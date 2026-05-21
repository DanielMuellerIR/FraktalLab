import { useEffect, useState } from 'react'

// Modul-globales Set: welche Komponenten-Referenzen gerade in irgendeinem Slot
// angezeigt werden. Verhindert, dass dasselbe Panel in mehreren Slots gleichzeitig
// auftaucht. Speichert die Komponenten-Referenz selbst (nicht den Namen), weil
// Factory-generierte Komponenten (makeScene, makeVoxelScene …) innen alle denselben
// Funktionsnamen tragen ('Scene', 'VoxelScene' usw.) und per .name nicht unterscheidbar
// wären.
const activePanels = new Set<React.ComponentType>()

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
  // Initiale Auswahl: bevorzugt eine Komponente, die noch nicht aktiv ist.
  const [idx, setIdx]         = useState(() => pickInitial(pool))
  const [visible, setVisible] = useState(true)

  // Beim ersten Render die gewählte Komponente als aktiv markieren.
  // useEffect läuft nach dem Commit → zu diesem Zeitpunkt ist der Slot "sichtbar".
  useEffect(() => {
    const component = pool[idx]
    activePanels.add(component)

    // Cleanup: beim Unmount (Layout-Wechsel) aus dem globalen Set entfernen.
    return () => {
      activePanels.delete(component)
    }
  // pool und idx als Abhängigkeiten: falls sich der Pool ändert, erneut tracken.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, idx])

  // Zum nächsten Panel wechseln (nie dasselbe zweimal hintereinander, und
  // bevorzugt eine Komponente, die in keinem anderen Slot gerade sichtbar ist).
  function skipTo(next?: number) {
    setVisible(false)
    setTimeout(() => {
      setIdx(currentIdx => {
        // Wenn ein konkreter Ziel-Index übergeben wird, direkt dorthin.
        if (next !== undefined) return next

        // Kandidaten: alle Indizes außer dem aktuellen
        const candidates = pool
          .map((_, i) => i)
          .filter(i => i !== currentIdx)

        // Bevorzuge Panels, die gerade nicht in einem anderen Slot laufen.
        const free = candidates.filter(i => !activePanels.has(pool[i]))

        // Aus der besten verfügbaren Menge zufällig wählen.
        const pool2 = free.length > 0 ? free : candidates
        return pool2[Math.floor(Math.random() * pool2.length)]
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

// ── Hilfsfunktion: initiale Panel-Auswahl ─────────────────────────────────────
// Wählt einen zufälligen Index aus dem Pool, der noch nicht in activePanels ist.
// Falls alle belegt sind (unwahrscheinlich bei großen Pools), vollständig zufällig.
function pickInitial(pool: React.ComponentType[]): number {
  // Indizes, deren Komponenten noch nicht aktiv sind
  const free = pool
    .map((comp, i) => ({ comp, i }))
    .filter(({ comp }) => !activePanels.has(comp))
    .map(({ i }) => i)

  const candidates = free.length > 0 ? free : pool.map((_, i) => i)
  const chosen = candidates[Math.floor(Math.random() * candidates.length)]
  // Sofort eintragen (nicht erst nach useEffect), damit parallel initialisierende
  // Slots diese Auswahl schon sehen und keine Duplikate wählen.
  activePanels.add(pool[chosen])
  return chosen
}
