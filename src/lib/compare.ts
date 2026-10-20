import { inferColumnType } from './csv'
import { SEVERITY_ORDER } from './types'
import type {
  ColumnStructureChange,
  ComparisonResult,
  Finding,
  ParsedTable,
  RecordChange,
} from './types'

/** Comparison output is capped so that very large differences stay usable. */
export const MAX_COMPARISON_RECORDS = 5000

const KEY_SEPARATOR = '\u0000'

function keyOf(row: string[], indices: number[]): string {
  return indices.map((i) => (row[i] ?? '').trim().toLowerCase()).join(KEY_SEPARATOR)
}

function describeKey(row: string[], indices: number[]): string {
  return indices.map((i) => (row[i] ?? '').trim()).join(' | ')
}

/**
 * Compare two datasets.
 *
 * Records are aligned by the selected identifier columns. If no usable
 * identifier is supplied, DataProof falls back to row position *and says so*,
 * because row position is not a safe way to identify a record between two
 * versions of a file.
 */
export function compareDatasets(
  oldTable: ParsedTable,
  newTable: ParsedTable,
  requestedKeyColumns: string[],
): ComparisonResult {
  const limitations: string[] = []
  const findings: Finding[] = []

  const sharedHeaders = oldTable.headers.filter((h) => newTable.headers.includes(h))
  const keyColumns = requestedKeyColumns.filter((c) => oldTable.headers.includes(c) && newTable.headers.includes(c))

  if (requestedKeyColumns.length > 0 && keyColumns.length < requestedKeyColumns.length) {
    limitations.push(
      `Some selected identifier columns are missing from one of the datasets (${requestedKeyColumns
        .filter((c) => !keyColumns.includes(c))
        .join(', ')}). Those columns were ignored.`,
    )
  }

  // --- Structure ----------------------------------------------------------
  const columnChanges: ColumnStructureChange[] = []
  for (const header of newTable.headers) {
    if (!oldTable.headers.includes(header)) columnChanges.push({ name: header, change: 'added' })
  }
  for (const header of oldTable.headers) {
    if (!newTable.headers.includes(header)) columnChanges.push({ name: header, change: 'removed' })
  }
  for (const header of sharedHeaders) {
    const oldIndex = oldTable.headers.indexOf(header)
    const newIndex = newTable.headers.indexOf(header)
    const oldType = inferColumnType(oldTable.rows.map((r) => r[oldIndex] ?? ''))
    const newType = inferColumnType(newTable.rows.map((r) => r[newIndex] ?? ''))
    if (oldType !== newType && oldType !== 'unknown' && newType !== 'unknown') {
      columnChanges.push({ name: header, change: 'type-changed', previousType: oldType, newType })
    }
  }

  if (columnChanges.length > 0) {
    const added = columnChanges.filter((c) => c.change === 'added')
    const removed = columnChanges.filter((c) => c.change === 'removed')
    const retyped = columnChanges.filter((c) => c.change === 'type-changed')
    const parts: string[] = []
    if (added.length) parts.push(`${added.length} column${added.length === 1 ? '' : 's'} added (${added.map((c) => `"${c.name}"`).join(', ')})`)
    if (removed.length) parts.push(`${removed.length} column${removed.length === 1 ? '' : 's'} removed (${removed.map((c) => `"${c.name}"`).join(', ')})`)
    if (retyped.length) parts.push(`${retyped.length} column${retyped.length === 1 ? '' : 's'} changed type`)

    findings.push({
      id: 'comparison-structure',
      category: 'comparison',
      severity: 'warning',
      title: `The two datasets do not have the same structure: ${parts.join('; ')}`,
      explanation:
        `A structural change means some comparisons cannot be made row for row. ${parts.join('. ')}. ` +
        `Added or removed columns may indicate a change in how the data is published, which is itself worth documenting.`,
      columns: columnChanges.map((c) => c.name),
      rows: [],
      method: 'Column names are compared directly; column types are inferred separately for each dataset.',
      nextStep:
        'Confirm the change with the publisher. If a column was renamed rather than removed, treat it as the same field ' +
        'manually before drawing conclusions from the comparison.',
      uncertainty: 'A renamed column appears as one addition and one removal; DataProof cannot detect renames automatically.',
      evidence: { columnChanges },
    })
  }

  // --- Record alignment ---------------------------------------------------
  let records: RecordChange[] = []
  let alignment: 'key' | 'row-position' = 'key'

  if (keyColumns.length === 0) {
    alignment = 'row-position'
    limitations.push(
      'No identifier columns were selected, so records were matched by their position in each file. If records were ' +
        'inserted, deleted or reordered between versions, every subsequent row will look changed. Select one or more ' +
        'identifier columns for a reliable comparison.',
    )
    findings.push({
      id: 'comparison-no-key',
      category: 'comparison',
      severity: 'warning',
      title: 'Records were matched by row position, not by an identifier',
      explanation:
        'You did not select any columns to identify a record, so DataProof compared row 1 with row 1, row 2 with row 2, and ' +
        'so on. This is only reliable when neither file has had rows inserted, removed or reordered. Any such change will ' +
        'make later rows appear to have been modified.',
      columns: [],
      rows: [],
      method: 'Index-based alignment: record n of the older dataset is compared with record n of the newer dataset.',
      nextStep:
        'Re-run the comparison after selecting one or more columns that uniquely identify a record, such as a contract ' +
        'reference, polling-unit code or reporting period.',
      uncertainty: 'This limitation is the single most likely source of misleading results in a positional comparison.',
      evidence: { oldRowCount: oldTable.rows.length, newRowCount: newTable.rows.length },
    })

    const max = Math.max(oldTable.rows.length, newTable.rows.length)
    for (let i = 0; i < max; i += 1) {
      const oldRow = oldTable.rows[i]
      const newRow = newTable.rows[i]
      if (oldRow === undefined) {
        records.push({ kind: 'added', key: `row ${i + 1}`, newRow: i + 1, changes: [] })
        continue
      }
      if (newRow === undefined) {
        records.push({ kind: 'removed', key: `row ${i + 1}`, oldRow: i + 1, changes: [] })
        continue
      }
      const changes = sharedHeaders
        .map((header) => {
          const before = (oldRow[oldTable.headers.indexOf(header)] ?? '').trim()
          const after = (newRow[newTable.headers.indexOf(header)] ?? '').trim()
          return before === after ? null : { column: header, before, after }
        })
        .filter((c): c is { column: string; before: string; after: string } => c !== null)
      records.push({
        kind: changes.length > 0 ? 'changed' : 'unchanged',
        key: `row ${i + 1}`,
        oldRow: i + 1,
        newRow: i + 1,
        changes,
      })
    }
  } else {
    const oldIndices = keyColumns.map((c) => oldTable.headers.indexOf(c))
    const newIndices = keyColumns.map((c) => newTable.headers.indexOf(c))

    const oldMap = new Map<string, number[]>()
    oldTable.rows.forEach((row, i) => {
      const k = keyOf(row, oldIndices)
      const list = oldMap.get(k)
      if (list) list.push(i)
      else oldMap.set(k, [i])
    })
    const newMap = new Map<string, number[]>()
    newTable.rows.forEach((row, i) => {
      const k = keyOf(row, newIndices)
      const list = newMap.get(k)
      if (list) list.push(i)
      else newMap.set(k, [i])
    })

    const duplicateKeysOld = [...oldMap.entries()].filter(([, v]) => v.length > 1)
    const duplicateKeysNew = [...newMap.entries()].filter(([, v]) => v.length > 1)
    if (duplicateKeysOld.length > 0 || duplicateKeysNew.length > 0) {
      limitations.push(
        `The selected identifier is not unique: ${duplicateKeysOld.length} key value(s) repeat in the older dataset and ` +
          `${duplicateKeysNew.length} repeat in the newer dataset. Where a key repeats, the rows are paired in file order and any ` +
          `surplus row is reported as added or removed. Verify those records individually.`,
      )
      findings.push({
        id: 'comparison-duplicate-key',
        category: 'comparison',
        severity: 'warning',
        title: 'The selected identifier is not unique in one or both datasets',
        explanation:
          `The columns ${keyColumns.map((c) => `"${c}"`).join(', ')} repeat in ${duplicateKeysOld.length} key value(s) in the older ` +
          `dataset and ${duplicateKeysNew.length} in the newer dataset. When a key matches several rows, DataProof pairs them in ` +
          `file order and reports any leftover row as added or removed. A positional pairing inside a repeated key is not a reliable ` +
          `identification, so those records should be checked by hand.`,
        columns: keyColumns,
        rows: [],
        method: 'Keys are built from the trimmed, case-insensitive values of the selected identifier columns.',
        nextStep: 'Choose a combination of columns that identifies a single record, or resolve the duplication in the source data first.',
        uncertainty: 'Comparisons for repeated keys may be incomplete or paired incorrectly.',
        evidence: {
          keyColumns,
          duplicateKeysOld: duplicateKeysOld.slice(0, 20).map(([k, v]) => ({ key: k, rowCount: v.length })),
          duplicateKeysNew: duplicateKeysNew.slice(0, 20).map(([k, v]) => ({ key: k, rowCount: v.length })),
        },
      })
    }

    const allKeys = new Set<string>([...oldMap.keys(), ...newMap.keys()])
    for (const k of allKeys) {
      const oldList = oldMap.get(k) ?? []
      const newList = newMap.get(k) ?? []

      // Pair rows positionally up to the shorter side, then report the surplus.
      // This is the only honest option when a key is not unique: the rows cannot
      // be told apart, so nothing is silently dropped.
      const pairs = Math.min(oldList.length, newList.length)
      for (let i = 0; i < pairs; i += 1) {
        const oldRow = oldTable.rows[oldList[i]]
        const newRow = newTable.rows[newList[i]]
        const changes = sharedHeaders
          .map((header) => {
            const before = (oldRow[oldTable.headers.indexOf(header)] ?? '').trim()
            const after = (newRow[newTable.headers.indexOf(header)] ?? '').trim()
            return before === after ? null : { column: header, before, after }
          })
          .filter((c): c is { column: string; before: string; after: string } => c !== null)
        records.push({
          kind: changes.length > 0 ? 'changed' : 'unchanged',
          key: describeKey(oldRow, oldIndices),
          oldRow: oldList[i] + 1,
          newRow: newList[i] + 1,
          changes,
        })
      }
      for (let i = pairs; i < oldList.length; i += 1) {
        records.push({
          kind: 'removed',
          key: describeKey(oldTable.rows[oldList[i]], oldIndices),
          oldRow: oldList[i] + 1,
          changes: [],
        })
      }
      for (let i = pairs; i < newList.length; i += 1) {
        records.push({
          kind: 'added',
          key: describeKey(newTable.rows[newList[i]], newIndices),
          newRow: newList[i] + 1,
          changes: [],
        })
      }
    }
  }

  const counts = {
    added: records.filter((r) => r.kind === 'added').length,
    removed: records.filter((r) => r.kind === 'removed').length,
    changed: records.filter((r) => r.kind === 'changed').length,
    unchanged: records.filter((r) => r.kind === 'unchanged').length,
  }

  const truncated = records.length > MAX_COMPARISON_RECORDS
  if (truncated) {
    records = records.slice(0, MAX_COMPARISON_RECORDS)
    limitations.push(
      `The comparison found ${counts.added + counts.removed + counts.changed} differing records; the detail list is limited to the ` +
        `first ${MAX_COMPARISON_RECORDS}. The counts above describe the full comparison.`,
    )
  }

  records.sort((a, b) => {
    const order: Record<string, number> = { added: 0, removed: 1, changed: 2, unchanged: 3 }
    return order[a.kind] - order[b.kind]
  })

  // --- Findings about the record-level differences -------------------------
  if (counts.changed > 0) {
    const changedRecords = records.filter((r) => r.kind === 'changed')
    const perColumn = new Map<string, number>()
    for (const record of changedRecords) {
      for (const change of record.changes) {
        perColumn.set(change.column, (perColumn.get(change.column) ?? 0) + 1)
      }
    }
    const topColumns = [...perColumn.entries()].sort((a, b) => b[1] - a[1])
    findings.push({
      id: 'comparison-changed',
      category: 'comparison',
      severity: 'warning',
      title: `${counts.changed} record${counts.changed === 1 ? '' : 's'} changed between the two versions`,
      explanation:
        `${counts.changed} record${counts.changed === 1 ? '' : 's'} exist in both datasets but with different values. ` +
        `The most frequently changed column${topColumns.length === 1 ? ' is' : 's are'} ` +
        `${topColumns.slice(0, 5).map(([c, n]) => `"${c}" (${n})`).join(', ')}. ` +
        `A changed value can be a routine revision, a correction of an earlier error, or a revision of previously published ` +
        `figures — each of which is worth knowing about before publishing.`,
      columns: topColumns.map(([c]) => c),
      rows: changedRecords.map((r) => r.newRow ?? r.oldRow ?? 0).filter((n) => n > 0),
      method: `Records are matched by ${keyColumns.length > 0 ? keyColumns.map((c) => `"${c}"`).join(', ') : 'row position'}, then every shared column is compared as trimmed text.`,
      nextStep: 'Review the before-and-after values in the comparison table and confirm the reason for each change with the publisher.',
      uncertainty: 'A changed value does not indicate which version is correct.',
      evidence: { changedCount: counts.changed, changesByColumn: Object.fromEntries(topColumns) },
    })
  }

  if (counts.added > 0 || counts.removed > 0) {
    findings.push({
      id: 'comparison-added-removed',
      category: 'comparison',
      severity: 'warning',
      title: `${counts.added} record${counts.added === 1 ? '' : 's'} added and ${counts.removed} removed in the newer dataset`,
      explanation:
        `${counts.added} record${counts.added === 1 ? '' : 's'} appear only in "${newTable.fileName}" and ${counts.removed} appear ` +
        `only in "${oldTable.fileName}". Records can disappear when an entry is withdrawn, when a unit is merged, or when the ` +
        `publisher changes its scope. The counts may not match the change in file length, because a record can be both added and removed.`,
      columns: keyColumns,
      rows: [],
      method: `Set difference over the ${keyColumns.length > 0 ? 'identifier' : 'row position'} keys of the two datasets.`,
      nextStep: 'Check the removed records against the previous publication and ask the publisher why they are no longer present.',
      uncertainty: 'A record that is absent may have been renamed rather than removed.',
      evidence: { added: counts.added, removed: counts.removed },
    })
  }

  if (counts.added === 0 && counts.removed === 0 && counts.changed === 0 && columnChanges.length === 0) {
    findings.push({
      id: 'comparison-identical',
      category: 'comparison',
      severity: 'info',
      title: 'No differences were found between the two datasets',
      explanation:
        `Using the selected identifier, every record matches and every shared column has the same value. The two files appear ` +
        `to describe the same data.`,
      columns: [],
      rows: [],
      method: `Records are matched by ${keyColumns.length > 0 ? keyColumns.map((c) => `"${c}"`).join(', ') : 'row position'} and every shared column is compared as trimmed text.`,
      nextStep: 'No action is required. If you expected a change, check that the correct two files were selected.',
      uncertainty: 'Textual equality does not mean the figures are correct.',
      evidence: { counts },
    })
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  return {
    oldName: oldTable.fileName,
    newName: newTable.fileName,
    generatedAt: new Date().toISOString(),
    keyColumns,
    alignment,
    columnChanges,
    records,
    counts,
    findings,
    limitations,
    truncated,
  }
}
