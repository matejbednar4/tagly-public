import { z } from "zod";

/**
 * `POST /v2/cross/logout` — log out the current session. Cross-app + authed (any
 * valid JWT): both the customer and advertiser apps post here. The backend
 * disables the supplied device push token (so a logged-out device stops
 * receiving this user's notifications) and clears the web JWT cookie. The client
 * still drops its own stored JWT — this is the server-side half of logout.
 *
 * Best-effort + idempotent: `pushToken` is optional (omitted when unavailable),
 * and disabling a token that's missing or already disabled is a no-op.
 */
export const LogOutBodySchema = z.object({
  /** This device's Expo push token to disable. Same field name as `onAppOpen`. */
  pushToken: z.string().min(1).optional(),
});
export type LogOutBody = z.infer<typeof LogOutBodySchema>;

export const LogOutResponseSchema = z.object({
  message: z.string(),
});
export type LogOutResponse = z.infer<typeof LogOutResponseSchema>;
