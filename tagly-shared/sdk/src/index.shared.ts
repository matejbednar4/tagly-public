// SDK configuration (version-agnostic — survives every cutover). Client
// functions live in the version-namespaced entries, e.g. `@tagly/sdk/v2/crossApp`.
export { initSdk, type SdkClient, type SdkConfig } from "./config";
