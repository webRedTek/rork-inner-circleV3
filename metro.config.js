const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable importLocationsPlugin that's causing the build to fail
config.serializer = {
  ...config.serializer,
  customSerializer: undefined,
};

// Remove problematic plugins
if (config.transformer && config.transformer.plugins) {
  config.transformer.plugins = config.transformer.plugins.filter(
    plugin => !plugin.includes('importLocationsPlugin')
  );
}

module.exports = config;
