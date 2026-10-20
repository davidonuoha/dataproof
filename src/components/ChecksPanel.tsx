import { RULE_LABELS, type CrossFieldRule, type OutlierMethod, type RuleKind, type ValidationRule } from '../lib/types'
import { useSession } from '../state/session'
import { Callout } from './ui'

function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${random}`
}

/**
 * The analysis settings screen: what counts as a duplicate, how outliers are
 * detected, and the rules the journalist wants enforced.
 */
export function ChecksPanel() {
  const {
    dataset,
    settings,
    settingsDirty,
    runChecks,
    setDuplicateKeyColumns,
    setOutlierMethod,
    setRules,
    setCrossFieldRules,
    status,
  } = useSession()

  if (!dataset) return null
  const headers = dataset.table.headers
  const numericColumns = dataset.profiles.filter((p) => p.type === 'number').map((p) => p.name)
  const running = status === 'analyzing'

  const toggleDuplicateKey = (column: string) => {
    const next = settings.duplicateKeyColumns.includes(column)
      ? settings.duplicateKeyColumns.filter((c) => c !== column)
      : [...settings.duplicateKeyColumns, column]
    setDuplicateKeyColumns(next)
  }

  const updateRule = (id: string, patch: Partial<ValidationRule>) => {
    setRules(settings.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)))
  }

  const addRule = () => {
    setRules([
      ...settings.rules,
      {
        id: newId('rule'),
        kind: 'required',
        column: headers[0] ?? '',
        enabled: true,
        ignoreEmpty: true,
      },
    ])
  }

  const addCrossFieldRule = () => {
    setCrossFieldRules([
      ...settings.crossFieldRules,
      {
        id: newId('xfield'),
        label: '',
        components: numericColumns.slice(0, 1),
        total: numericColumns[1] ?? '',
        tolerance: 0,
        toleranceMode: 'absolute',
        ignoreEmpty: true,
        enabled: true,
      },
    ])
  }

  const updateCrossField = (id: string, patch: Partial<CrossFieldRule>) => {
    setCrossFieldRules(settings.crossFieldRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)))
  }

  return (
    <div>
      {settingsDirty ? (
        <Callout tone="warning" title="Settings have changed since the last run">
          <p style={{ marginBottom: 0 }}>
            The results currently shown were produced with the previous settings. Run the checks again to update them.
          </p>
        </Callout>
      ) : null}

      <div className="row between" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>Checks and rules</h2>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Configure what DataProof should look for, then run the checks.
          </p>
        </div>
        <button type="button" className="primary" onClick={runChecks} disabled={running}>
          {running ? 'Running checks…' : 'Run checks'}
        </button>
      </div>

      <div className="card">
        <h3>Duplicate matching key</h3>
        <p className="small muted">
          Select the columns that together identify a record. Rows that share the same values in these columns are
          reported as potential duplicates. Leave all unchecked to compare entire rows only.
        </p>
        <div className="scroll-box" role="group" aria-label="Duplicate matching columns">
          {headers.map((header) => (
            <label className="checkline" key={header}>
              <input
                type="checkbox"
                checked={settings.duplicateKeyColumns.includes(header)}
                onChange={() => toggleDuplicateKey(header)}
              />
              <span className="mono">{header}</span>
            </label>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
          {settings.duplicateKeyColumns.length === 0
            ? 'No key selected: only rows that are identical in every column will be grouped.'
            : `Key: ${settings.duplicateKeyColumns.join(' + ')}`}
        </p>
      </div>

      <div className="card">
        <h3>Outlier detection</h3>
        <p className="small muted">
          Outliers are reported as observations to investigate, never as errors. The method and its limitations are
          recorded in every export.
        </p>
        <div className="field-grid">
          <div>
            <label htmlFor="outlier-method">Method</label>
            <select
              id="outlier-method"
              value={settings.outlierMethod}
              onChange={(event) =>
                setOutlierMethod(event.target.value as OutlierMethod, settings.outlierThreshold)
              }
            >
              <option value="iqr">Interquartile range (Tukey's rule)</option>
              <option value="zscore">Z-score (standard deviations from the mean)</option>
            </select>
            <p className="tiny muted" style={{ marginTop: 4, marginBottom: 0 }}>
              {settings.outlierMethod === 'iqr'
                ? 'Makes no assumption about the distribution; based on the 25th and 75th percentiles.'
                : 'Assumes a roughly symmetric distribution and is sensitive to extreme values.'}
            </p>
          </div>
          <div>
            <label htmlFor="outlier-threshold">
              {settings.outlierMethod === 'iqr' ? 'Fence multiplier (k)' : 'Z-score threshold'}
            </label>
            <input
              id="outlier-threshold"
              type="number"
              min={0.1}
              step={0.1}
              value={settings.outlierThreshold}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (Number.isFinite(value) && value > 0) setOutlierMethod(settings.outlierMethod, value)
              }}
            />
            <p className="tiny muted" style={{ marginTop: 4, marginBottom: 0 }}>
              {settings.outlierMethod === 'iqr'
                ? '1.5 is the conventional value. 3.0 flags only the most extreme values.'
                : '3.0 is the conventional value.'}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row between">
          <h3 style={{ marginBottom: 0 }}>Validation rules</h3>
          <button type="button" onClick={addRule} disabled={headers.length === 0}>
            Add rule
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Rules you define are the only findings DataProof reports as errors, because the expectation came from you.
        </p>

        {settings.rules.length === 0 ? (
          <p className="muted small">No rules defined. The checks still report missing values, duplicates and anomalies.</p>
        ) : null}

        {settings.rules.map((rule, index) => (
          <fieldset key={rule.id}>
            <legend>Rule {index + 1}</legend>
            <div className="field-grid">
              <div>
                <label htmlFor={`rule-kind-${rule.id}`}>Rule type</label>
                <select
                  id={`rule-kind-${rule.id}`}
                  value={rule.kind}
                  onChange={(event) => updateRule(rule.id, { kind: event.target.value as RuleKind })}
                >
                  {(Object.keys(RULE_LABELS) as RuleKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {RULE_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`rule-column-${rule.id}`}>Column</label>
                <select
                  id={`rule-column-${rule.id}`}
                  value={rule.column}
                  onChange={(event) => updateRule(rule.id, { column: event.target.value })}
                >
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
              {rule.kind === 'range' ? (
                <>
                  <div>
                    <label htmlFor={`rule-min-${rule.id}`}>Minimum</label>
                    <input
                      id={`rule-min-${rule.id}`}
                      type="number"
                      value={rule.min ?? ''}
                      onChange={(event) =>
                        updateRule(rule.id, { min: event.target.value === '' ? undefined : Number(event.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor={`rule-max-${rule.id}`}>Maximum</label>
                    <input
                      id={`rule-max-${rule.id}`}
                      type="number"
                      value={rule.max ?? ''}
                      onChange={(event) =>
                        updateRule(rule.id, { max: event.target.value === '' ? undefined : Number(event.target.value) })
                      }
                    />
                  </div>
                </>
              ) : null}
              {rule.kind === 'allowed' ? (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor={`rule-allowed-${rule.id}`}>Permitted values (comma separated)</label>
                  <input
                    id={`rule-allowed-${rule.id}`}
                    type="text"
                    style={{ width: '100%' }}
                    value={(rule.allowed ?? []).join(', ')}
                    onChange={(event) =>
                      updateRule(rule.id, {
                        allowed: event.target.value
                          .split(',')
                          .map((v) => v.trim())
                          .filter((v) => v !== ''),
                      })
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="row between" style={{ marginTop: 10 }}>
              <div>
                {rule.kind === 'range' || rule.kind === 'nonnegative' ? (
                  <label className="checkline">
                    <input
                      type="checkbox"
                      checked={rule.ignoreEmpty ?? true}
                      onChange={(event) => updateRule(rule.id, { ignoreEmpty: event.target.checked })}
                    />
                    <span>Ignore empty cells (covered by a separate “must not be empty” rule)</span>
                  </label>
                ) : null}
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}
                  />
                  <span>Rule enabled</span>
                </label>
              </div>
              <button
                type="button"
                className="danger small"
                onClick={() => setRules(settings.rules.filter((r) => r.id !== rule.id))}
              >
                Remove rule
              </button>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="card">
        <div className="row between">
          <h3 style={{ marginBottom: 0 }}>Cross-field comparisons</h3>
          <button type="button" onClick={addCrossFieldRule} disabled={numericColumns.length < 2}>
            Add comparison
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Compare the sum of some columns with another column. DataProof only checks a relationship you state here; it
          never assumes one. {numericColumns.length < 2 ? 'At least two numeric columns are needed.' : ''}
        </p>

        {settings.crossFieldRules.length === 0 ? (
          <p className="muted small">No comparisons defined.</p>
        ) : null}

        {settings.crossFieldRules.map((rule, index) => (
          <fieldset key={rule.id}>
            <legend>Comparison {index + 1}</legend>
            <p className="small mono" style={{ marginTop: 0 }}>
              {rule.components.length > 0 && rule.total
                ? `${rule.components.join(' + ')} = ${rule.total} (±${rule.tolerance}${rule.toleranceMode === 'percent' ? '%' : ''})`
                : 'Select the columns to compare'}
            </p>
            <div className="field-grid">
              <div>
                <label htmlFor={`xfield-components-${rule.id}`}>Component columns (summed)</label>
                <select
                  id={`xfield-components-${rule.id}`}
                  multiple
                  size={Math.min(6, Math.max(3, numericColumns.length))}
                  value={rule.components}
                  onChange={(event) =>
                    updateCrossField(rule.id, {
                      components: Array.from(event.target.selectedOptions).map((o) => o.value),
                    })
                  }
                >
                  {numericColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
                <p className="tiny muted" style={{ marginTop: 3, marginBottom: 0 }}>
                  Hold Ctrl (or Cmd) to select more than one column.
                </p>
              </div>
              <div>
                <label htmlFor={`xfield-total-${rule.id}`}>Compared with (total column)</label>
                <select
                  id={`xfield-total-${rule.id}`}
                  value={rule.total}
                  onChange={(event) => updateCrossField(rule.id, { total: event.target.value })}
                >
                  <option value="">Choose a column…</option>
                  {numericColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`xfield-tolerance-${rule.id}`}>Tolerance</label>
                <input
                  id={`xfield-tolerance-${rule.id}`}
                  type="number"
                  min={0}
                  step="any"
                  value={rule.tolerance}
                  onChange={(event) => updateCrossField(rule.id, { tolerance: Number(event.target.value) || 0 })}
                />
              </div>
              <div>
                <label htmlFor={`xfield-mode-${rule.id}`}>Tolerance is</label>
                <select
                  id={`xfield-mode-${rule.id}`}
                  value={rule.toleranceMode}
                  onChange={(event) =>
                    updateCrossField(rule.id, { toleranceMode: event.target.value as 'absolute' | 'percent' })
                  }
                >
                  <option value="absolute">Absolute units</option>
                  <option value="percent">Percentage of the component sum</option>
                </select>
              </div>
            </div>

            <div className="row between" style={{ marginTop: 10 }}>
              <div>
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={rule.ignoreEmpty}
                    onChange={(event) => updateCrossField(rule.id, { ignoreEmpty: event.target.checked })}
                  />
                  <span>Skip rows where any involved cell is empty</span>
                </label>
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => updateCrossField(rule.id, { enabled: event.target.checked })}
                  />
                  <span>Comparison enabled</span>
                </label>
              </div>
              <button
                type="button"
                className="danger small"
                onClick={() => setCrossFieldRules(settings.crossFieldRules.filter((r) => r.id !== rule.id))}
              >
                Remove comparison
              </button>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="row">
        <button type="button" className="primary" onClick={runChecks} disabled={running}>
          {running ? 'Running checks…' : 'Run checks'}
        </button>
        {settingsDirty ? <span className="small muted">Settings changed — results are out of date.</span> : null}
      </div>
    </div>
  )
}
