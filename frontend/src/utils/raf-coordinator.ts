import { getSpeed } from './panel-speed'

// ── Zentrale, geteilte requestAnimationFrame-Schleife mit Per-Panel-Zeitskala ──
//
// Jeder Subscriber bekommt seine EIGENE virtuelle Uhr. Pro Frame schreiben wir
// die reale Delta-Zeit × `getSpeed(name)` auf die virtuelle Zeit des jeweiligen
// Subscribers fort und übergeben diese an den Callback. So animiert jedes Panel
// mit dem für seinen Typ + die aktuelle Dichte-Stufe passenden Tempo (R1), ohne
// dass die Panels die Stufe selbst kennen müssen.
//
// Hinweis: greift nur bei Panels, die über subscribe() laufen (v.a. ShaderPanel-
// GL-Panels und einige Canvas-Panels). Panels mit eigener rAF-Schleife/Timer
// müssen `getSpeed(name)` selbst lesen. Audio läuft in WebAudio-Echtzeit und ist
// von der Skala ohnehin unberührt (Player-Panels liefern zudem Faktor 1).

interface Subscriber {
  cb: (t: number) => void
  name: string   // Komponentenname für die Tempo-Zuordnung (getSpeed)
  vT: number     // eigene virtuelle Zeit dieses Subscribers (ms)
}

const subscribers = new Set<Subscriber>()
let running = false
let rafId = 0
let paused = false
let lastRealT = -1

function tick(realT: number) {
  // Reale Delta-Zeit seit dem letzten Frame (für alle Subscriber gleich).
  if (lastRealT < 0) lastRealT = realT
  const dt = realT - lastRealT
  lastRealT = realT

  if (!paused) {
    for (const s of subscribers) {
      // Virtuelle Zeit dieses Panels mit seinem effektiven Tempo fortschreiben.
      s.vT += dt * getSpeed(s.name)
      // WICHTIG: jeden Panel-Callback isoliert ausführen. Würde ein einzelner
      // Callback eine Exception werfen, bräche sonst die for-Schleife ab UND die
      // Exception verließe tick() — das abschließende requestAnimationFrame(tick)
      // würde nie erreicht, die GESAMTE geteilte rAF-Schleife stürbe und ALLE
      // Panels würden einfrieren. Mit try/catch betrifft ein Fehler nur das
      // betroffene Panel; alle anderen laufen weiter.
      try {
        s.cb(s.vT)
      } catch (e) {
        console.error('[raf-coordinator] Panel-Callback hat geworfen (übersprungen):', e)
      }
    }
  }

  if (subscribers.size > 0) {
    rafId = requestAnimationFrame(tick)
  } else {
    running = false
    lastRealT = -1
  }
}

/**
 * Subscribes a frame-drawing callback to the central requestAnimationFrame loop.
 * @param cb   Frame-Callback; bekommt die (skalierte) virtuelle Zeit in ms.
 * @param name Komponentenname für die Tempo-Zuordnung (getSpeed). Leer/weggelassen
 *             → GFX-Default-Tempo. Player-/Text-Panels MÜSSEN ihren Namen liefern,
 *             damit ihre Sonderregel greift.
 * Returns an unsubscribe cleanup function.
 */
export function subscribe(cb: (t: number) => void, name = ''): () => void {
  // Neue Uhr an der aktuellen realen Zeit aufsetzen → kein Sprung auf 0 beim
  // (Re-)Subscribe (z.B. Sichtbarkeitswechsel), Verlauf bleibt monoton.
  const sub: Subscriber = { cb, name, vT: lastRealT > 0 ? lastRealT : 0 }
  subscribers.add(sub)
  if (!running) {
    running = true
    rafId = requestAnimationFrame(tick)
  }
  return () => {
    subscribers.delete(sub)
    if (subscribers.size === 0 && running) {
      cancelAnimationFrame(rafId)
      running = false
      lastRealT = -1
    }
  }
}

/**
 * Pauses or resumes all subscribed frame-drawing callbacks.
 * Useful to suspend canvas render load during layout transitions.
 */
export function setPaused(p: boolean) {
  paused = p
}
