// Expo's default config detects the pnpm workspace (hoisted node-linker, see /.npmrc)
// and watches packages/shared automatically.
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
