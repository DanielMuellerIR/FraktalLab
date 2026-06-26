let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    return {} as AudioContext; // Fallback for SSR/build time
  }
  
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio wird von diesem Browser nicht unterstuetzt.');
    }
    sharedAudioContext = new AudioContextClass();

    // Bypasses iOS hardware silent switch for Web Audio API (supported on Safari 16.4+)
    if (typeof navigator !== 'undefined' && (navigator as any).audioSession) {
      try {
        (navigator as any).audioSession.type = 'playback';
      } catch (err) {
        console.warn('Failed to set navigator.audioSession.type to playback:', err);
      }
    }
  }
  
  return sharedAudioContext;
}

export function getAudioWorkletSupportError(ctx: AudioContext): string | null {
  if (typeof window === 'undefined') return null;

  // AudioWorklet ist nur in "secure contexts" garantiert verfuegbar. Auf iOS
  // bedeutet das praktisch: HTTPS. Unter HTTP existiert ctx.audioWorklet nicht,
  // was vorher im SID-Player als roher Safari-TypeError sichtbar wurde.
  const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  if (!window.isSecureContext && !isLocalhost) {
    return 'AudioWorklet nicht verfuegbar: Seite laeuft ueber HTTP. Bitte https://dm0.de/x/ nutzen.';
  }

  if (!(ctx as any).audioWorklet || typeof (window as any).AudioWorkletNode === 'undefined') {
    return 'AudioWorklet wird von diesem Browser oder Kontext nicht unterstuetzt. Auf iOS braucht die Seite HTTPS und aktuelles Safari/iOS.';
  }

  return null;
}

export function isSharedAudioContextRunning(): boolean {
  return !!sharedAudioContext && sharedAudioContext.state === 'running';
}

/**
 * iOS/Safari Web-Audio-Unlock: spielt einen stummen 1-Sample-Buffer ab. Auf einer
 * User-Geste aufgerufen hebt das die AudioContext-Sperre auf Mobilgeraeten auf.
 * Best effort — Fehler werden geschluckt (z.B. wenn der Context gerade nicht
 * verfuegbar ist). Frueher als identischer Inline-Block an 5 Stellen dupliziert.
 */
export function unlockAudioContext(ctx: AudioContext): void {
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (e) {
    console.warn('iOS Web-Audio-Unlock (dummy buffer) fehlgeschlagen:', e);
  }
}
