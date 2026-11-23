// SDK 54 / RN 0.81
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Optional aliases
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  "@": projectRoot,
};

// Add PDF to asset extensions
config.resolver.assetExts = [...(config.resolver.assetExts || []), "pdf"];

module.exports = config;
