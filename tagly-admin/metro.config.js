// SDK 54 / RN 0.81
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.resolver.alias = {
  ...(config.resolver.alias || {}),
  "@": projectRoot,
};

// Add PDF to asset extensions
config.resolver.assetExts = [...(config.resolver.assetExts || []), "pdf"];

// Force a SINGLE copy of the framework singletons.
//
// yarn deterministically materializes a second `react-native` (+ its metro deps)
// under `tagly-admin/node_modules` — customer/advertiser hoist cleanly, admin
// doesn't (a resolution quirk of admin's exact dep combination). Because Metro
// resolves from the importing file upward, admin's OWN files then load the nested
// copy while `@tagly/client`'s files load the ROOT copy → two React Native
// instances in one bundle → the second `InitializeCore` re-defines already-frozen
// globals → `TypeError: property is not writable` + `"main" has not been
// registered` at startup. Pinning these to the hoisted root copy (resolving them
// as if from the repo root) guarantees exactly one instance, whatever yarn does
// on the next install.
const SINGLETONS = new Set(["react", "react-native"]);
const rootAnchor = path.join(monorepoRoot, "node_modules", ".metro-root-anchor");

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // When pdf-lib tries to import tslib, redirect to the root node_modules tslib
  // which has proper ES module support (v2.x vs pdf-lib's bundled v1.14.1)
  if (moduleName === "tslib" && context.originModulePath?.includes("pdf-lib")) {
    return {
      type: "sourceFile",
      filePath: require.resolve("tslib"),
    };
  }

  // Resolve `react` / `react-native` (and their deep imports) as if from the repo
  // root, so the single hoisted copy always wins over any nested duplicate.
  if (SINGLETONS.has(moduleName) || moduleName.startsWith("react-native/")) {
    return context.resolveRequest(
      { ...context, originModulePath: rootAnchor },
      moduleName,
      platform,
    );
  }

  // Fall back to default resolver
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
