const preset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // @formatjs (Intl polyfills) and @noble (AES for the session storage) ship ES modules only; let
  // Babel transform them.
  transformIgnorePatterns: [
    preset.transformIgnorePatterns[0].replace(
      '|standard-navigation))',
      '|standard-navigation|@formatjs|@noble))',
    ),
    ...preset.transformIgnorePatterns.slice(1),
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}', '<rootDir>/src/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
