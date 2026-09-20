const preset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // @formatjs packages ship ES modules only; let Babel transform them (needed by the Intl polyfills).
  transformIgnorePatterns: [
    preset.transformIgnorePatterns[0].replace(
      '|standard-navigation))',
      '|standard-navigation|@formatjs))',
    ),
    ...preset.transformIgnorePatterns.slice(1),
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}', '<rootDir>/src/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
