/// <reference lib="webworker" />
/**
 * CSV parsing worker.
 *
 * Parsing a large file on the main thread would freeze the interface. When the
 * browser supports module workers, DataProof parses in this worker instead and
 * posts the finished table back. The parsing code itself is the same pure
 * function used by the tests and by the main-thread fallback.
 */
import { parseCsvText, type ParseOptions } from './csv'

interface WorkerRequest {
  id: number
  text: string
  fileName: string
  fileSize: number
  options: ParseOptions
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, text, fileName, fileSize, options } = event.data
  try {
    const result = parseCsvText(text, fileName, fileSize, options)
    ;(self as unknown as Worker).postMessage({ id, result })
  } catch (error) {
    ;(self as unknown as Worker).postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
