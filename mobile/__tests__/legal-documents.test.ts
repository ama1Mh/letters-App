import { allLegalText, fillLegalText, type LegalDocument } from '@/features/legal/document';
import { PRIVACY_POLICY } from '@/features/legal/privacyPolicy';
import { TERMS } from '@/features/legal/terms';

const DOCUMENTS: [string, LegalDocument][] = [
  ['privacy policy (DEC-053)', PRIVACY_POLICY],
  ['terms of service (DEC-054)', TERMS],
];

describe.each(DOCUMENTS)('%s', (_name, doc) => {
  it('has the same structure in English and Arabic, so neither language drifts', () => {
    const shape = (lang: 'en' | 'ar') =>
      doc.content[lang].sections.map((s) =>
        s.blocks.map((b) => (b.kind === 'p' ? 'p' : `list:${b.items.length}`)),
      );
    expect(shape('ar')).toEqual(shape('en'));
  });

  it('uses only the placeholders the view fills, the same ones in both languages', () => {
    const names = (lang: 'en' | 'ar') =>
      allLegalText(doc, lang)
        .flatMap((text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))
        .sort();
    expect(['appName', 'email', 'date']).toEqual(expect.arrayContaining([...new Set(names('en'))]));
    expect(names('en')).toEqual(expect.arrayContaining(['email', 'date']));
    expect(names('ar')).toEqual(names('en'));
  });

  it('writes Arabic with Western digits only', () => {
    expect(allLegalText(doc, 'ar').join(' ')).not.toMatch(/[٠-٩۰-۹]/);
  });

  it('has a valid "last updated" date', () => {
    expect(doc.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(doc.updated))).toBe(false);
  });
});

it('fills known placeholders and leaves unknown ones', () => {
  expect(fillLegalText('{{a}} and {{b}}', { a: 'x' })).toBe('x and {{b}}');
});
