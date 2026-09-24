import { detectBodyDirection } from '@/domain/bodyDirection';

describe('detectBodyDirection', () => {
  it('detects Arabic as rtl', () => {
    expect(detectBodyDirection('مرحبا بك', 'ltr')).toBe('rtl');
  });

  it('detects English (and other Latin-script text) as ltr', () => {
    expect(detectBodyDirection('Hello there', 'rtl')).toBe('ltr');
  });

  it('skips leading digits, punctuation and whitespace to find the first strong character', () => {
    expect(detectBodyDirection('  12:30 - مرحبا', 'ltr')).toBe('rtl');
    expect(detectBodyDirection('  12:30 - Hello', 'rtl')).toBe('ltr');
  });

  it('mixed script: the first strong character wins, not the majority script', () => {
    expect(detectBodyDirection('Hi مرحبا', 'rtl')).toBe('ltr');
    expect(detectBodyDirection('مرحبا Hi', 'ltr')).toBe('rtl');
  });

  it('falls back when there is no strong character at all', () => {
    expect(detectBodyDirection('', 'ltr')).toBe('ltr');
    expect(detectBodyDirection('', 'rtl')).toBe('rtl');
    expect(detectBodyDirection('   ', 'rtl')).toBe('rtl');
    expect(detectBodyDirection('123 456 - :)', 'ltr')).toBe('ltr');
    expect(detectBodyDirection('🎉🎉🎉', 'rtl')).toBe('rtl');
  });

  it('treats Hebrew as strong rtl too, even though the app UI never offers it', () => {
    expect(detectBodyDirection('שלום', 'ltr')).toBe('rtl');
  });

  it('handles a surrogate-pair emoji before the first strong letter without splitting it', () => {
    expect(detectBodyDirection('😀 مرحبا', 'ltr')).toBe('rtl');
  });
});
