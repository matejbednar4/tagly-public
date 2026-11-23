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

// Fix pdf-lib's tslib ES module issue by redirecting to the root tslib (v2.x)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // When pdf-lib tries to import tslib, redirect to the root node_modules tslib
  // which has proper ES module support (v2.x vs pdf-lib's bundled v1.14.1)
  if (
    moduleName === "tslib" &&
    context.originModulePath?.includes("pdf-lib")
  ) {
    return {
      type: "sourceFile",
      filePath: require.resolve("tslib"),
    };
  }

  // Fall back to default resolver
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
