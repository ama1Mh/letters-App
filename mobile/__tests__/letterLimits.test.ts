import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LETTER_BODY_MAX, LETTER_SUBJECT_MAX, shouldShowBodyCounter } from '@/domain/letterLimits';

describe('letter limits', () => {
  it('match the CHECK constraints in the letters migration', () => {
    const sql = readFileSync(
      join(__dirname, '..', '..', 'supabase', 'migrations', '20260924120000_letters.sql'),
      'utf8',
    );
    expect(sql).toContain(`char_length(subject) <= ${LETTER_SUBJECT_MAX}`);
    expect(sql).toContain(`char_length(body) <= ${LETTER_BODY_MAX}`);
  });

  it('shows the counter only near the limit', () => {
    expect(shouldShowBodyCounter(0)).toBe(false);
    expect(shouldShowBodyCounter(8999)).toBe(false);
    expect(shouldShowBodyCounter(9000)).toBe(true);
    expect(shouldShowBodyCounter(LETTER_BODY_MAX)).toBe(true);
  });
});
