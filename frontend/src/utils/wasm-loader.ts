import type * as wasmType from '@wasm/fraktallab_wasm.js'

let wasmPromise: Promise<typeof wasmType> | null = null

export function getWasmModule(): Promise<typeof wasmType> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      const wasm = await import('@wasm/fraktallab_wasm.js')
      await wasm.default()
      return wasm
    })()
  }
  return wasmPromise
}
