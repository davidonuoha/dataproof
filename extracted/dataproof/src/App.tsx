import { useEffect, useState } from 'react'
import { About } from './pages/About'
import { Analyze } from './pages/Analyze'
import { Compare } from './pages/Compare'
import { Dashboard } from './pages/Dashboard'
import { Reports } from './pages/Reports'
import { SessionProvider, useSession } from './state/session'

const PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'analyze', label: 'Analyze Dataset' },
  { id: 'compare', label: 'Compare Datasets' },
  { id: 'reports', label: 'Reports' },
  { id: 'about', label: 'About DataProof' },
] as const

type PageId = (typeof PAGES)[number]['id']

function pageFromHash(): PageId {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const match = PAGES.find((page) => page.id === raw)
  return match ? match.id : 'dashboard'
}

/** A small banner that reports any dataset still held in memory. */
function SessionIndicator() {
  const { dataset, analysis, clearSession } = useSession()
  if (!dataset) return null
  return (
    <div className="app-header-inner" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, paddingBottom: 8 }}>
      <span className="tiny muted">
        In memory: <strong>{dataset.table.fileName}</strong> · {dataset.table.rows.length.toLocaleString()} records ·{' '}
        {analysis?.findings.length ?? 0} findings · not saved to disk
      </span>
      <span className="spacer" />
      <button type="button" className="small" onClick={clearSession}>
        Clear session
      </button>
    </div>
  )
}

export function App() {
  const [page, setPage] = useState<PageId>(() => pageFromHash())

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (next: string) => {
    const target = (PAGES.find((p) => p.id === next)?.id ?? 'dashboard') as PageId
    window.location.hash = `#/${target}`
    setPage(target)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  return (
    <SessionProvider>
      <div className="app">
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <header className="app-header">
          <div className="app-header-inner">
            <button type="button" className="brand" onClick={() => navigate('dashboard')}>
              DataProof
              <small>data quality checks for journalists</small>
            </button>
            <nav className="nav" aria-label="Main">
              {PAGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={page === item.id ? 'page' : undefined}
                  onClick={() => navigate(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <SessionIndicator />
        </header>

        <main className="app-main" id="main">
          {page === 'dashboard' ? <Dashboard onNavigate={navigate} /> : null}
          {page === 'analyze' ? <Analyze /> : null}
          {page === 'compare' ? <Compare /> : null}
          {page === 'reports' ? <Reports onNavigate={navigate} /> : null}
          {page === 'about' ? <About /> : null}
        </main>

        <footer className="app-footer">
          <div className="app-footer-inner">
            <span>
              DataProof 0.1.0 · MIT licence · All processing happens in your browser; no dataset is uploaded or stored.
            </span>
            <span>
              DataProof checks internal consistency. It cannot verify that a figure is correct.
            </span>
          </div>
        </footer>
      </div>
    </SessionProvider>
  )
}
