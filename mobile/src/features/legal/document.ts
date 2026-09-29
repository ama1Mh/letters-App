/**
 * Shared shape for the in-app legal documents (privacy policy DEC-053, terms DEC-054). The text is
 * a document, not UI copy, so it lives in its own files (en + ar with the same structure) rather
 * than in ar.json/en.json. `{{name}}` placeholders are filled in by LegalDocumentView.
 */
import type { Language } from '@/core/i18n/languages';

export type LegalBlock = { kind: 'p'; text: string } | { kind: 'list'; items: string[] };
export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}
/** The screen title comes from i18n (`legal.*Title`), shown in the header. */
export interface LegalDocument {
  /** ISO date shown as "Last updated". Bump it with every change to the text. */
  updated: string;
  content: Record<Language, { updatedLabel: string; sections: LegalSection[] }>;
}

export const p = (text: string): LegalBlock => ({ kind: 'p', text });
export const list = (...items: string[]): LegalBlock => ({ kind: 'list', items });

/** Fills `{{name}}` placeholders; unknown names are left as they are. */
export function fillLegalText(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => values[name] ?? match);
}

/** Every string of one language, in reading order (used by tests). */
export function allLegalText(doc: LegalDocument, language: Language): string[] {
  const { updatedLabel, sections } = doc.content[language];
  return [
    updatedLabel,
    ...sections.flatMap((s) => [
      s.heading,
      ...s.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : b.items)),
    ]),
  ];
}
