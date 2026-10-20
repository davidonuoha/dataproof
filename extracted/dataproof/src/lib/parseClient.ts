import { parseCsvText, type ParseOptions } from './csv'
import type { ParsedTable } from './types'

let workerCounter = 0

/**
 * Parse CSV text, preferring a Web Worker so that the interface stays
 * responsive on large files.
 *
 * If workers are unavailable (older browsers, or a test environment without
 * Worker support), parsing falls back to the main thread. The result is
 * identical either way, because both paths call the same pure function.
 */
export function parseInWorker(
  text: string,
  fileName: string,
  fileSize: number,
  options: ParseOptions,
): Promise<ParsedTable> {
  if (typeof Worker === 'undefined' || typeof URL === 'undefined') {
    return Promise.resolve(parseCsvText(text, fileName, fileSize, options))
  }

  return new Promise<ParsedTable>((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./csvWorker.ts', import.meta.url), { type: 'module' })
    } catch {
      resolve(parseCsvText(text, fileName, fileSize, options))
      return
    }

    const id = ++workerCounter
    const cleanup = () => worker.terminate()

    worker.onmessage = (event: MessageEvent<{ id: number; result?: ParsedTable; error?: string }>) => {
      if (event.data.id !== id) return
      cleanup()
      if (event.data.error) reject(new Error(event.data.error))
      else if (event.data.result) resolve(event.data.result)
      else reject(new Error('The parser worker returned no result.'))
    }
    worker.onerror = () => {
      cleanup()
      // A worker failure should not block the analysis: retry on the main thread.
      try {
        resolve(parseCsvText(text, fileName, fileSize, options))
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    worker.postMessage({ id, text, fileName, fileSize, options })
  })
}

/** Yield to the event loop so that a loading state can paint before heavy work. */
export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
