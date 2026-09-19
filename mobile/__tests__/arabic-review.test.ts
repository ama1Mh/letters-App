import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ar from '../src/core/i18n/locales/ar.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

interface ReviewRow {
  key: string;
  arabic: string;
  status: string;
}

function readReviewRows(): ReviewRow[] {
  const file = join(__dirname, '..', '..', 'docs', 'ARABIC_REVIEW.md');
  const rows: ReviewRow[] = [];
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\|\s*`([^`]+)`\s*\|(.*)$/.exec(line);
    if (!match) continue;
    const cells = match[2].split('|').map((cell) => cell.trim());
    // cells: English | Arabic | Status | Notes | (trailing empty)
    rows.push({ key: match[1], arabic: cells[1], status: cells[2] });
  }
  return rows;
}

describe('docs/ARABIC_REVIEW.md', () => {
  const rows = readReviewRows();
  const flatAr = flatten(ar);

  it('lists every ar.json key exactly once, and nothing else', () => {
    expect(rows.map((r) => r.key).sort()).toEqual(Object.keys(flatAr).sort());
  });

  it('quotes the same Arabic text as ar.json', () => {
    for (const row of rows) {
      expect({ key: row.key, arabic: row.arabic }).toEqual({
        key: row.key,
        arabic: flatAr[row.key],
      });
    }
  });

  it('uses only the statuses draft or approved', () => {
    for (const row of rows) {
      expect({ key: row.key, ok: ['draft', 'approved'].includes(row.status) }).toEqual({
        key: row.key,
        ok: true,
      });
    }
  });
});
