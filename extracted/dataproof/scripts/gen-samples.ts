/**
 * Writes samples/*.csv from src/lib/sampleData.ts, which is the source of truth.
 *
 *   npx tsx scripts/gen-samples.ts
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SAMPLE_ELECTION_RESULTS,
  SAMPLE_EXPENDITURE_REVISED,
  SAMPLE_GOVERNMENT_EXPENDITURE,
  SAMPLE_PUBLIC_HEALTH,
} from '../src/lib/sampleData'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'samples')

const files: Array<[string, string]> = [
  ['government-expenditure-2023.csv', SAMPLE_GOVERNMENT_EXPENDITURE.csv],
  ['government-expenditure-revised.csv', SAMPLE_EXPENDITURE_REVISED.csv],
  ['election-results.csv', SAMPLE_ELECTION_RESULTS.csv],
  ['public-health.csv', SAMPLE_PUBLIC_HEALTH.csv],
]

for (const [name, csv] of files) {
  writeFileSync(path.join(outDir, name), csv)
  const rows = csv.split('\n').filter((line) => line.trim() !== '').length - 1
  console.log(`${name}: ${rows} data rows`)
}
