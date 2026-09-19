import { DevSettings, I18nManager } from 'react-native';

import { applyLayoutDirection, reloadApp } from '../src/core/i18n/direction';

function layoutIs(isRTL: boolean) {
  jest
    .spyOn(I18nManager, 'getConstants')
    .mockReturnValue({ isRTL, doLeftAndRightSwapInRTL: true, localeIdentifier: 'x' });
}

describe('applyLayoutDirection', () => {
  let allowRTL: jest.SpyInstance;
  let forceRTL: jest.SpyInstance;

  beforeEach(() => {
    allowRTL = jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
    forceRTL = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('forces RTL for Arabic and asks for a reload when the layout is LTR', () => {
    layoutIs(false);
    expect(applyLayoutDirection('ar')).toEqual({ needsReload: true });
    expect(allowRTL).toHaveBeenCalledWith(true);
    expect(forceRTL).toHaveBeenCalledWith(true);
  });

  it('needs no reload when Arabic is requested and the layout is already RTL', () => {
    layoutIs(true);
    expect(applyLayoutDirection('ar')).toEqual({ needsReload: false });
  });

  it('forces LTR for English and asks for a reload when the layout is RTL', () => {
    layoutIs(true);
    expect(applyLayoutDirection('en')).toEqual({ needsReload: true });
    expect(forceRTL).toHaveBeenCalledWith(false);
  });

  it('needs no reload for English on an LTR layout', () => {
    layoutIs(false);
    expect(applyLayoutDirection('en')).toEqual({ needsReload: false });
  });
});

describe('reloadApp', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reloads the bundle in dev builds', () => {
    const reload = jest.spyOn(DevSettings, 'reload').mockImplementation(() => {});
    reloadApp();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('fails loudly in production until expo-updates is added (OPEN-8)', () => {
    const original = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      expect(() => reloadApp()).toThrow(/OPEN-8/);
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = original;
    }
  });
});
