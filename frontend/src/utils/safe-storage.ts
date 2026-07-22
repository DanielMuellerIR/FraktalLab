/**
 * Fehlertoleranter Zugriff auf localStorage. Browser duerfen bereits beim Lesen
 * eine SecurityError werfen (z. B. in eingebetteten/privaten Kontexten). Die App
 * laeuft dann bewusst ohne Persistenz weiter.
 */
export function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function storageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function storageRemove(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** JSON nur uebernehmen, wenn die gelesene Struktur explizit validiert wurde. */
export function storageReadJson<T>(
  key: string,
  validate: (value: unknown) => value is T,
  fallback: T,
): T {
  const raw = storageGet(key)
  if (raw == null) return fallback
  try {
    const value: unknown = JSON.parse(raw)
    return validate(value) ? value : fallback
  } catch {
    return fallback
  }
}
