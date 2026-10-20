import { escapeHtml } from '../html'
import { CATEGORY_LABELS, SEVERITY_LABELS, type AnalysisResult, type ColumnProfile, type ComparisonResult, type Finding, type ParsedTable } from '../types'
import { DEFAULT_EXPORT_OPTIONS, TOOL_INFO, type ExportOptions } from './json'

const REPORT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f6f6f4; color: #1c1c1a;
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .page { max-width: 960px; margin: 0 auto; padding: 40px 24px 80px; }
  header.report-head { border-bottom: 2px solid #1c1c1a; padding-bottom: 20px; margin-bottom: 28px; }
  .tool { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #5c5c57; }
  h1 { font-size: 26px; margin: 6px 0 4px; }
  h2 { font-size: 18px; margin: 36px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #d6d6d0; }
  h3 { font-size: 15px; margin: 22px 0 6px; }
  .meta { color: #5c5c57; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 18px 0; }
  .stat { background: #fff; border: 1px solid #dedeD8; border-radius: 6px; padding: 12px 14px; }
  .stat .n { font-size: 22px; font-weight: 600; display: block; }
  .stat .l { font-size: 12px; color: #5c5c57; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; background: #fff; }
  th, td { border: 1px solid #dedeD8; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #efefeb; font-weight: 600; }
  .finding { background: #fff; border: 1px solid #dedeD8; border-left-width: 4px; border-radius: 6px; padding: 14px 16px; margin: 14px 0; }
  .finding.error { border-left-color: #a01a1a; }
  .finding.warning { border-left-color: #9a6b00; }
  .finding.info { border-left-color: #2c5f8a; }
  .badge { display: inline-block; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; padding: 2px 7px; border-radius: 3px; margin-right: 8px; }
  .badge.error { background: #f7e2e2; color: #7c1414; }
  .badge.warning { background: #f8eed8; color: #6f4d00; }
  .badge.info { background: #e2ecf5; color: #1f4a6e; }
  .fields { margin: 10px 0 0; font-size: 13px; }
  .fields dt { font-weight: 600; margin-top: 8px; }
  .fields dd { margin: 2px 0 0; color: #33332f; }
  .rows { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #33332f; word-break: break-word; }
  .callout { background: #fff8e1; border: 1px solid #e6d79a; border-radius: 6px; padding: 12px 14px; font-size: 13px; margin: 16px 0; }
  .callout.privacy { background: #eef4fa; border-color: #b9d0e6; }
  ul { margin: 8px 0; padding-left: 22px; }
  li { margin: 4px 0; }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #d6d6d0; font-size: 12px; color: #5c5c57; }
  @media print { body { background: #fff; } .page { padding: 0; } .finding { break-inside: avoid; } }
`

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="page">
${body}
</div>
</body>
</html>
`
}

function findingBlock(finding: Finding, table: ParsedTable | null, options: ExportOptions): string {
  const rowsText =
    finding.rows.length === 0
      ? 'Not row-specific'
      : finding.rows.slice(0, 100).join(', ') + (finding.rows.length > 100 ? ` … (${finding.rows.length} rows in total)` : '')

  let recordTable = ''
  if (options.includeValues && table && finding.rows.length > 0) {
    const limit = Math.min(finding.rows.length, options.maxRecordsPerFinding)
    const headerCells = table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
    const bodyRows = finding.rows
      .slice(0, limit)
      .map((rowNumber) => {
        const cells = table.rows[rowNumber - 1] ?? []
        const tds = table.headers.map((_, i) => `<td>${escapeHtml(cells[i] ?? '')}</td>`).join('')
        return `<tr><th scope="row">${rowNumber}</th>${tds}</tr>`
      })
      .join('')
    recordTable =
      `<h3>Affected record values</h3>` +
      `<p class="meta">Showing ${limit} of ${finding.rows.length} affected record${finding.rows.length === 1 ? '' : 's'}. These values come from the analysed dataset and were included because record values were enabled at export time.</p>` +
      `<div style="overflow-x:auto"><table><thead><tr><th>Row</th>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`
  }

  return `<div class="finding ${finding.severity}">
  <h3><span class="badge ${finding.severity}">${escapeHtml(SEVERITY_LABELS[finding.severity])}</span>${escapeHtml(finding.title)}</h3>
  <p>${escapeHtml(finding.explanation)}</p>
  <dl class="fields">
    <dt>Category</dt><dd>${escapeHtml(CATEGORY_LABELS[finding.category] ?? finding.category)}</dd>
    <dt>Column(s)</dt><dd>${finding.columns.length ? finding.columns.map((c) => escapeHtml(c)).join(', ') : '—'}</dd>
    <dt>Affected row(s)</dt><dd class="rows">${escapeHtml(rowsText)}</dd>
    <dt>Rule or method used</dt><dd>${escapeHtml(finding.method)}</dd>
    <dt>Suggested next step</dt><dd>${escapeHtml(finding.nextStep)}</dd>
    ${finding.uncertainty ? `<dt>What this finding does not establish</dt><dd>${escapeHtml(finding.uncertainty)}</dd>` : ''}
  </dl>
  ${recordTable}
</div>`
}

export function buildHtmlReport(
  analysis: AnalysisResult,
  table: ParsedTable | null,
  profiles: ColumnProfile[],
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): string {
  const generated = new Date(analysis.generatedAt)
  const categories = [...new Set(analysis.findings.map((f) => f.category))]

  const findingsByCategory = categories
    .map((category) => {
      const items = analysis.findings.filter((f) => f.category === category)
      return `<h2>${escapeHtml(CATEGORY_LABELS[category] ?? category)} (${items.length})</h2>` +
        items.map((f) => findingBlock(f, table, options)).join('')
    })
    .join('')

  const columnRows = profiles
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.type)}${p.userOverride ? ' (set by you)' : ''}</td>` +
        `<td>${p.nonEmptyCount}</td><td>${p.emptyCount}</td><td>${p.distinctCount}</td></tr>`,
    )
    .join('')

  const statsRows = analysis.numericStats
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.column)}</td><td>${s.count}</td><td>${fmt(s.min)}</td><td>${fmt(s.max)}</td>` +
        `<td>${fmt(s.mean)}</td><td>${fmt(s.median)}</td><td>${fmt(s.standardDeviation)}</td>` +
        `<td>${s.outlierCount}</td><td>${s.invalidCount}</td></tr>`,
    )
    .join('')

  const settings = analysis.settings
  const rulesText =
    settings.rules.length === 0
      ? '<li>No user-defined validation rules were created.</li>'
      : settings.rules
          .map((r) => `<li>${escapeHtml(r.label || describeRuleInline(r.kind, r.column, r.min, r.max, r.allowed))}${r.enabled ? '' : ' (disabled)'}</li>`)
          .join('')
  const crossText =
    settings.crossFieldRules.length === 0
      ? '<li>No cross-field comparisons were defined.</li>'
      : settings.crossFieldRules
          .map((r) => `<li>${escapeHtml(r.label || `${r.components.join(' + ')} = ${r.total}`)} (tolerance ${r.tolerance}${r.toleranceMode === 'percent' ? '%' : ''})</li>`)
          .join('')

  const body = `
<header class="report-head">
  <div class="tool">${escapeHtml(TOOL_INFO.name)} ${escapeHtml(TOOL_INFO.version)} — data quality report</div>
  <h1>Dataset quality report: ${escapeHtml(analysis.datasetName)}</h1>
  <p class="meta">Generated ${escapeHtml(generated.toISOString().replace('T', ' ').slice(0, 19))} UTC</p>
</header>

<div class="callout">
  <strong>This report is not proof that the data is accurate.</strong> ${escapeHtml(TOOL_INFO.name)} checks whether a dataset is
  internally consistent. It cannot confirm that a figure matches the real world. Every finding describes something to
  investigate, not something that has been shown to be wrong.
</div>

${
  options.includeValues
    ? `<div class="callout privacy"><strong>Privacy notice.</strong> This report includes values taken from the analysed dataset. Treat the file as sensitive and check it before sharing.</div>`
    : `<div class="callout privacy"><strong>Privacy.</strong> This report reproduces no records from the analysed dataset. Individual findings quote a small number of example values (up to 20) to explain what was detected, but the values of affected records are not reproduced.</div>`
}

<h2>Dataset summary</h2>
<div class="grid">
  <div class="stat"><span class="n">${analysis.summary.recordCount}</span><span class="l">Records</span></div>
  <div class="stat"><span class="n">${analysis.summary.columnCount}</span><span class="l">Columns</span></div>
  <div class="stat"><span class="n">${analysis.summary.findingCount}</span><span class="l">Findings</span></div>
  <div class="stat"><span class="n">${analysis.summary.bySeverity.error}</span><span class="l">Errors</span></div>
  <div class="stat"><span class="n">${analysis.summary.bySeverity.warning}</span><span class="l">Warnings</span></div>
  <div class="stat"><span class="n">${analysis.summary.bySeverity.info}</span><span class="l">Information</span></div>
  <div class="stat"><span class="n">${analysis.summary.affectedRowCount}</span><span class="l">Rows with findings</span></div>
</div>
<table>
  <thead><tr><th>File</th><th>Delimiter</th><th>Header row</th><th>Size</th></tr></thead>
  <tbody><tr>
    <td>${escapeHtml(analysis.datasetName)}</td>
    <td>${escapeHtml(table ? delimiterName(table.delimiter) : '—')}</td>
    <td>${table?.hasHeader ? 'Yes' : 'No'}</td>
    <td>${table ? escapeHtml(formatBytes(table.fileSizeBytes)) : '—'}</td>
  </tr></tbody>
</table>

<h2>Columns</h2>
<div style="overflow-x:auto">
<table>
  <thead><tr><th>Column</th><th>Type</th><th>Non-empty</th><th>Empty</th><th>Distinct</th></tr></thead>
  <tbody>${columnRows}</tbody>
</table>
</div>

${
  table && table.parseIssues.length > 0
    ? `<h2>Records that could not be read cleanly</h2>
<table>
  <thead><tr><th>Row</th><th>Issue</th><th>Detail</th></tr></thead>
  <tbody>${table.parseIssues
    .slice(0, 100)
    .map(
      (i) =>
        `<tr><td>${i.row ?? '—'}</td><td>${escapeHtml(i.code)}</td><td>${escapeHtml(i.message)}</td></tr>`,
    )
    .join('')}</tbody>
</table>`
    : ''
}

<h2>Findings by category</h2>
${analysis.findings.length === 0 ? '<p>No findings were produced by the checks that were run.</p>' : findingsByCategory}

${
  statsRows
    ? `<h2>Numerical statistics</h2>
<p class="meta">Computed over the values that parsed as numbers. Outliers use ${
        settings.outlierMethod === 'iqr' ? "Tukey's interquartile range rule" : 'the z-score method'
      } with a threshold of ${settings.outlierThreshold}.</p>
<div style="overflow-x:auto"><table>
  <thead><tr><th>Column</th><th>n</th><th>Min</th><th>Max</th><th>Mean</th><th>Median</th><th>Std dev</th><th>Outliers</th><th>Invalid</th></tr></thead>
  <tbody>${statsRows}</tbody>
</table></div>`
    : ''
}

<h2>Methodology</h2>
<p class="meta">Checks performed, in the order the application runs them:</p>
<ul>${analysis.checksPerformed.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
<p class="meta">Validation rules defined for this analysis:</p>
<ul>${rulesText}</ul>
<p class="meta">Cross-field comparisons defined for this analysis:</p>
<ul>${crossText}</ul>
<p class="meta">Duplicate matching key: ${
    settings.duplicateKeyColumns.length > 0
      ? escapeHtml(settings.duplicateKeyColumns.join(', '))
      : 'entire row (no key columns selected)'
  }.</p>

<h2>Known limitations</h2>
<ul>${analysis.limitations.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>

<footer>
  Generated locally by ${escapeHtml(TOOL_INFO.name)} ${escapeHtml(TOOL_INFO.version)}. ${escapeHtml(TOOL_INFO.processing)}
</footer>`

  return page(`DataProof report — ${analysis.datasetName}`, body)
}

export function buildHtmlComparisonReport(
  comparison: ComparisonResult,
  oldTable: ParsedTable,
  newTable: ParsedTable,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): string {
  const generated = new Date(comparison.generatedAt)
  const differing = comparison.records.filter((r) => r.kind !== 'unchanged')

  const recordRows = differing
    .slice(0, 300)
    .map((record) => {
      const detail =
        record.kind === 'changed'
          ? record.changes
              .map((c) => `<div><strong>${escapeHtml(c.column)}:</strong> ${escapeHtml(c.before)} → ${escapeHtml(c.after)}</div>`)
              .join('')
          : '—'
      return `<tr><td>${escapeHtml(record.kind)}</td><td>${escapeHtml(record.key)}</td><td>${record.oldRow ?? '—'}</td><td>${record.newRow ?? '—'}</td><td>${detail}</td></tr>`
    })
    .join('')

  const body = `
<header class="report-head">
  <div class="tool">${escapeHtml(TOOL_INFO.name)} ${escapeHtml(TOOL_INFO.version)} — dataset comparison report</div>
  <h1>Comparison report</h1>
  <p class="meta">Generated ${escapeHtml(generated.toISOString().replace('T', ' ').slice(0, 19))} UTC</p>
</header>

<div class="callout">
  <strong>A difference is not an error.</strong> This report shows where two versions of a dataset differ. It does not
  establish which version is correct, and it cannot detect a change that both versions share.
</div>

<h2>Datasets compared</h2>
<table>
  <thead><tr><th></th><th>Older</th><th>Newer</th></tr></thead>
  <tbody>
    <tr><th>File</th><td>${escapeHtml(oldTable.fileName)}</td><td>${escapeHtml(newTable.fileName)}</td></tr>
    <tr><th>Records</th><td>${oldTable.rows.length}</td><td>${newTable.rows.length}</td></tr>
    <tr><th>Columns</th><td>${oldTable.headers.length}</td><td>${newTable.headers.length}</td></tr>
  </tbody>
</table>
<p class="meta">Records were matched by ${
    comparison.alignment === 'key'
      ? `the identifier column(s) ${escapeHtml(comparison.keyColumns.join(', '))}`
      : 'row position (no identifier selected)'
  }.</p>

<div class="grid">
  <div class="stat"><span class="n">${comparison.counts.added}</span><span class="l">Added</span></div>
  <div class="stat"><span class="n">${comparison.counts.removed}</span><span class="l">Removed</span></div>
  <div class="stat"><span class="n">${comparison.counts.changed}</span><span class="l">Changed</span></div>
  <div class="stat"><span class="n">${comparison.counts.unchanged}</span><span class="l">Unchanged</span></div>
</div>

${
  comparison.columnChanges.length > 0
    ? `<h2>Structure changes</h2>
<table><thead><tr><th>Column</th><th>Change</th><th>Detail</th></tr></thead><tbody>
${comparison.columnChanges
  .map(
    (c) =>
      `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.change)}</td><td>${
        c.change === 'type-changed' ? `${escapeHtml(c.previousType ?? '')} → ${escapeHtml(c.newType ?? '')}` : '—'
      }</td></tr>`,
  )
  .join('')}
</tbody></table>`
    : ''
}

<h2>Findings</h2>
${comparison.findings.map((f) => findingBlock(f, null, { ...options, includeValues: false })).join('')}

<h2>Changed records</h2>
${
  differing.length === 0
    ? '<p>No differing records were found.</p>'
    : `<p class="meta">Showing ${Math.min(differing.length, 300)} of ${differing.length} differing records.</p>
<div style="overflow-x:auto"><table>
  <thead><tr><th>Change</th><th>Identifier</th><th>Row (older)</th><th>Row (newer)</th><th>Before → after</th></tr></thead>
  <tbody>${recordRows}</tbody>
</table></div>`
}

<h2>Known limitations</h2>
<ul>${comparison.limitations.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>

<footer>
  Generated locally by ${escapeHtml(TOOL_INFO.name)} ${escapeHtml(TOOL_INFO.version)}. ${escapeHtml(TOOL_INFO.processing)}
</footer>`

  return page('DataProof comparison report', body)
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value)
}

function delimiterName(delimiter: string): string {
  if (delimiter === ',') return 'comma'
  if (delimiter === ';') return 'semicolon'
  if (delimiter === '\t') return 'tab'
  if (delimiter === '|') return 'pipe'
  return JSON.stringify(delimiter)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function describeRuleInline(
  kind: string,
  column: string,
  min?: number,
  max?: number,
  allowed?: string[],
): string {
  switch (kind) {
    case 'required':
      return `"${column}" must not be empty`
    case 'range':
      return `"${column}" must be between ${min ?? '-∞'} and ${max ?? '∞'}`
    case 'unique':
      return `"${column}" must contain unique values`
    case 'allowed':
      return `"${column}" must be one of: ${(allowed ?? []).join(', ')}`
    case 'nonnegative':
      return `"${column}" must be greater than or equal to zero`
    default:
      return `"${column}" rule`
  }
}
