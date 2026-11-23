import { z } from "zod";

/**
 * `POST /v2/advertisers/me/on-app-open` — fire-and-forget app-open side-effects
 * for the logged-in advertiser (twin of the customer endpoint): ensures
 * notification-event defaults exist and registers the device's Expo push token
 * if one is supplied. Returns 204 (no body).
 */
export const OnAppOpenBodySchema = z.object({
  /** The device's Expo push token. Omit if the app couldn't obtain one. */
  pushToken: z.string().min(1).optional(),
  /** Device platform, stored alongside the token for delivery/targeting. */
  platform: z.enum(["ios", "android"]).optional(),
  /**
   * Vendor/app-scoped device id (iOS identifierForVendor, Android app-scoped) —
   * NOT the advertising id. Functional push metadata for de-duping per device.
   */
  deviceId: z.string().min(1).optional(),
  /** IANA timezone (e.g. "America/New_York") — lets notifications deliver at a sensible local time. */
  timezone: z.string().min(1).max(64).optional(),
  /**
   * OS notification-permission status for THIS device (`getPermissionsAsync`).
   * `false` disables the device's stored push tokens server-side — revoking
   * permission does NOT invalidate an Expo token, so without this report the
   * backend would keep "successfully" pushing into a void (and the promo
   * push-vs-email waterfall would pick the dead channel). `true` (or omitted)
   * leaves tokens alone; a supplied `pushToken` re-enables via the upsert.
   */
  pushPermissionGranted: z.boolean().optional(),
});
export type OnAppOpenBody = z.infer<typeof OnAppOpenBodySchema>;
