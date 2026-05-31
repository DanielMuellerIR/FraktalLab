const callbacks = new Set<(t: number) => void>()
let running = false
let rafId = 0
let paused = false

function tick(t: number) {
  if (!paused) {
    for (const cb of callbacks) {
      // WICHTIG: jeden Panel-Callback isoliert ausführen. Würde ein einzelner
      // Callback eine Exception werfen, bräche sonst die for-Schleife ab UND die
      // Exception verließe tick() — das abschließende requestAnimationFrame(tick)
      // würde nie erreicht, die GESAMTE geteilte rAF-Schleife stürbe und ALLE
      // Panels würden einfrieren. Mit try/catch betrifft ein Fehler nur das
      // betroffene Panel; alle anderen laufen weiter.
      try {
        cb(t)
      } catch (e) {
        console.error('[raf-coordinator] Panel-Callback hat geworfen (übersprungen):', e)
      }
    }
  }
  if (callbacks.size > 0) {
    rafId = requestAnimationFrame(tick)
  } else {
    running = false
  }
}

/**
 * Subscribes a frame-drawing callback to the central requestAnimationFrame loop.
 * Returns an unsubscribe cleanup function.
 */
export function subscribe(cb: (t: number) => void): () => void {
  callbacks.add(cb)
  if (!running) {
    running = true
    rafId = requestAnimationFrame(tick)
  }
  return () => {
    callbacks.delete(cb)
    if (callbacks.size === 0 && running) {
      cancelAnimationFrame(rafId)
      running = false
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
