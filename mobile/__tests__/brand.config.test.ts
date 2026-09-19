import { getBrandConfig, resolveVariant } from '../brand.config';

describe('resolveVariant', () => {
  it('defaults to dev when APP_VARIANT is unset or empty', () => {
    expect(resolveVariant(undefined)).toBe('dev');
    expect(resolveVariant('')).toBe('dev');
  });

  it('accepts the known variants', () => {
    expect(resolveVariant('dev')).toBe('dev');
    expect(resolveVariant('preview')).toBe('preview');
    expect(resolveVariant('production')).toBe('production');
  });

  it('rejects unknown variants', () => {
    expect(() => resolveVariant('staging')).toThrow(/Unknown APP_VARIANT/);
  });
});

describe('getBrandConfig', () => {
  it('uses the dev package ID from DEC-001 for dev', () => {
    const dev = getBrandConfig('dev');
    expect(dev.androidPackage).toBe('com.letterapp.dev');
    expect(dev.scheme).toBe('letterapp');
  });

  it('gives preview its own package ID and scheme so it installs beside dev', () => {
    const dev = getBrandConfig('dev');
    const preview = getBrandConfig('preview');
    expect(preview.androidPackage).not.toBe(dev.androidPackage);
    expect(preview.scheme).not.toBe(dev.scheme);
    expect(preview.slug).toBe(dev.slug);
  });

  it('refuses to build production until the naming freeze', () => {
    expect(() => getBrandConfig('production')).toThrow(/OPEN-2/);
  });

  it('never uses a com.example package ID', () => {
    for (const v of ['dev', 'preview'] as const) {
      expect(getBrandConfig(v).androidPackage).not.toMatch(/^com\.example\./);
    }
  });
});
