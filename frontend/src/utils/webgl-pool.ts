interface WebGLPoolItem {
  id: string;
  onLoseContext: () => void;
  lastActive: number;
  visible: boolean;
}

const MAX_GL_CONTEXTS = 6;
const activePool: WebGLPoolItem[] = [];

/**
 * Registers/acquires a slot in the global WebGL context pool.
 * If the pool size exceeds MAX_GL_CONTEXTS, evicts the Least Recently Used (LRU)
 * context to prevent WebGL tab limits (8-16) from crashing the browser.
 */
export function acquireWebGLSlot(
  id: string,
  onLoseContext: () => void,
  visible: boolean
): boolean {
  // Check if already registered
  const existingIdx = activePool.findIndex((item) => item.id === id);
  if (existingIdx !== -1) {
    activePool[existingIdx].lastActive = performance.now();
    activePool[existingIdx].visible = visible;
    return true;
  }

  // If pool is full, evict a slot
  if (activePool.length >= MAX_GL_CONTEXTS) {
    // 1. Prioritize evicting an invisible panel
    let victimIdx = activePool.findIndex((item) => !item.visible);

    // 2. Fallback to Least Recently Used (LRU) item
    if (victimIdx === -1) {
      let oldestTime = Infinity;
      for (let i = 0; i < activePool.length; i++) {
        if (activePool[i].lastActive < oldestTime) {
          oldestTime = activePool[i].lastActive;
          victimIdx = i;
        }
      }
    }

    if (victimIdx !== -1) {
      const victim = activePool.splice(victimIdx, 1)[0];
      console.log(`[WebGLPool] Evicting context: ${victim.id}`);
      victim.onLoseContext();
    }
  }

  // Add new item
  activePool.push({
    id,
    onLoseContext,
    lastActive: performance.now(),
    visible,
  });

  return true;
}

/**
 * Releases a registered slot from the pool.
 */
export function releaseWebGLSlot(id: string): void {
  const idx = activePool.findIndex((item) => item.id === id);
  if (idx !== -1) {
    activePool.splice(idx, 1);
  }
}

/**
 * Updates the visibility state and updates the active timestamp of a panel.
 */
export function updateWebGLSlotActivity(id: string, visible: boolean): void {
  const item = activePool.find((p) => p.id === id);
  if (item) {
    item.lastActive = performance.now();
    item.visible = visible;
  }
}
