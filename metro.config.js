const { getDefaultConfig } = require("@expo/metro-config");

const config = getDefaultConfig(__dirname);

// Override serializer to remove problematic plugins
config.serializer = {
  ...config.serializer,
  customSerializer: ({ 
    entryPoint,
    preModules,
    graph,
    options
  }) => {
    // Use basic Metro serializer without Expo's problematic plugins
    const { baseJSBundle } = require("metro/src/DeltaBundler/Serializers/baseJSBundle");
    return baseJSBundle(entryPoint, preModules, graph, options);
  }
};

module.exports = config;