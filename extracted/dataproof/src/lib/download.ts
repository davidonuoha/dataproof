/**
 * Trigger a local file download.
 *
 * The file is built in memory and saved by the browser. Nothing is uploaded.
 */
export function downloadText(fileName: string, text: string, mimeType: string): void {
  const safeName = fileName.replace(/[^\w.\-]+/g, '_')
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Give the browser a moment to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Build a file name like "dataproof-report-government-expenditure-2024-05-01". */
export function reportFileName(prefix: string, datasetName: string, extension: string): string {
  const base = datasetName.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 60)
  const date = new Date().toISOString().slice(0, 10)
  return `${prefix}-${base || 'dataset'}-${date}.${extension}`
}
