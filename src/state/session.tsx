import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { runAnalysis } from '../lib/analyze'
import { MAX_FILE_BYTES, formatBytes } from '../lib/csv'
import { parseInWorker, yieldToBrowser } from '../lib/parseClient'
import { buildColumnProfiles, suggestDateFormats } from '../lib/profile'
import type {
  AnalysisResult,
  AnalysisSettings,
  ColumnProfile,
  ColumnType,
  ComparisonResult,
  DateFormatId,
  ParsedTable,
} from '../lib/types'
import { defaultSettings } from '../lib/types'
import { compareDatasets } from '../lib/compare'
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from '../lib/report/json'

export type Status = 'idle' | 'parsing' | 'analyzing' | 'ready' | 'error'

export interface DatasetState {
  table: ParsedTable
  profiles: ColumnProfile[]
  overrides: Record<string, ColumnType>
}

interface SessionValue {
  status: Status
  progressLabel: string
  error: string | null

  dataset: DatasetState | null
  settings: AnalysisSettings
  analysis: AnalysisResult | null
  settingsDirty: boolean

  comparison: ComparisonResult | null
  comparisonSides: { older: ParsedTable | null; newer: ParsedTable | null }
  comparisonBusy: boolean

  exportOptions: ExportOptions

  importFile: (file: File, options?: { hasHeader?: boolean; delimiter?: string }) => Promise<void>
  importText: (text: string, fileName: string, fileSize: number, options?: { hasHeader?: boolean; delimiter?: string }) => Promise<void>
  reparseWithHeader: (hasHeader: boolean) => Promise<void>

  setColumnType: (column: string, type: ColumnType) => void
  setDateFormat: (column: string, format: DateFormatId, source: 'auto' | 'user') => void
  setDuplicateKeyColumns: (columns: string[]) => void
  setOutlierMethod: (method: AnalysisSettings['outlierMethod'], threshold: number) => void
  setRules: (rules: AnalysisSettings['rules']) => void
  setCrossFieldRules: (rules: AnalysisSettings['crossFieldRules']) => void
  runChecks: () => void

  loadComparisonSide: (side: 'older' | 'newer', text: string, fileName: string, fileSize: number) => Promise<void>
  runComparison: (keyColumns: string[]) => void
  clearComparison: () => void

  setExportOptions: (options: ExportOptions) => void
  clearSession: () => void
  dismissError: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('idle')
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [dataset, setDataset] = useState<DatasetState | null>(null)
  const [settings, setSettings] = useState<AnalysisSettings>(defaultSettings)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [settingsDirty, setSettingsDirty] = useState(false)

  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [comparisonBusy, setComparisonBusy] = useState(false)
  const [comparisonSides, setComparisonSides] = useState<{ older: ParsedTable | null; newer: ParsedTable | null }>({
    older: null,
    newer: null,
  })

  const [exportOptions, setExportOptionsState] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS)

  const lastParseOptions = useRef<{ hasHeader?: boolean; delimiter?: string; fileName: string; text: string; fileSize: number } | null>(null)

  /** Build profiles, detect date formats, and run the checks. */
  const finishImport = useCallback(
    async (table: ParsedTable, parseOptions: { hasHeader?: boolean; delimiter?: string }, rawText: string, fileSize: number) => {
      lastParseOptions.current = {
        ...parseOptions,
        fileName: table.fileName,
        text: rawText,
        fileSize,
      }

      setProgressLabel('Profiling columns…')
      await yieldToBrowser()
      const profiles = buildColumnProfiles(table)
      const detectedFormats = suggestDateFormats(table, profiles)

      const nextSettings: AnalysisSettings = {
        ...defaultSettings(),
        dateFormats: detectedFormats as Record<string, DateFormatId>,
        dateFormatSource: Object.fromEntries(Object.keys(detectedFormats).map((k) => [k, 'auto' as const])),
      }

      setProgressLabel('Running quality checks…')
      await yieldToBrowser()
      const result = runAnalysis({ table, profiles, settings: nextSettings })

      setDataset({ table, profiles, overrides: {} })
      setSettings(nextSettings)
      setAnalysis(result)
      setSettingsDirty(false)
      setStatus('ready')
      setProgressLabel('')
    },
    [],
  )

  const importText = useCallback(
    async (text: string, fileName: string, fileSize: number, options: { hasHeader?: boolean; delimiter?: string } = {}) => {
      setStatus('parsing')
      setError(null)
      setProgressLabel('Reading and parsing the file…')
      await yieldToBrowser()

      try {
        const table = await parseInWorker(text, fileName, fileSize, {
          hasHeader: options.hasHeader,
          delimiter: options.delimiter,
        })

        if (table.headers.length === 0 && table.rows.length === 0) {
          setStatus('error')
          setError(
            'No columns could be read from this file. It may be empty, or it may not be a CSV file. ' +
              'DataProof reads CSV text files only — it does not read Excel workbooks, PDFs or images.',
          )
          setProgressLabel('')
          return
        }

        await finishImport(table, options, text, fileSize)
      } catch (err) {
        setStatus('error')
        setError(
          `The file could not be read: ${err instanceof Error ? err.message : String(err)}. ` +
            'Check that it is a UTF-8 CSV file and try again.',
        )
        setProgressLabel('')
      }
    },
    [finishImport],
  )

  const importFile = useCallback(
    async (file: File, options: { hasHeader?: boolean; delimiter?: string } = {}) => {
      if (file.size > MAX_FILE_BYTES) {
        setStatus('error')
        setError(
          `"${file.name}" is ${formatBytes(file.size)}, which is larger than the ${formatBytes(MAX_FILE_BYTES)} limit for ` +
            'in-browser processing. Split the file into smaller extracts and analyse them separately. ' +
            'DataProof does not upload files to a server, so there is no server-side fallback.',
        )
        return
      }
      if (file.size === 0) {
        setStatus('error')
        setError(`"${file.name}" is empty (0 bytes).`)
        return
      }

      let text: string
      try {
        text = await file.text()
      } catch {
        setStatus('error')
        setError(`"${file.name}" could not be read from disk. Check the file permissions and try again.`)
        return
      }
      await importText(text, file.name, file.size, options)
    },
    [importText],
  )

  const reparseWithHeader = useCallback(
    async (hasHeader: boolean) => {
      const previous = lastParseOptions.current
      if (!previous) return
      await importText(previous.text, previous.fileName, previous.fileSize, {
        hasHeader,
        delimiter: previous.delimiter,
      })
    },
    [importText],
  )

  const markDirty = useCallback(() => setSettingsDirty(true), [])

  const setColumnType = useCallback(
    (column: string, type: ColumnType) => {
      setDataset((current) => {
        if (!current) return current
        const overrides = { ...current.overrides, [column]: type }
        return { ...current, overrides, profiles: buildColumnProfiles(current.table, overrides) }
      })
      markDirty()
    },
    [markDirty],
  )

  const setDateFormat = useCallback(
    (column: string, format: DateFormatId, source: 'auto' | 'user') => {
      setSettings((current) => ({
        ...current,
        dateFormats: { ...current.dateFormats, [column]: format },
        dateFormatSource: { ...current.dateFormatSource, [column]: source },
      }))
      markDirty()
    },
    [markDirty],
  )

  const setDuplicateKeyColumns = useCallback(
    (columns: string[]) => {
      setSettings((current) => ({ ...current, duplicateKeyColumns: columns }))
      markDirty()
    },
    [markDirty],
  )

  const setOutlierMethod = useCallback(
    (method: AnalysisSettings['outlierMethod'], threshold: number) => {
      setSettings((current) => ({ ...current, outlierMethod: method, outlierThreshold: threshold }))
      markDirty()
    },
    [markDirty],
  )

  const setRules = useCallback(
    (rules: AnalysisSettings['rules']) => {
      setSettings((current) => ({ ...current, rules }))
      markDirty()
    },
    [markDirty],
  )

  const setCrossFieldRules = useCallback(
    (rules: AnalysisSettings['crossFieldRules']) => {
      setSettings((current) => ({ ...current, crossFieldRules: rules }))
      markDirty()
    },
    [markDirty],
  )

  const runChecks = useCallback(() => {
    if (!dataset) return
    setStatus('analyzing')
    setProgressLabel('Running quality checks…')
    // Let the loading state paint, then run the checks synchronously.
    setTimeout(() => {
      try {
        const result = runAnalysis({ table: dataset.table, profiles: dataset.profiles, settings })
        setAnalysis(result)
        setSettingsDirty(false)
        setStatus('ready')
      } catch (err) {
        setStatus('error')
        setError(`The checks could not be completed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setProgressLabel('')
      }
    }, 0)
  }, [dataset, settings])

  const loadComparisonSide = useCallback(
    async (side: 'older' | 'newer', text: string, fileName: string, fileSize: number) => {
      setComparisonBusy(true)
      setError(null)
      try {
        const table = await parseInWorker(text, fileName, fileSize, {})
        setComparisonSides((current) => ({ ...current, [side]: table }))
      } catch (err) {
        setError(`"${fileName}" could not be read: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setComparisonBusy(false)
      }
    },
    [],
  )

  const runComparison = useCallback(
    (keyColumns: string[]) => {
      const { older, newer } = comparisonSides
      if (!older || !newer) return
      setComparisonBusy(true)
      setTimeout(() => {
        try {
          const result = compareDatasets(older, newer, keyColumns)
          setComparison(result)
        } catch (err) {
          setError(`The comparison could not be completed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          setComparisonBusy(false)
        }
      }, 0)
    },
    [comparisonSides],
  )

  const clearComparison = useCallback(() => {
    setComparison(null)
    setComparisonSides({ older: null, newer: null })
  }, [])

  const setExportOptions = useCallback((options: ExportOptions) => setExportOptionsState(options), [])

  const clearSession = useCallback(() => {
    setDataset(null)
    setAnalysis(null)
    setSettings(defaultSettings())
    setSettingsDirty(false)
    setStatus('idle')
    setError(null)
    setProgressLabel('')
    lastParseOptions.current = null
    setComparison(null)
    setComparisonSides({ older: null, newer: null })
  }, [])

  const dismissError = useCallback(() => setError(null), [])

  const value: SessionValue = {
    status,
    progressLabel,
    error,
    dataset,
    settings,
    analysis,
    settingsDirty,
    comparison,
    comparisonSides,
    comparisonBusy,
    exportOptions,
    importFile,
    importText,
    reparseWithHeader,
    setColumnType,
    setDateFormat,
    setDuplicateKeyColumns,
    setOutlierMethod,
    setRules,
    setCrossFieldRules,
    runChecks,
    loadComparisonSide,
    runComparison,
    clearComparison,
    setExportOptions,
    clearSession,
    dismissError,
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
