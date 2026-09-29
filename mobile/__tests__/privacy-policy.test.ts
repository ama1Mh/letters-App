import {
  PRIVACY_POLICY,
  PRIVACY_POLICY_UPDATED,
  fillPolicyText,
} from '@/features/legal/privacyPolicy';

const allText = (lang: 'en' | 'ar') => {
  const doc = PRIVACY_POLICY[lang];
  return [
    doc.updatedLabel,
    ...doc.sections.flatMap((s) => [
      s.heading,
      ...s.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : b.items)),
    ]),
  ];
};

describe('privacy policy text (DEC-053)', () => {
  it('has the same structure in English and Arabic, so neither language drifts', () => {
    const shape = (lang: 'en' | 'ar') =>
      PRIVACY_POLICY[lang].sections.map((s) =>
        s.blocks.map((b) => (b.kind === 'p' ? 'p' : `list:${b.items.length}`)),
      );
    expect(shape('ar')).toEqual(shape('en'));
  });

  it('uses only the placeholders the screen fills, the same ones in both languages', () => {
    const names = (lang: 'en' | 'ar') =>
      allText(lang)
        .flatMap((text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))
        .sort();
    expect(new Set(names('en'))).toEqual(new Set(['appName', 'email', 'date']));
    expect(names('ar')).toEqual(names('en'));
  });

  it('writes Arabic with Western digits only', () => {
    expect(allText('ar').join(' ')).not.toMatch(/[٠-٩۰-۹]/);
  });

  it('has a valid "last updated" date', () => {
    expect(PRIVACY_POLICY_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(PRIVACY_POLICY_UPDATED))).toBe(false);
  });

  it('fills known placeholders and leaves unknown ones', () => {
    expect(fillPolicyText('{{a}} and {{b}}', { a: 'x' })).toBe('x and {{b}}');
  });
});
