import type * as wasmType from '@wasm/fraktallab_wasm.js'

let wasmPromise: Promise<typeof wasmType> | null = null

export function getWasmModule(): Promise<typeof wasmType> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      try {
        console.log('[WASM-Loader] Initiating dynamic import of @wasm/fraktallab_wasm.js...');
        const wasm = await import('@wasm/fraktallab_wasm.js')
        console.log('[WASM-Loader] WASM import successful. Starting default initialization...');
        await wasm.default()
        console.log('[WASM-Loader] WASM default initialization complete. Module ready.');
        return wasm
      } catch (err) {
        console.error('[WASM-Loader] CRITICAL: Failed to load or initialize WASM module:', err)
        throw err
      }
    })()
  }
  return wasmPromise
}
