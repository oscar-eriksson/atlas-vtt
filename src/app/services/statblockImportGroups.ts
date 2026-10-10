import type { StatblockImportCandidate, StatblockImportStatus } from './statblockImportCandidates';

/** The groups the import's summary counts and can narrow the list to. */
export type StatblockImportGroup = 'ready' | 'imported' | 'attention';

export const STATBLOCK_IMPORT_GROUPS: readonly StatblockImportGroup[] = ['ready', 'imported', 'attention'];

/** Where a status counts: everything that is neither ready nor imported needs attention. */
export function importGroupOf(status: StatblockImportStatus): StatblockImportGroup {
  if (status === 'ready' || status === 'imported') return status;
  return 'attention';
}

/** How many of `rows` each group holds. */
export function importGroupCounts(rows: readonly StatblockImportCandidate[]): Record<StatblockImportGroup, number> {
  const counts: Record<StatblockImportGroup, number> = { ready: 0, imported: 0, attention: 0 };
  for (const row of rows) counts[importGroupOf(row.status)] += 1;
  return counts;
}
