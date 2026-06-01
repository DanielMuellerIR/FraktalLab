import { createContext, useEffect, useMemo, useState, useRef } from 'react'

// ── Panel-Chrome-Kontext ──────────────────────────────────────────────────────
// Die Titel-Texte leben in den einzelnen Panel-Komponenten (<Panel title="…">).
// PanelSlot rendert aber die EINHEITLICHE Deko (schwebende Titel-Pille + Pfeile).
// Damit der Slot den Titel kennt, meldet ihn die Panel-Komponente per Kontext.
// Panels OHNE <Panel> (reine Grafik-Shader) melden nichts → der Slot nimmt einen
// aus dem Komponentennamen abgeleiteten Titel als Fallback.
type PanelChrome = { setTitle: (title: string, rightLabel?: string) => void }
export const PanelChromeContext = createContext<PanelChrome | null>(null)

// Komponentennamen in einen lesbaren Kurztitel wandeln (Fallback, wenn das Panel
// keinen eigenen Titel meldet). "ICQChatPanel" → "ICQ Chat".
function prettify(name: string): string {
  const n = name
    .replace(/(Panel|Scene|View|Demo)$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
  return n || name
}

export default function PanelSlot({
  pool,
  activeIdx,
  onNav,
  fallbackName = '',
  className = '',
  locked = false,
}: {
  pool: React.ComponentType<any>[]
  activeIdx: number
  // Panelwechsel anfordern. `strict` steuert das Duplikat-Verhalten beim Parent:
  //   true  = Auto-Rotation (NIE ein anderswo laufendes Panel wählen)
  //   false = manueller Pillen-Klick (Duplikat nur als Notnagel)
  // Der Parent wählt ein zufälliges kompatibles Panel und aktualisiert activeIdx.
  onNav: (strict: boolean) => void
  fallbackName?: string
  className?: string
  // locked = dieser Slot darf NICHT (auto-)rotieren. Für das garantierte
  // Audio-Panel: es soll im Layout bleiben, solange das Layout lebt.
  locked?: boolean
}) {
  const [localIdx, setLocalIdx] = useState(activeIdx)
  const [visible, setVisible] = useState(true)
  // Vom inneren Panel gemeldeter Titel (null → Fallback aus Komponentenname).
  const [reported, setReported] = useState<{ title: string; rightLabel?: string } | null>(null)
  const isTransitioningRef = useRef(false)
  // Pillen-Sichtbarkeit auf MOBILE: erst nach Tippen einblenden (Desktop nutzt
  // reines CSS-Hover, siehe Klassen unten). Auto-Ausblenden nach 3 s.
  const [revealed, setRevealed] = useState(false)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function revealPill() {
    setRevealed(true)
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    revealTimerRef.current = setTimeout(() => setRevealed(false), 3000)
  }

  // Panel-Wechsel: localIdx setzen UND den gemeldeten Titel im SELBEN Update
  // zurücksetzen. Nicht per [localIdx]-Effekt — der liefe NACH dem Mount-Effekt
  // des neuen Panels und würde dessen frisch gemeldeten Titel wieder löschen.
  function switchTo(idx: number) {
    setLocalIdx(idx)
    setReported(null)
  }

  // Prop-Änderungen übernehmen (z.B. Layout-Shift im Parent)
  useEffect(() => {
    if (activeIdx !== localIdx && !isTransitioningRef.current) {
      switchTo(activeIdx)
    }
  }, [activeIdx, localIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Zufalls-Panelwechsel mit Ausblenden/Einblenden.
  function navigate(strict: boolean) {
    if (locked || isTransitioningRef.current || pool.length <= 1) return
    isTransitioningRef.current = true
    setVisible(false)
    setTimeout(() => {
      onNav(strict)
      // Backup: ändert der Parent activeIdx nicht (z.B. nur 1 Kandidat), wieder einblenden.
      setTimeout(() => {
        if (isTransitioningRef.current) {
          setVisible(true)
          isTransitioningRef.current = false
        }
      }, 50)
    }, 300)
  }

  // Wenn der Parent nach der Navigation activeIdx setzt → wieder einblenden.
  useEffect(() => {
    if (isTransitioningRef.current && activeIdx !== localIdx) {
      switchTo(activeIdx)
      setVisible(true)
      isTransitioningRef.current = false
    }
  }, [activeIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-Rotation: gelegentlich zu einem zufälligen kompatiblen Panel wechseln.
  // strict=true → wählt nie ein anderswo laufendes Panel (kein Duplikat).
  useEffect(() => {
    if (locked || pool.length <= 1) return
    const delay = 45_000 + Math.random() * 435_000
    const t = setTimeout(() => navigate(true), delay)
    return () => clearTimeout(t)
  }, [localIdx, pool.length, locked]) // eslint-disable-line react-hooks/exhaustive-deps

  const chrome = useMemo<PanelChrome>(() => ({
    setTitle: (title, rightLabel) => setReported({ title, rightLabel }),
  }), [])

  const Component = pool[localIdx]
  if (!Component) return null

  // Sicherheits-Kürzung: auch ungewöhnlich lange/gemeldete Titel bleiben kurz.
  const rawTitle = reported?.title ?? prettify(fallbackName)
  const title = rawTitle.length > 26 ? rawTitle.slice(0, 25).trimEnd() + '…' : rawTitle
  const canNav = pool.length > 1 && !locked

  return (
    <div
      // `group`: erlaubt der Pille, per CSS auf Hover der ganzen Kachel zu
      // reagieren (Desktop). `onClick` blendet die Pille auf Mobile ein.
      className={`group relative transition-opacity duration-[300ms] min-h-0 h-full overflow-hidden ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      onClick={revealPill}
      // container-type: ermöglicht die Skalierung der Pille mit der Kachelgröße
      // (cqmin-Einheiten) → in dichten Layouts wird die Pille automatisch kleiner.
      style={{ containerType: 'size' }}
    >
      <PanelChromeContext.Provider value={chrome}>
        <Component onComplete={() => navigate(true)} />
      </PanelChromeContext.Provider>

      {/* Schwebende Titel-Pille, oben mittig. KLICK = zufälliges kompatibles Panel
          (keine Vor/Zurück-Pfeile mehr, R3). Sichtbarkeit: Desktop NUR bei Hover
          über die Kachel (md:group-hover), Mobile nach Tippen (revealed-State, 3 s).
          Wenn unsichtbar auch klick-inert (pointer-events-none). */}
      <div
        // Bei klickbarer Pille (canNav) als Button: Klick stoppt die Propagation
        // (sonst löst der Kachel-onClick/revealPill mit aus) und würfelt ein
        // zufälliges Panel. Locked/Solo-Slots: nur Anzeige, kein Klick.
        role={canNav ? 'button' : undefined}
        onClick={canNav ? (e) => { e.stopPropagation(); navigate(false) } : undefined}
        title={canNav ? 'Anderes Panel (zufällig)' : undefined}
        className={`absolute top-[3px] left-1/2 -translate-x-1/2 z-20 flex items-center
                   gap-1 rounded-full bg-black/70 backdrop-blur-sm
                   border border-green-800/50 text-green-300 select-none
                   max-w-[92%] transition-opacity duration-150
                   ${canNav ? 'cursor-pointer hover:text-green-100 hover:border-green-600/70' : ''}
                   ${revealed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                   md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto`}
        style={{ fontSize: 'clamp(7px, 4.4cqmin, 11px)', paddingTop: '1px', paddingBottom: '1px', paddingLeft: '8px', paddingRight: '8px' }}
      >
        <span
          className="tracking-tight truncate"
          style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
        >
          {title}
        </span>
        {reported?.rightLabel && (
          <span className="text-green-500/80 truncate" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
            {reported.rightLabel}
          </span>
        )}
      </div>
    </div>
  )
}
