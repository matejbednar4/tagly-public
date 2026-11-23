/**
 * @expo/fingerprint config — loaded by every fingerprint computation for this
 * app (eas-cli on the invoking machine AND the EAS builder), so both sides
 * apply the same ignores.
 *
 * RNPermissions.podspec is rewritten IN PLACE inside node_modules by
 * react-native-permissions' `setup_permissions` (invoked from the Podfile,
 * which our config plugin `iosPermissions: ["PhotoLibrary"]` generates) during
 * `pod install`. The EAS builder therefore hashes a mutated file while the
 * machine that invoked `eas build` hashed the pristine one → permanent
 * "Runtime version calculated on local machine not equal ..." failure in
 * CONFIGURE_EXPO_UPDATES. Ignoring exactly this file keeps the two sides
 * equal; every other file in the package still counts, so upgrading
 * react-native-permissions still mints a new runtime version.
 */
/** @type {import('@expo/fingerprint').Config} */
const config = {
  ignorePaths: ["../node_modules/react-native-permissions/RNPermissions.podspec"],
};

module.exports = config;
