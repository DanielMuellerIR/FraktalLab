type AudioFocusListener = (focusedId: string | null) => void;

let currentFocusId: string | null = null;
const listeners = new Set<AudioFocusListener>();

export function getAudioFocus(): string | null {
  return currentFocusId;
}

export function requestAudioFocus(id: string): void {
  if (currentFocusId === id) return;
  currentFocusId = id;
  notifyListeners();
}

export function releaseAudioFocus(id: string): void {
  if (currentFocusId === id) {
    currentFocusId = null;
    notifyListeners();
  }
}

export function resetAudioFocus(): void {
  currentFocusId = null;
  notifyListeners();
}

export function registerAudioFocusListener(listener: AudioFocusListener): () => void {
  listeners.add(listener);
  // Emit immediately on registration
  listener(currentFocusId);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  for (const listener of listeners) {
    listener(currentFocusId);
  }
}
