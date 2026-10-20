import { isBlank, mean, median, parseNumber, quantile, standardDeviation } from '../csv'
import type { AnalysisSettings, ColumnProfile, Finding, NumericStats, ParsedTable } from '../types'
import { capRows } from './helpers'

/**
 * Numerical validation and descriptive statistics.
 *
 * Outliers are detected with a transparent, documented method (the Tukey IQR
 * fence by default, or a z-score threshold). An outlier is reported as an
 * observation requiring investigation — never as an error and never as proof
 * that a figure is wrong.
 */
export function computeNumericStats(
  table: ParsedTable,
  profiles: ColumnProfile[],
  settings: AnalysisSettings,
): NumericStats[] {
  const stats: NumericStats[] = []

  for (const profile of profiles) {
    if (profile.type !== 'number') continue
    const values: number[] = []
    let invalidCount = 0

    for (const row of table.rows) {
      const raw = row[profile.index] ?? ''
      if (isBlank(raw)) continue
      const n = parseNumber(raw)
      if (n === null) invalidCount += 1
      else values.push(n)
    }

    if (values.length === 0) {
      stats.push({
        column: profile.name,
        count: 0,
        invalidCount,
        min: NaN,
        max: NaN,
        mean: NaN,
        median: NaN,
        standardDeviation: NaN,
        q1: NaN,
        q3: NaN,
        iqr: NaN,
        lowerFence: NaN,
        upperFence: NaN,
        outlierCount: 0,
        extremeOutlierCount: 0,
        negativeCount: 0,
        zeroCount: 0,
      })
      continue
    }

    const sorted = [...values].sort((a, b) => a - b)
    const q1 = quantile(sorted, 0.25)
    const q3 = quantile(sorted, 0.75)
    const iqr = q3 - q1

    let lowerFence: number
    let upperFence: number
    if (settings.outlierMethod === 'zscore') {
      const m = mean(values)
      const sd = standardDeviation(values)
      lowerFence = sd === 0 ? m : m - settings.outlierThreshold * sd
      upperFence = sd === 0 ? m : m + settings.outlierThreshold * sd
    } else {
      const k = settings.outlierThreshold
      lowerFence = q1 - k * iqr
      upperFence = q3 + k * iqr
    }

    const extremeK = settings.outlierMethod === 'zscore' ? settings.outlierThreshold * 2 : settings.outlierThreshold * 2
    let extremeOutlierCount = 0
    if (settings.outlierMethod === 'iqr') {
      for (const v of values) {
        if (v < q1 - extremeK * iqr || v > q3 + extremeK * iqr) extremeOutlierCount += 1
      }
    } else {
      const m = mean(values)
      const sd = standardDeviation(values)
      if (sd > 0) {
        for (const v of values) {
          if (Math.abs((v - m) / sd) > extremeK) extremeOutlierCount += 1
        }
      }
    }

    stats.push({
      column: profile.name,
      count: values.length,
      invalidCount,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: mean(values),
      median: median(values),
      standardDeviation: standardDeviation(values),
      q1,
      q3,
      iqr,
      lowerFence,
      upperFence,
      outlierCount: values.filter((v) => v < lowerFence || v > upperFence).length,
      extremeOutlierCount,
      negativeCount: values.filter((v) => v < 0).length,
      zeroCount: values.filter((v) => v === 0).length,
    })
  }

  return stats
}

export function checkNumeric(
  table: ParsedTable,
  profiles: ColumnProfile[],
  stats: NumericStats[],
  settings: AnalysisSettings,
): Finding[] {
  const findings: Finding[] = []
  const byColumn = new Map(stats.map((s) => [s.column, s]))

  for (const profile of profiles) {
    if (profile.type !== 'number') continue
    const values = table.rows.map((row) => row[profile.index] ?? '')

    // 1. Values that cannot be read as numbers at all.
    const invalidRows: number[] = []
    const invalidExamples: string[] = []
    values.forEach((raw, index) => {
      if (isBlank(raw)) return
      if (parseNumber(raw) === null) {
        invalidRows.push(index + 1)
        if (invalidExamples.length < 20 && !invalidExamples.includes(raw.trim())) invalidExamples.push(raw.trim())
      }
    })

    if (invalidRows.length > 0) {
      const { rows, truncated, total } = capRows(invalidRows)
      findings.push({
        id: `numeric-invalid-${profile.name}`,
        category: 'numeric',
        severity: profile.userOverride ? 'error' : 'warning',
        title: `${invalidRows.length} value${invalidRows.length === 1 ? '' : 's'} in "${profile.name}" cannot be read as a number`,
        explanation:
          `"${profile.name}" is being treated as a numeric column, but ${invalidRows.length} non-empty value` +
          `${invalidRows.length === 1 ? '' : 's'} could not be interpreted as a number. ` +
          `Examples: ${invalidExamples.map((v) => `"${v}"`).join(', ')}. ` +
          `These rows are excluded from every statistic computed for this column, so the totals and averages below ` +
          `describe only the rows that did parse.`,
        columns: [profile.name],
        rows,
        method:
          'A value is numeric when it is an optional sign followed by digits, optionally with a valid thousands grouping, ' +
          'decimal point, exponent, currency prefix, trailing percent sign or accounting parentheses. Leading zeros are ' +
          'treated as text so identifiers are preserved.',
        nextStep:
          'Inspect the listed values. Common causes are placeholder text, a footnote marker, a currency symbol in an ' +
          'unexpected position, or a value that belongs in a different column.',
        uncertainty:
          'DataProof does not repair values. If the column was mis-detected, change its type in the column settings.',
        evidence: {
          column: profile.name,
          invalidCount: invalidRows.length,
          examples: invalidExamples,
          rowsTruncated: truncated,
          affectedRowTotal: total,
          parsedCount: byColumn.get(profile.name)?.count ?? 0,
        },
      })
    }

    const columnStats = byColumn.get(profile.name)
    if (!columnStats || columnStats.count === 0) continue

    // 2. Descriptive summary — recorded as information so the numbers used are visible.
    findings.push({
      id: `numeric-summary-${profile.name}`,
      category: 'numeric',
      severity: 'info',
      title: `"${profile.name}": ${columnStats.count} numeric values, min ${formatStat(columnStats.min)}, max ${formatStat(columnStats.max)}`,
      explanation:
        `Minimum ${formatStat(columnStats.min)}, maximum ${formatStat(columnStats.max)}, mean ${formatStat(columnStats.mean)}, ` +
        `median ${formatStat(columnStats.median)}, standard deviation ${formatStat(columnStats.standardDeviation)}. ` +
        `${columnStats.zeroCount} value${columnStats.zeroCount === 1 ? '' : 's'} equal zero and ` +
        `${columnStats.negativeCount} ${columnStats.negativeCount === 1 ? 'is' : 'are'} negative. ` +
        `The mean and the median differ by ${formatStat(Math.abs(columnStats.mean - columnStats.median))}; a large gap between ` +
        `them usually means the distribution is skewed by a small number of large values.`,
      columns: [profile.name],
      rows: [],
      method: 'Descriptive statistics computed over the values that parsed as numbers. Quantiles use linear interpolation.',
      nextStep: 'Use these figures as a sanity check against published totals or an independent source.',
      uncertainty: 'Statistics describe the file as supplied. They say nothing about whether the underlying figures are correct.',
      evidence: { ...columnStats },
    })

    // 3. Negative values.
    if (columnStats.negativeCount > 0) {
      const negativeRows: number[] = []
      values.forEach((raw, index) => {
        const n = parseNumber(raw)
        if (n !== null && n < 0) negativeRows.push(index + 1)
      })
      const { rows } = capRows(negativeRows)
      findings.push({
        id: `numeric-negative-${profile.name}`,
        category: 'numeric',
        severity: 'info',
        title: `${columnStats.negativeCount} negative value${columnStats.negativeCount === 1 ? '' : 's'} in "${profile.name}"`,
        explanation:
          `"${profile.name}" contains ${columnStats.negativeCount} negative value${columnStats.negativeCount === 1 ? '' : 's'} ` +
          `(minimum ${formatStat(columnStats.min)}). Negative values are legitimate for many measures — deficits, adjustments, ` +
          `refunds, net changes — but are suspicious in measures that cannot logically go below zero, such as a population ` +
          `count or an expenditure total.`,
        columns: [profile.name],
        rows,
        method: 'Values below zero after numeric parsing.',
        nextStep:
          'Confirm whether this measure can legitimately be negative. If it cannot, add a "must be greater than or equal to ' +
          'zero" validation rule to flag violations in this and future versions.',
        uncertainty: 'DataProof does not know what this column measures and therefore cannot decide whether a negative value is wrong.',
        evidence: { column: profile.name, negativeCount: columnStats.negativeCount, minimum: columnStats.min },
      })
    }

    // 4. Zeros are data, not blanks.
    if (columnStats.zeroCount > 0) {
      findings.push({
        id: `numeric-zeros-${profile.name}`,
        category: 'numeric',
        severity: 'info',
        title: `"${profile.name}" contains ${columnStats.zeroCount} zero value${columnStats.zeroCount === 1 ? '' : 's'}`,
        explanation:
          `${columnStats.zeroCount} cell${columnStats.zeroCount === 1 ? '' : 's'} in "${profile.name}" record a value of zero. ` +
          `Zero is treated throughout DataProof as a recorded value, not as missing data, so these rows are included in every ` +
          `total and average. A zero can mean "nothing was recorded for this period", "the amount was nil", or a placeholder; ` +
          `only the source can tell you which.`,
        columns: [profile.name],
        rows: [],
        method: 'Cells whose numeric value is exactly zero.',
        nextStep: 'If a zero means "no data" rather than "nil" in this dataset, say so in the published methodology.',
        uncertainty: 'Zero is never reported as a missing value anywhere in DataProof.',
        evidence: { column: profile.name, zeroCount: columnStats.zeroCount },
      })
    }

    // 5. Outliers.
    const outlierRows: number[] = []
    const outlierExamples: { row: number; value: number }[] = []
    values.forEach((raw, index) => {
      const n = parseNumber(raw)
      if (n === null) return
      if (n < columnStats.lowerFence || n > columnStats.upperFence) {
        outlierRows.push(index + 1)
        if (outlierExamples.length < 20) outlierExamples.push({ row: index + 1, value: n })
      }
    })

    if (outlierRows.length > 0) {
      const { rows, truncated, total } = capRows(outlierRows)
      const methodText =
        settings.outlierMethod === 'iqr'
          ? `Tukey's IQR rule with a fence multiplier of ${settings.outlierThreshold}. The 25th and 75th percentiles are ` +
            `${formatStat(columnStats.q1)} and ${formatStat(columnStats.q3)}, so the interquartile range is ${formatStat(columnStats.iqr)} ` +
            `and values outside ${formatStat(columnStats.lowerFence)} to ${formatStat(columnStats.upperFence)} are flagged.`
          : `Z-score method with a threshold of ${settings.outlierThreshold} standard deviations from the mean ` +
            `(mean ${formatStat(columnStats.mean)}, standard deviation ${formatStat(columnStats.standardDeviation)}).`

      findings.push({
        id: `numeric-outliers-${profile.name}`,
        category: 'numeric',
        severity: 'warning',
        title: `${outlierRows.length} potential outlier${outlierRows.length === 1 ? '' : 's'} in "${profile.name}"`,
        explanation:
          `Using ${settings.outlierMethod === 'iqr' ? "Tukey's interquartile range rule" : 'the z-score method'}, ` +
          `${outlierRows.length} value${outlierRows.length === 1 ? '' : 's'} in "${profile.name}" fall outside the expected range. ` +
          `For example, row ${outlierExamples[0].row} holds ${formatStat(outlierExamples[0].value)}. ` +
          `An outlier is a value that is far from the rest of the distribution. It is often the most newsworthy number in a ` +
          `dataset — and it is sometimes a typo with an extra zero. It is not automatically an error.`,
        columns: [profile.name],
        rows,
        method: methodText,
        nextStep:
          'Inspect each flagged record and check the value against the source document. If the figure is genuine, keep it and ' +
          'consider explaining it in the story. If it is a keying error, report it to the data provider.',
        uncertainty:
          'Statistical outliers are defined relative to this dataset only. The method assumes nothing about the distribution ' +
          'and has no way to know whether an extreme value is correct. A value is never labelled incorrect because it is unusual.',
        evidence: {
          column: profile.name,
          method: settings.outlierMethod,
          threshold: settings.outlierThreshold,
          outlierCount: outlierRows.length,
          extremeOutlierCount: columnStats.extremeOutlierCount,
          lowerFence: columnStats.lowerFence,
          upperFence: columnStats.upperFence,
          q1: columnStats.q1,
          q3: columnStats.q3,
          iqr: columnStats.iqr,
          mean: columnStats.mean,
          standardDeviation: columnStats.standardDeviation,
          examples: outlierExamples,
          rowsTruncated: truncated,
          affectedRowTotal: total,
        },
      })
    }
  }

  return findings
}

function formatStat(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value)
}
