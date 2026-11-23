/**
 * SDK configuration for React Native apps.
 *
 * Call initSdk() once on app startup to enable app version headers.
 * Dashboard does not call this, so no headers are sent from web clients.
 */

export type SdkClient = "customer" | "advertiser" | "admin";

export interface SdkConfig {
  client: SdkClient;
  version: string;
  build: string;
  platform: "ios" | "android" | "web";
}

// Module-level state
let sdkConfig: SdkConfig | null = null;

/**
 * Initialize SDK with app information. Call once on app startup.
 * Only call from React Native apps - dashboard does not call this.
 */
export function initSdk(config: SdkConfig): void {
  sdkConfig = config;
}

/**
 * Returns app headers if SDK is initialized, empty object otherwise.
 * Used by request.ts to attach headers to all requests.
 */
export function getAppHeaders(): Record<string, string> {
  if (!sdkConfig) return {};

  return {
    "X-App-Version": sdkConfig.version,
    "X-App-Build": sdkConfig.build,
    "X-App-Platform": sdkConfig.platform,
    "X-App-Client": sdkConfig.client,
  };
}

/**
 * Check if SDK has been initialized (for testing/debugging).
 */
export function isSdkInitialized(): boolean {
  return sdkConfig !== null;
}

/**
 * Get current SDK config (for testing/debugging).
 */
export function getSdkConfig(): SdkConfig | null {
  return sdkConfig;
}
