import Storage from 'expo-sqlite/kv-store';

// Defined outside the factory (and prefixed `mock`) so they survive module resets.
const mockApplyLayoutDirection = jest.fn();
const mockReloadApp = jest.fn();
const mockDeviceLanguage = jest.fn();

jest.mock('../src/core/i18n/direction', () => ({
  applyLayoutDirection: (...args: unknown[]) => mockApplyLayoutDirection(...args),
  isLayoutRtl: () => false,
  reloadApp: () => mockReloadApp(),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: mockDeviceLanguage() }],
}));

type I18nModule = typeof import('../src/core/i18n');

/** A brand-new copy of the i18n module + i18next singleton, as after an app restart. */
function freshI18n(): I18nModule {
  let mod: I18nModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs require
    mod = require('../src/core/i18n') as I18nModule;
  });
  if (!mod) throw new Error('freshI18n: module did not load');
  return mod;
}

beforeEach(() => {
  Storage.clearSync();
  mockApplyLayoutDirection.mockReset().mockReturnValue({ needsReload: false });
  mockReloadApp.mockReset();
  mockDeviceLanguage.mockReset().mockReturnValue('en');
});

describe('initI18n', () => {
  it('uses the device language for the default "system" preference', () => {
    mockDeviceLanguage.mockReturnValue('ar');
    const { initI18n, i18n } = freshI18n();
    initI18n();
    expect(i18n.language).toBe('ar');
    expect(i18n.t('tabs.inbox')).toBe('الوارد');
    expect(mockApplyLayoutDirection).toHaveBeenCalledWith('ar');
  });

  it('falls back to English for an unsupported device language', () => {
    mockDeviceLanguage.mockReturnValue('fr');
    const { initI18n, i18n } = freshI18n();
    initI18n();
    expect(i18n.language).toBe('en');
    expect(i18n.t('tabs.inbox')).toBe('Inbox');
  });

  it('lets a stored preference override the device language', () => {
    mockDeviceLanguage.mockReturnValue('ar');
    Storage.setItemSync('i18n.languagePreference', 'en');
    const { initI18n, i18n } = freshI18n();
    initI18n();
    expect(i18n.language).toBe('en');
  });

  it('reloads once when the direction differs from the running layout', () => {
    mockDeviceLanguage.mockReturnValue('ar');
    mockApplyLayoutDirection.mockReturnValue({ needsReload: true });
    freshI18n().initI18n();
    expect(mockReloadApp).toHaveBeenCalledTimes(1);
  });

  it('does not reload again if a reload did not fix the direction (loop guard)', () => {
    mockDeviceLanguage.mockReturnValue('ar');
    mockApplyLayoutDirection.mockReturnValue({ needsReload: true });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    freshI18n().initI18n();
    freshI18n().initI18n(); // the app restarted and the direction is still wrong

    expect(mockReloadApp).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('clears the guard once the direction matches, so a later mismatch can reload again', () => {
    mockDeviceLanguage.mockReturnValue('ar');
    mockApplyLayoutDirection.mockReturnValueOnce({ needsReload: true });
    freshI18n().initI18n(); // reload #1
    mockApplyLayoutDirection.mockReturnValueOnce({ needsReload: false });
    freshI18n().initI18n(); // direction now matches -> guard cleared
    mockApplyLayoutDirection.mockReturnValueOnce({ needsReload: true });
    freshI18n().initI18n(); // mismatch again -> reload #2

    expect(mockReloadApp).toHaveBeenCalledTimes(2);
  });

  it('is idempotent within one app session', () => {
    const { initI18n } = freshI18n();
    initI18n();
    initI18n();
    expect(mockApplyLayoutDirection).toHaveBeenCalledTimes(1);
  });
});

describe('changeLanguagePreference', () => {
  it('persists the preference, switches language and reports whether a reload is needed', async () => {
    const { initI18n, changeLanguagePreference, i18n } = freshI18n();
    initI18n();
    mockApplyLayoutDirection.mockReturnValue({ needsReload: true });

    const result = await changeLanguagePreference('ar');

    expect(result).toEqual({ language: 'ar', needsReload: true });
    expect(i18n.language).toBe('ar');
    expect(Storage.getItemSync('i18n.languagePreference')).toBe('ar');
    expect(mockReloadApp).not.toHaveBeenCalled(); // the user confirms first
  });

  it('needs no reload for a change that keeps the direction', async () => {
    const { initI18n, changeLanguagePreference } = freshI18n();
    initI18n();
    mockApplyLayoutDirection.mockReturnValue({ needsReload: false });
    expect(await changeLanguagePreference('en')).toEqual({ language: 'en', needsReload: false });
  });

  it('resolves "system" through the device language', async () => {
    const { initI18n, changeLanguagePreference } = freshI18n();
    initI18n();
    mockDeviceLanguage.mockReturnValue('ar');
    const result = await changeLanguagePreference('system');
    expect(result.language).toBe('ar');
    expect(Storage.getItemSync('i18n.languagePreference')).toBe('system');
  });
});
