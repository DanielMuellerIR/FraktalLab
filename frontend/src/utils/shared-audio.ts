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

export function hasSharedAudioContext(): boolean {
  return !!sharedAudioContext;
}

export function isSharedAudioContextRunning(): boolean {
  return !!sharedAudioContext && sharedAudioContext.state === 'running';
}
