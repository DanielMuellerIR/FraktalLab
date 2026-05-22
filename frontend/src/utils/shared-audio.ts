let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    return {} as AudioContext; // Fallback for SSR/build time
  }
  
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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

export function hasSharedAudioContext(): boolean {
  return !!sharedAudioContext;
}

export function isSharedAudioContextRunning(): boolean {
  return !!sharedAudioContext && sharedAudioContext.state === 'running';
}

