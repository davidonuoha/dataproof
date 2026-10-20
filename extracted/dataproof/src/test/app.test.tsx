import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'

describe('application shell', () => {
  it('renders the dashboard with the main navigation', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /check a dataset before you publish it/i })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: /main/i })
    for (const label of ['Dashboard', 'Analyze Dataset', 'Compare Datasets', 'Reports', 'About DataProof']) {
      expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('explains that a report is not proof of accuracy', () => {
    render(<App />)
    expect(screen.getByText(/cannot confirm that a figure/i)).toBeInTheDocument()
  })

  it('navigates to the About page and documents the limits', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'About DataProof' }))
    expect(screen.getByRole('heading', { level: 1, name: /about dataproof/i })).toBeInTheDocument()
    expect(screen.getByText(/Validation is not verification/i)).toBeInTheDocument()
    expect(screen.getAllByText(/OpenRefine/).length).toBeGreaterThan(0)
  })

  it('shows an empty state on Reports before anything is analysed', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Reports' }))
    expect(screen.getByText(/nothing to export yet/i)).toBeInTheDocument()
  })
})

describe('sample dataset workflow', () => {
  it('imports a sample, profiles it and produces findings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Analyze Dataset' }))
    expect(screen.getByRole('heading', { level: 1, name: /analyze a dataset/i })).toBeInTheDocument()

    const sampleCard = screen.getByRole('heading', { level: 3, name: /Government expenditure \(fictional\)/i }).closest('.card')
    expect(sampleCard).not.toBeNull()
    await user.click(within(sampleCard as HTMLElement).getByRole('button', { name: /load sample/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'government-expenditure.csv' })).toBeInTheDocument(),
    )

    // Dimensions and the empty-cell count are shown as summary statistics.
    expect(screen.getByText('Records')).toBeInTheDocument()
    expect(screen.getAllByText('Columns').length).toBeGreaterThan(0)

    // The Findings tab carries a badge with the number of findings.
    const findingsTab = screen.getByRole('tab', { name: /findings/i })
    await user.click(findingsTab)
    expect(screen.getByRole('heading', { level: 2, name: 'Findings' })).toBeInTheDocument()
    expect(screen.getAllByText(/empty cell/i).length).toBeGreaterThan(0)
  })

  it('lets a finding be inspected, showing the affected records', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Analyze Dataset' }))
    const sampleCard = screen.getByRole('heading', { level: 3, name: /Government expenditure \(fictional\)/i }).closest('.card')
    await user.click(within(sampleCard as HTMLElement).getByRole('button', { name: /load sample/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'government-expenditure.csv' })).toBeInTheDocument(),
    )

    await user.click(screen.getByRole('tab', { name: /findings/i }))
    const inspectButtons = screen.getAllByRole('button', { name: /^Inspect \d+ records?$/ })
    await user.click(inspectButtons[0])
    expect(screen.getByText(/Affected records:/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /Records affected by/ })).toBeInTheDocument()
  })
})
