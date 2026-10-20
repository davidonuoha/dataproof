import { isBlank, normalizeCategory } from '../csv'
import type { ColumnProfile, Finding, ParsedTable } from '../types'
import { capRows } from './helpers'

interface VariantGroup {
  normalized: string
  variants: Map<string, number[]>
}

/**
 * Inconsistent category values.
 *
 * Values that differ only by letter case, surrounding whitespace or repeated
 * internal whitespace are grouped and reported. The original values are never
 * changed and nothing is merged automatically: DataProof suggests, the
 * journalist decides.
 */
export function checkCategoryConsistency(table: ParsedTable, profiles: ColumnProfile[]): Finding[] {
  const findings: Finding[] = []

  for (const profile of profiles) {
    if (profile.type !== 'text' && profile.type !== 'unknown') continue

    const groups = new Map<string, VariantGroup>()
    table.rows.forEach((row, index) => {
      const raw = (row[profile.index] ?? '').trim()
      if (isBlank(raw)) return
      const normalized = normalizeCategory(raw)
      let group = groups.get(normalized)
      if (!group) {
        group = { normalized, variants: new Map() }
        groups.set(normalized, group)
      }
      const rows = group.variants.get(raw)
      if (rows) rows.push(index + 1)
      else group.variants.set(raw, [index + 1])
    })

    const inconsistent = [...groups.values()].filter((g) => g.variants.size > 1)
    if (inconsistent.length === 0) continue

    const affectedRows = inconsistent
      .flatMap((g) => [...g.variants.values()].flat())
      .sort((a, b) => a - b)
    const { rows, truncated, total } = capRows(affectedRows)

    const variantSummary = inconsistent.slice(0, 30).map((g) => ({
      canonical: g.normalized,
      variants: [...g.variants.entries()].map(([value, rowNumbers]) => ({
        value,
        count: rowNumbers.length,
        exampleRow: rowNumbers[0],
      })),
    }))

    findings.push({
      id: `categories-${profile.name}`,
      category: 'categories',
      severity: 'warning',
      title: `Column "${profile.name}" has ${inconsistent.length} value${inconsistent.length === 1 ? '' : 's'} written in more than one way`,
      explanation:
        `After ignoring letter case and extra spaces, ${inconsistent.length} categor${inconsistent.length === 1 ? 'y' : 'ies'} ` +
        `in "${profile.name}" still appear as several different strings. Grouping or filtering by this column will treat ` +
        `them as separate categories, which can split a total across two rows of a chart or hide records from a filter. ` +
        `For example: ${variantSummary[0] ? variantSummary[0].variants.map((v) => `"${v.value}"`).join(' and ') : ''}.`,
      columns: [profile.name],
      rows,
      method:
        'Values are normalised by trimming, lower-casing and collapsing repeated whitespace. Normalised values that map to ' +
        'more than one original string are reported. Punctuation is deliberately preserved.',
      nextStep:
        'Check which spelling is correct and standardise it at the source. If a permitted-list rule fits this column, ' +
        'add one so that unexpected spellings are flagged in future.',
      uncertainty:
        'These are suggestions, not errors. Two similar strings may be intentionally different (for example two distinct ' +
        'places with similar names), and DataProof cannot tell which spelling is authoritative.',
      evidence: {
        column: profile.name,
        inconsistentGroupCount: inconsistent.length,
        affectedRowCount: affectedRows.length,
        rowsTruncated: truncated,
        affectedRowTotal: total,
        groups: variantSummary,
        groupsTruncated: inconsistent.length > variantSummary.length,
      },
    })
  }

  return findings
}
