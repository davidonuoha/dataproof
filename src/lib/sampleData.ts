/**
 * Fictional sample datasets.
 *
 * Every value below is invented. The datasets exist so that a new user can see
 * DataProof's checks produce findings immediately, and so that the documented
 * issues can be used as regression fixtures.
 *
 * Each dataset declares exactly which problems were introduced deliberately.
 */

export interface SampleDataset {
  id: string
  name: string
  summary: string
  description: string
  csv: string
  /** Every issue deliberately built into the sample, for documentation and tests. */
  documentedIssues: string[]
}

export const SAMPLE_GOVERNMENT_EXPENDITURE: SampleDataset = {
  id: 'government-expenditure',
  name: 'Government expenditure (fictional)',
  summary: 'Departmental budget allocations and actual expenditure across two financial years.',
  description:
    'A fictional budget execution table for a national government. Columns: Department, Financial Year, ' +
    'Budget Allocation, Actual Expenditure. Contains empty cells, a repeated record, a negative figure, ' +
    'a value an order of magnitude above its peers, a department written in two different ways, and a row whose ' +
    'actual expenditure exceeds its allocation.',
  csv: `Department,Financial Year,Budget Allocation,Actual Expenditure
Water Resources,2022/2023,4500000000,4325000000
Education,2022/2023,8200000000,8060000000
Health,2022/2023,6100000000,6480000000
Transport,2022/2023,3750000000,3602000000
Agriculture,2022/2023,2100000000,
Education,2022/2023,8200000000,8060000000
Works and Housing,2022/2023,2980000000,2950000000
water resources,2022/2023,1200000000,1180000000
Defence,2022/2023,5400000000,5390000000
Health,2022/2023,1500000000,-25000000
Science and Technology,2022/2023,890000000,742000000
Water Resources,2023/2024,4800000000,4710000000
Education,2023/2024,9100000000,8950000000
Health,2023/2024,6800000000,7020000000
Transport,2023/2024,4100000000,3890000000
Agriculture,2023/2024,2400000000,2380000000
Works and Housing,2023/2024,3200000000,3105000000
Defence,2023/2024,5900000000,5870000000
Science and Technology,2023/2024,950000000,910000000
Environment,2023/2024,780000000,720000000
Water Resources,2023/2024,4800000000,4710000000
Health,2023/2024,,6650000000
Transport,2023/2024,4100000000,32500000000
Youth and Sports,2023/2024,640000000,598000000
`,
  documentedIssues: [
    'Row 5: Actual Expenditure is empty (missing value).',
    'Row 6: exact duplicate of row 3 (Education, 2022/2023).',
    'Row 9: "water resources" is lower case where other rows use "Water Resources" (inconsistent category).',
    'Row 10: Actual Expenditure is negative (-25,000,000).',
    'Row 15: actual expenditure (7,020,000,000) exceeds the budget allocation (6,800,000,000).',
    'Row 22: Budget Allocation is empty (missing value).',
    'Row 23: Actual Expenditure (32,500,000,000) is roughly eight times the allocation and far above every other transport figure (outlier). An extra digit is the likely explanation, but DataProof reports it for investigation rather than calling it wrong.',
    'Row 21: exact duplicate of row 13 (Water Resources, 2023/2024).',
  ],
}

export const SAMPLE_ELECTION_RESULTS: SampleDataset = {
  id: 'election-results',
  name: 'Election results (fictional)',
  summary: 'Votes recorded by candidate at fictional polling units.',
  description:
    'A fictional election results extract. Columns: State, Local Government Area, Polling Unit ID, Candidate, ' +
    'Votes Recorded. Contains a repeated polling unit, a polling unit code written in two formats, a missing ' +
    'local government area, a missing vote count and a row with an extra field. ' +
    'No candidate, party or real election is represented.',
  csv: `State,Local Government Area,Polling Unit ID,Candidate,Votes Recorded
Anambra,Onitsha North,AN-001-01-001,Ade Okonkwo,312
Anambra,Onitsha North,AN-001-01-002,Ade Okonkwo,287
Anambra,Onitsha North,AN-001-01-002,Ade Okonkwo,287
Anambra,Onitsha South,AN-002-01-001,Ade Okonkwo,198
Anambra,Onitsha South,AN00201001,Ade Okonkwo,204
Anambra,Awka North,AN-003-01-001,Ade Okonkwo,256
Anambra,,AN-004-01-001,Ade Okonkwo,143
Anambra,Awka South,AN-005-01-001,Ade Okonkwo,
Lagos,Ikeja,LA-001-01-001,Ade Okonkwo,540
Lagos,Ikeja,LA-001-01-002,Ade Okonkwo,498
lagos,Ikeja,LA-001-01-003,Ade Okonkwo,512
Lagos,Surulere,LA-002-01-001,Ade Okonkwo,377
Lagos,Surulere,LA-002-01-002,Ade Okonkwo,361
Lagos,Eti Osa,LA-003-01-001,Ade Okonkwo,289
Lagos,Eti Osa,LA-003-01-002,Ade Okonkwo,275
Kano,Nassarawa,KN-001-01-001,Ade Okonkwo,421
Kano,Nassarawa,KN-001-01-002,Ade Okonkwo,398
Kano,Fagge,KN-002-01-001,Ade Okonkwo,233
Kano,Fagge,KN-002-01-002,Ade Okonkwo,210
Kano,Dala,KN-003-01-001,Ade Okonkwo,187,provisional
Anambra,Onitsha North,AN-001-01-003,Ade Okonkwo,301
Anambra,Onitsha South,AN-002-01-002,Ade Okonkwo,176
Lagos,Ikeja,LA-001-01-001,Ade Okonkwo,540
`,
  documentedIssues: [
    'Row 3: exact duplicate of row 2 (polling unit AN-001-01-002).',
    'Row 5: polling unit code AN00201001 uses a different format from every other code (AN-002-01-001).',
    'Row 7: Local Government Area is empty (missing value).',
    'Row 8: Votes Recorded is empty (missing value).',
    'Row 11: State "lagos" is lower case where other rows use "Lagos" (inconsistent category).',
    'Row 20: the record has an extra field ("provisional") beyond the header, so it is a malformed row.',
    'Row 23: exact duplicate of row 9 (polling unit LA-001-01-001).',
    'Polling unit LA-001-01-001 appears twice, so it is also a key-based duplicate.',
  ],
}

export const SAMPLE_PUBLIC_HEALTH: SampleDataset = {
  id: 'public-health',
  name: 'Public health statistics (fictional)',
  summary: 'Health indicators reported by region and reporting period.',
  description:
    'A fictional public health indicator table. Columns: Region, Reporting Period, Indicator, Reported Value. ' +
    'Contains empty cells, indicator names written in several different ways, an unusual value, a value outside ' +
    'the plausible range for its indicator and a reporting period that cannot be read as a date.',
  csv: `Region,Reporting Period,Indicator,Reported Value
North Central,2023-01-01,Facility deliveries,1240
North Central,2023-04-01,Facility deliveries,1310
North East,2023-01-01,Facility deliveries,860
North East,2023-04-01,facility deliveries,904
North West,2023-01-01,Facility deliveries,1580
North West,2023-04-01,Facility deliveries,
South East,2023-01-01,Facility deliveries,720
South East,2023-04-01,Facility deliveries,745
South South,2023-01-01,Facility deliveries,690
South South,2023-04-01,Facility deliveries,712
North Central,2023-01-01,Measles vaccination coverage,88.4
North Central,2023-04-01,Measles vaccination coverage,91.2
North East,2023-01-01,Measles vaccination coverage,64.7
North East,2023-04-01,measles vaccination coverage,58.1
North West,2023-01-01,Measles vaccination coverage,72.3
North West,2023-04-01,Measles vaccination coverage,118.6
South East,2023-01-01,Measles vaccination coverage,84.9
South East,2023-04-01,Measles vaccination coverage,86.3
South South,2023-01-01,Measles vaccination coverage,79.5
South South,2023-04-01,Measles vaccination coverage,not reported
North Central,2023-01-01,Outpatient visits,18400
North Central,2023-04-01,Outpatient visits,19120
North East,2023-01-01,Outpatient visits,9600
North East,2023-04-01,Outpatient visits,-320
North West,2023-01-01,Outpatient visits,21300
North West,2023-04-01,Outpatient visits,22150
South East,2023-01-01,Outpatient visits,7800
South East,2023-04-01,Outpatient visits,8010
South South,2023-01-01,Outpatient visits,7400
South South,2023-04-01,Outpatient visits,999999
`,
  documentedIssues: [
    'Row 6: Reported Value is empty (missing value).',
    'Row 4: "facility deliveries" is lower case where other rows use "Facility deliveries".',
    'Row 14: "measles vaccination coverage" is lower case where other rows use "Measles vaccination coverage".',
    'Row 16: Measles vaccination coverage is 118.6, above 100 percent — plausible only if the indicator is not a percentage.',
    'Row 20: Reported Value is "not reported" (text in a numeric column).',
    'Row 24: Outpatient visits is negative (-320).',
    'Row 30: Outpatient visits is 999999, a placeholder-style value and an outlier.',
    'Rows 11-20: Reporting Period values are dates, so the column can be validated against YYYY-MM-DD.',
  ],
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  SAMPLE_GOVERNMENT_EXPENDITURE,
  SAMPLE_ELECTION_RESULTS,
  SAMPLE_PUBLIC_HEALTH,
]

/**
 * A deliberately different second version of the expenditure dataset, used to
 * demonstrate dataset comparison: one record added, one removed, one changed
 * value and one renamed column.
 */
export const SAMPLE_EXPENDITURE_REVISED: SampleDataset = {
  id: 'government-expenditure-revised',
  name: 'Government expenditure — revised release (fictional)',
  summary: 'A second version of the expenditure table, with deliberate additions, removals and revisions.',
  description:
    'Use with "Government expenditure (fictional)" on the Compare Datasets screen, matching on Department and ' +
    'Financial Year. The revised release adds a department, drops another, corrects one figure, changes one budget ' +
    'allocation and renames "Actual Expenditure" to "Expenditure Actual".',
  csv: `Department,Financial Year,Budget Allocation,Expenditure Actual
Water Resources,2022/2023,4500000000,4325000000
Education,2022/2023,8200000000,8060000000
Health,2022/2023,6100000000,6480000000
Transport,2022/2023,3750000000,3602000000
Agriculture,2022/2023,2100000000,2085000000
Works and Housing,2022/2023,2980000000,2950000000
water resources,2022/2023,1200000000,1180000000
Defence,2022/2023,5400000000,5390000000
Science and Technology,2022/2023,890000000,742000000
Water Resources,2023/2024,4800000000,4710000000
Education,2023/2024,9100000000,8950000000
Health,2023/2024,6800000000,7020000000
Transport,2023/2024,4100000000,3890000000
Agriculture,2023/2024,2400000000,2380000000
Works and Housing,2023/2024,3350000000,3105000000
Defence,2023/2024,5900000000,5870000000
Science and Technology,2023/2024,950000000,910000000
Environment,2023/2024,780000000,720000000
Water Resources,2023/2024,4800000000,4710000000
Health,2023/2024,6900000000,6650000000
Transport,2023/2024,4100000000,4105000000
Youth and Sports,2023/2024,640000000,598000000
Digital Economy,2023/2024,520000000,488000000
`,
  documentedIssues: [
    'The column "Actual Expenditure" was renamed to "Expenditure Actual". DataProof reports this as one removed column and one added column, and does NOT compare values across a rename, so changes inside that column are not detected.',
    'Digital Economy, 2023/2024 is a record added in the revised release.',
    'The 2022/2023 Health row with the negative expenditure is absent, so it is a removed record. The identifier Health + 2022/2023 repeats in the older file, so the surplus row is reported as removed and the duplicate-key warning is raised.',
    'Health, 2023/2024 budget allocation changed from empty to 6,900,000,000 (a changed value in a shared column).',
    'Works and Housing, 2023/2024 budget allocation changed from 3,200,000,000 to 3,350,000,000 (a changed value in a shared column).',
    'Transport, 2023/2024 expenditure changed from 32,500,000,000 to 4,105,000,000. Because the column was renamed, the comparison cannot match it, so this change is not reported — a reminder to check for renamed columns before relying on a comparison.',
  ],
}
