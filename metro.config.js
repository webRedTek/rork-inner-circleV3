const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Override serializer to avoid importLocationsPlugin dependency
config.serializer = {
  ...config.serializer,
  customSerializer: undefined,
};

// Remove the problematic reconcileTransformSerializerPlugin
if (config.serializer && config.serializer.plugins) {
  config.serializer.plugins = config.serializer.plugins.filter(
    plugin => !plugin.toString().includes('reconcileTransform')
  );
}

module.exports = config;
