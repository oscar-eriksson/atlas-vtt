import { describe, expect, it } from 'vitest';
import type { StatblockImportCandidate, StatblockImportStatus } from '../../src/app/services/statblockImportCandidates';
import { importGroupCounts, importGroupOf } from '../../src/app/services/statblockImportGroups';

const row = (status: StatblockImportStatus): StatblockImportCandidate => ({ path: `${status}.md`, name: status, status, detail: '' });

describe('import groups', () => {
  it('count what is neither ready nor imported as needing attention', () => {
    expect(importGroupOf('ready')).toBe('ready');
    expect(importGroupOf('imported')).toBe('imported');
    for (const status of ['missing-image', 'remote-image', 'conflict'] as const) expect(importGroupOf(status)).toBe('attention');
  });

  it('are counted from the rows', () => {
    const rows = [row('ready'), row('imported'), row('imported'), row('missing-image'), row('conflict'), row('remote-image')];
    expect(importGroupCounts(rows)).toEqual({ ready: 1, imported: 2, attention: 3 });
    expect(importGroupCounts([])).toEqual({ ready: 0, imported: 0, attention: 0 });
  });
});
