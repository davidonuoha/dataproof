/**
 * HTML escaping.
 *
 * Every value that comes from a dataset, a file name or a user-defined rule is
 * passed through `escapeHtml` before it reaches an exported report. Uploaded
 * data is untrusted input: a cell containing `<script>` must be displayed as
 * text, never executed.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escape a value for inclusion in a CSV cell. */
export function escapeCsv(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
