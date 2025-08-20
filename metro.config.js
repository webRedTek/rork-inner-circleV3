// Minimal Metro config to avoid importLocationsPlugin error
const { getDefaultConfig } = require("@expo/metro-config");

const config = getDefaultConfig(__dirname);

// Remove problematic serializer plugins
config.serializer.customSerializer = undefined;

// Filter out reconcileTransformSerializerPlugin if it exists
if (config.serializer.plugins) {
  config.serializer.plugins = config.serializer.plugins.filter(
    plugin => plugin.name !== 'reconcileTransformSerializerPlugin'
  );
}

module.exports = config;