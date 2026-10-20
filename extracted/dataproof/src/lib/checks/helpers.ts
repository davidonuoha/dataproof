import type { Finding } from '../types'

/**
 * Findings are meant to be inspectable. Very large affected-row lists would
 * bloat the interface and the exported reports, so they are capped and the
 * truncation is recorded in the finding evidence rather than hidden.
 */
export const MAX_ROWS_PER_FINDING = 500

export function capRows(rows: number[]): { rows: number[]; truncated: boolean; total: number } {
  if (rows.length <= MAX_ROWS_PER_FINDING) {
    return { rows, truncated: false, total: rows.length }
  }
  return { rows: rows.slice(0, MAX_ROWS_PER_FINDING), truncated: true, total: rows.length }
}

export function makeFinding(finding: Finding): Finding {
  return finding
}
