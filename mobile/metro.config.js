// Metro's default config only watches/resolves within the project root (this directory). Phase 4
// needs `../shared/design-catalog.json` (PLAN §5: "used by app AND DB validation" - a single
// source of truth shared outside `mobile/`), so this adds it as an extra watch folder, the
// standard Expo monorepo pattern. Nothing else changes: `mobile/` is still the app project root.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

module.exports = config;
