const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Defer module loading until first use — reduces initial JS parse time
// and helps tree-shaking of unused modules
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: { keep_fnames: true },
};

// Inline requires: modules are loaded lazily on first call instead of
// all at startup. Measurably reduces cold-start time and JS bundle
// evaluated on launch.
config.transformer.inlineRequires = true;

module.exports = config;
