const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker imports its embedded wa-sqlite binary. Metro does
// not treat .wasm as an asset by default, so an all-platform CI export fails
// even though the native bundles are valid unless this extension is explicit.
config.resolver.assetExts.push('wasm');

module.exports = config;
