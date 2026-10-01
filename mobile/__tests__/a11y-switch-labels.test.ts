import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every Switch must carry its own accessibilityLabel: TalkBack otherwise reads only "switch, off"
 *  (Phase 10 accessibility pass; the visible text beside it is a separate element). */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('accessibility: switches are labelled', () => {
  const root = join(__dirname, '..');
  const files = [...tsxFiles(join(root, 'app')), ...tsxFiles(join(root, 'src'))];

  it.each(files)('%s', (file) => {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<Switch\b([\s\S]*?)\/>/g)) {
      expect(match[1]).toContain('accessibilityLabel=');
    }
  });
});
