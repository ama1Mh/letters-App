/**
 * Hermes ships no Intl.PluralRules, which i18next needs for plural forms (DEC-037, spike
 * 2026-09-20). The polyfill only installs itself when the engine lacks the API, so this is a
 * no-op on engines that have it (Node/Jest). Only the locales we support are bundled.
 * Must be imported before i18next initialises.
 */
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/ar.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
