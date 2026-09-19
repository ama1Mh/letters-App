// ESLint flat config. Base: Expo's config (https://docs.expo.dev/guides/using-eslint/).
// Project rules (CLAUDE.md "Hard rules"): logical-only styles, no hard-coded user-visible strings.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18next = require('eslint-plugin-i18next');

const SOURCE_FILES = ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'];
const TEST_FILES = ['**/__tests__/**', '**/*.test.{ts,tsx}'];

// --- Rule 1: physical (left/right) style properties are banned; use logical ones. ---
// Matches: marginLeft/Right, paddingLeft/Right, left, right, borderLeft/Right(Width|Color),
// border(Top|Bottom)(Left|Right)Radius. textAlign 'left'/'right' is matched separately.
const PHYSICAL_KEYS =
  '/^((margin|padding)(Left|Right)|left|right|border(Left|Right)(Width|Color)|border(Top|Bottom)(Left|Right)Radius)$/';
const PHYSICAL_MESSAGE =
  'Physical left/right styles break RTL. Use logical properties: marginStart/End, paddingStart/End, ' +
  'start/end, borderStart*/borderEnd*, border(Top|Bottom)(Start|End)Radius.';

const noPhysicalDirection = [
  { selector: `Property[key.name=${PHYSICAL_KEYS}]`, message: PHYSICAL_MESSAGE },
  { selector: `Property[key.value=${PHYSICAL_KEYS}]`, message: PHYSICAL_MESSAGE },
  {
    selector: "Property[key.name='textAlign'] > Literal[value=/^(left|right)$/]",
    message: "textAlign 'left'/'right' breaks RTL. Use 'auto' or 'start'/'end' (or 'center').",
  },
];

// --- Rule 2: user-visible strings must come from i18n. ---
// Object keys that hold user-visible text (e.g. Expo Router `options={{ title }}`, tab labels).
// The JSX-attribute allow-list below cannot see inside `options={{ ... }}`, so cover it here.
const UI_TEXT_KEYS =
  '/^(title|headerTitle|headerBackTitle|tabBarLabel|placeholder|label|accessibilityLabel|accessibilityHint)$/';
const UI_TEXT_MESSAGE =
  'Hard-coded user-visible string. Use i18n (t("...")) and add the key to both en.json and ar.json.';

const noHardCodedUiText = [
  { selector: `Property[key.name=${UI_TEXT_KEYS}] > Literal[value=/./]`, message: UI_TEXT_MESSAGE },
  { selector: `Property[key.name=${UI_TEXT_KEYS}] > TemplateLiteral`, message: UI_TEXT_MESSAGE },
];

module.exports = defineConfig([
  globalIgnores([
    'node_modules/',
    '.expo/',
    'dist/',
    'coverage/',
    'android/',
    'ios/',
    'expo-env.d.ts',
  ]),

  expoConfig,

  // TypeScript: strict-ish additions on top of Expo's set.
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // CLAUDE.md: no `any` without a comment -> disable per line with a written reason.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true },
      ],
    },
  },

  // Project rule 1 (app code and tests alike).
  {
    files: SOURCE_FILES,
    rules: { 'no-restricted-syntax': ['error', ...noPhysicalDirection, ...noHardCodedUiText] },
  },

  // Project rule 2, JSX part: text children and user-facing props. Not applied to tests.
  {
    files: SOURCE_FILES,
    ignores: TEST_FILES,
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          message: UI_TEXT_MESSAGE,
          // Allow-list: only these props are treated as user-visible text. Everything else
          // (testID, name, keyboardType, ...) is skipped. `include` wins over `exclude`.
          'jsx-attributes': {
            include: [
              'title',
              'placeholder',
              'label',
              'alt',
              'accessibilityLabel',
              'accessibilityHint',
              'aria-label',
            ],
            exclude: ['.*'],
          },
        },
      ],
    },
  },

  // Jest globals for tests.
  {
    files: TEST_FILES,
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
]);
