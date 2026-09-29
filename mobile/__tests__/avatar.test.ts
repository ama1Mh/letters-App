import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import catalog from '../../shared/avatar-catalog.json';
import {
  AVATAR_PRESETS,
  avatarPreset,
  avatarSourceFromKey,
  isValidAvatarKey,
} from '../src/domain/avatar';

describe('avatar catalog (DEC-011)', () => {
  it('has unique keys, valid glyph names and hex colours', () => {
    const keys = AVATAR_PRESETS.map((preset) => preset.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(20);
    const glyphs = JSON.parse(
      readFileSync(
        require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'),
        'utf8',
      ),
    ) as Record<string, number>;
    for (const preset of AVATAR_PRESETS) {
      expect(glyphs[preset.icon]).toBeDefined();
      expect(preset.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(preset.key).toMatch(/^[a-z_]+$/);
    }
  });

  it('matches the database check exactly (20260929220000_avatars.sql)', () => {
    const sql = readFileSync(
      join(__dirname, '..', '..', 'supabase', 'migrations', '20260929220000_avatars.sql'),
      'utf8',
    );
    const inList = /p_key in \(([^)]*)\)/.exec(sql)?.[1] ?? '';
    const sqlKeys = [...inList.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(sqlKeys).toEqual(catalog.avatars.map((a) => a.key).sort());
  });

  it('validates keys and maps them to sources', () => {
    expect(isValidAvatarKey(null)).toBe(true);
    expect(isValidAvatarKey('paw')).toBe(true);
    expect(isValidAvatarKey('Paw')).toBe(false);
    expect(avatarPreset('rocket')).toMatchObject({ icon: 'rocket' });
    expect(avatarSourceFromKey('rocket')).toEqual({ type: 'preset', key: 'rocket' });
    expect(avatarSourceFromKey('gone')).toBeNull();
    expect(avatarSourceFromKey(null)).toBeNull();
  });
});
