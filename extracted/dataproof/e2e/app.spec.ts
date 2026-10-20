import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(here, 'fixtures')

async function loadSample(page: import('@playwright/test').Page, name: RegExp) {
  await page.getByRole('button', { name: 'Analyze Dataset' }).click()
  const card = page.locator('.card', { has: page.getByRole('heading', { level: 3, name }) })
  await card.getByRole('button', { name: 'Load sample' }).click()
}

test('the dashboard explains the tool and offers a way in', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check a dataset')
  await expect(page.getByText('not proof that a dataset is accurate', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Analyze a dataset' })).toBeVisible()
})

test('a CSV file can be imported from disk and inspected', async ({ page }) => {
  await page.goto('/#/analyze')
  await page.setInputFiles('#dataset-file', path.join(FIXTURES, 'small-expenditure.csv'))

  await expect(page.getByRole('heading', { level: 1, name: 'small-expenditure.csv' })).toBeVisible()
  await expect(page.getByText('4 records · 4 columns', { exact: false })).toBeVisible()

  // The preview shows the records, and empty cells are marked as such.
  await expect(page.getByRole('table', { name: 'Dataset preview' })).toBeVisible()

  await page.getByRole('tab', { name: /Columns/ }).click()
  await expect(page.getByRole('table', { name: /Column profiles/ })).toBeVisible()
})

test('checks run on import and findings can be inspected', async ({ page }) => {
  await page.goto('/')
  await loadSample(page, /Government expenditure \(fictional\)/)

  await expect(page.getByRole('heading', { level: 1, name: 'government-expenditure.csv' })).toBeVisible()
  await page.getByRole('tab', { name: /Findings/ }).click()

  await expect(page.getByRole('heading', { level: 2, name: 'Findings' })).toBeVisible()
  await expect(page.getByText(/empty cell/i).first()).toBeVisible()
  await expect(page.getByText(/potential outlier/i).first()).toBeVisible()

  const inspect = page.getByRole('button', { name: /^Inspect \d+ records?$/ }).first()
  await inspect.click()
  await expect(page.getByText(/Affected records:/)).toBeVisible()
})

test('a user-defined rule produces an error finding', async ({ page }) => {
  await page.goto('/')
  await loadSample(page, /Government expenditure \(fictional\)/)
  await page.getByRole('tab', { name: /Checks & rules/ }).click()

  await page.getByRole('button', { name: 'Add rule' }).click()
  const rule = page.locator('fieldset').first()
  await rule.getByLabel('Rule type').selectOption('nonnegative')
  await rule.getByLabel('Column').selectOption('Actual Expenditure')
  await page.getByRole('button', { name: 'Run checks' }).first().click()

  await page.getByRole('tab', { name: /Findings/ }).click()
  await expect(page.getByText(/must be greater than or equal to zero/).first()).toBeVisible()
  await expect(page.locator('.badge.error').first()).toBeVisible()
})

test('two datasets can be compared by identifier', async ({ page }) => {
  await page.goto('/#/compare')
  await page.getByRole('button', { name: /Load the two fictional expenditure releases/ }).click()

  await expect(page.getByText('expenditure-2023.csv')).toBeVisible()
  await expect(page.getByText('expenditure-2024.csv')).toBeVisible()

  await page.getByLabel('Department').check()
  await page.getByLabel('Financial Year').check()
  await page.getByRole('button', { name: 'Compare datasets', exact: true }).click()

  await expect(page.getByRole('heading', { level: 2, name: 'Comparison result' })).toBeVisible()
  await expect(page.getByText('Records added')).toBeVisible()
  await expect(page.getByText('Records removed')).toBeVisible()
})

test('the JSON and HTML reports download', async ({ page }) => {
  await page.goto('/')
  await loadSample(page, /Public health statistics \(fictional\)/)
  await page.getByRole('button', { name: 'Reports' }).click()

  const jsonDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download JSON' }).click()
  const json = await jsonDownload
  expect(json.suggestedFilename()).toMatch(/^dataproof-report-.*\.json$/)

  const htmlDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download HTML' }).click()
  const html = await htmlDownload
  expect(html.suggestedFilename()).toMatch(/^dataproof-report-.*\.html$/)
})

test('the report contains no dataset values unless the user opts in', async ({ page }) => {
  await page.goto('/')
  await loadSample(page, /Public health statistics \(fictional\)/)
  await page.getByRole('button', { name: 'Reports' }).click()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download HTML' }).click()
  const file = await download
  const stream = await file.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString('utf8')

  expect(text).toContain('DataProof')
  expect(text).toContain('not proof that the data is accurate')
  // No affected-record table is rendered unless the user opts in.
  expect(text).not.toContain('Affected record values')
  // A region name appears only inside a record, never inside a finding
  // explanation, so it must not reach the report at all.
  expect(text).not.toContain('South South')
})

test('an unsupported or empty file produces a clear error', async ({ page }) => {
  await page.goto('/#/analyze')
  await page.setInputFiles('#dataset-file', path.join(FIXTURES, 'empty.csv'))
  await expect(page.getByText(/is empty \(0 bytes\)/)).toBeVisible()
})

test('the session can be cleared', async ({ page }) => {
  await page.goto('/')
  await loadSample(page, /Government expenditure \(fictional\)/)
  await expect(page.getByRole('heading', { level: 1, name: 'government-expenditure.csv' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear session' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Analyze a dataset' })).toBeVisible()
})
