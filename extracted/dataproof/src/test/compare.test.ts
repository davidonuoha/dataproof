import { describe, expect, it } from 'vitest'
import { compareDatasets } from '../lib/compare'
import { parseCsvText } from '../lib/csv'

const parse = (csv: string, name: string) => parseCsvText(csv, name, csv.length, {})

const OLDER = parse(
  `id,department,amount,note
1,Water,100,first
2,Health,200,
3,Transport,300,third
4,Defence,400,fourth
`,
  'older.csv',
)

const NEWER = parse(
  `id,department,amount,note
1,Water,150,first
2,Health,200,
3,Transport,300,third revised
5,Education,500,new
`,
  'newer.csv',
)

describe('dataset comparison with an identifier', () => {
  const result = compareDatasets(OLDER, NEWER, ['id'])

  it('matches records by the selected identifier', () => {
    expect(result.alignment).toBe('key')
    expect(result.keyColumns).toEqual(['id'])
  })

  it('identifies added records', () => {
    const added = result.records.filter((r) => r.kind === 'added')
    expect(added).toHaveLength(1)
    expect(added[0].key).toBe('5')
    expect(added[0].newRow).toBe(4)
    expect(result.counts.added).toBe(1)
  })

  it('identifies removed records', () => {
    const removed = result.records.filter((r) => r.kind === 'removed')
    expect(removed).toHaveLength(1)
    expect(removed[0].key).toBe('4')
    expect(removed[0].oldRow).toBe(4)
    expect(result.counts.removed).toBe(1)
  })

  it('identifies changed records with before-and-after values', () => {
    const changed = result.records.filter((r) => r.kind === 'changed')
    expect(changed).toHaveLength(2)
    const water = changed.find((r) => r.key === '1')
    expect(water?.changes).toEqual([{ column: 'amount', before: '100', after: '150' }])
    const transport = changed.find((r) => r.key === '3')
    expect(transport?.changes).toEqual([{ column: 'note', before: 'third', after: 'third revised' }])
    expect(result.counts.changed).toBe(2)
  })

  it('identifies unchanged records', () => {
    expect(result.counts.unchanged).toBe(1)
  })

  it('does not assume that row positions correspond', () => {
    // Row 4 of the older file (id 4) was removed and a new record was appended,
    // so a positional comparison would report every later row as changed.
    const positional = compareDatasets(OLDER, NEWER, [])
    expect(positional.alignment).toBe('row-position')
    expect(positional.counts.changed).toBeGreaterThan(result.counts.changed)
    expect(positional.limitations.join(' ')).toMatch(/position/i)
  })

  it('reports structural changes to columns', () => {
    const retyped = parse('id,amount\n1,100\n', 'a.csv')
    const retyped2 = parse('id,amount,extra\n1,100,x\n', 'b.csv')
    const structural = compareDatasets(retyped, retyped2, ['id'])
    expect(structural.columnChanges).toContainEqual({ name: 'extra', change: 'added' })

    const removedColumn = compareDatasets(retyped2, retyped, ['id'])
    expect(removedColumn.columnChanges).toContainEqual({ name: 'extra', change: 'removed' })
  })

  it('reports a column whose inferred type changed', () => {
    const before = parse('id,value\n1,10\n', 'a.csv')
    const after = parse('id,value\n1,ten\n', 'b.csv')
    const result = compareDatasets(before, after, ['id'])
    expect(result.columnChanges).toContainEqual({
      name: 'value',
      change: 'type-changed',
      previousType: 'number',
      newType: 'text',
    })
  })

  it('warns when the identifier is not unique', () => {
    const dupOld = parse('id,v\n1,a\n1,b\n', 'a.csv')
    const dupNew = parse('id,v\n1,a\n', 'b.csv')
    const result = compareDatasets(dupOld, dupNew, ['id'])
    expect(result.findings.some((f) => f.id === 'comparison-duplicate-key')).toBe(true)
    expect(result.limitations.join(' ')).toMatch(/not unique/i)
  })

  it('reports identical datasets as having no differences', () => {
    const result = compareDatasets(OLDER, OLDER, ['id'])
    expect(result.counts.added).toBe(0)
    expect(result.counts.removed).toBe(0)
    expect(result.counts.changed).toBe(0)
    expect(result.findings.some((f) => f.id === 'comparison-identical')).toBe(true)
  })

  it('produces findings that explain what they do not establish', () => {
    for (const finding of result.findings) {
      expect(finding.explanation.length).toBeGreaterThan(0)
      expect(finding.method.length).toBeGreaterThan(0)
    }
  })
})

describe('dataset comparison without an identifier', () => {
  it('explains the limitation of positional matching', () => {
    const result = compareDatasets(OLDER, NEWER, [])
    expect(result.findings.some((f) => f.id === 'comparison-no-key')).toBe(true)
    expect(result.limitations.some((l) => l.includes('position'))).toBe(true)
  })

  it('ignores identifier columns that are missing from one dataset', () => {
    const result = compareDatasets(OLDER, NEWER, ['id', 'not-a-column'])
    expect(result.keyColumns).toEqual(['id'])
    expect(result.limitations.join(' ')).toMatch(/not-a-column/)
  })
})
