import { test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Captures the screenshots used in the README and the documentation.
 *
 * These images are produced from the running application, so they always show
 * the real interface rather than a mock-up.
 *
 * Run with:  npx playwright test e2e/screenshots.spec.ts
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(here, '..', 'docs', 'screenshots')

test.use({ viewport: { width: 1440, height: 950 } })

test('capture the interface', async ({ page }) => {
  const shot = async (name: string, fullPage = false) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage })
  }

  await page.goto('/')
  await page.waitForTimeout(400)
  await shot('01-dashboard')

  await page.goto('/#/analyze')
  await page.waitForTimeout(300)
  await shot('02-import')

  const card = page.locator('.card', {
    has: page.getByRole('heading', { level: 3, name: /Government expenditure \(fictional\)/ }),
  })
  await card.getByRole('button', { name: 'Load sample' }).click()
  await page.waitForSelector('h1:has-text("government-expenditure.csv")')
  await page.waitForTimeout(400)
  await shot('03-dataset-overview', true)

  await page.getByRole('tab', { name: /Columns/ }).click()
  await page.waitForTimeout(300)
  await shot('04-column-types', true)

  await page.getByRole('tab', { name: /Checks & rules/ }).click()
  await page.waitForTimeout(300)
  await shot('05-checks-and-rules', true)

  await page.getByRole('tab', { name: /Findings/ }).click()
  await page.waitForTimeout(400)
  await shot('06-findings', true)

  await page.getByRole('button', { name: /^Inspect \d+ records?$/ }).first().click()
  await page.waitForTimeout(400)
  await shot('07-record-inspector')

  await page.goto('/#/compare')
  await page.getByRole('button', { name: /Load the two fictional expenditure releases/ }).click()
  await page.waitForTimeout(600)
  await page.getByLabel('Department').check()
  await page.getByLabel('Financial Year').check()
  await page.getByRole('button', { name: 'Compare datasets', exact: true }).click()
  await page.waitForSelector('h2:has-text("Comparison result")')
  await page.waitForTimeout(500)
  await shot('08-comparison', true)

  await page.getByRole('button', { name: 'Reports' }).click()
  await page.waitForTimeout(400)
  await shot('09-reports', true)

  await page.getByRole('button', { name: 'About DataProof' }).click()
  await page.waitForTimeout(300)
  await shot('10-about', true)

  // A mobile viewport, to show that the layout is responsive.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/analyze')
  await page.waitForTimeout(500)
  await shot('11-mobile-analyze')
})
