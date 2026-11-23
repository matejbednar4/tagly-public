export const ERROR_CODES = Object.freeze({
  SDK: {
    CANCELED: 1,
    INVALID_RES_PAYLOAD: 2,
    INVALID_JSON: 3,
    NETWORK: 4,
    TIMEOUT: 5,
    REQ_PREVALIDATION: 60,
    ASSEMBLY: 70,
  },
  SERVER: {
    ZOD: 100,
    HTML_NOT_ALLOWED: 110,
    ROUTE_NOT_FOUND: 140,
    RATE_LIMIT: 150,
    CLIENT_OUTDATED: 160,
    INTERNAL: 190,
    AUTH: {
      MISSING: 200,
      BAD_HEADER: 201,
      INVALID_JWT: 202,
      FORBIDDEN: 204,
      USER_NOT_FOUND: 244,
    },
    OTP: {
      FAILED_TO_CREATE: 301,
      SESSION_NOT_FOUND: 302,
      TOO_MANY_RESENDS: 303,
      SENT_RECENTLY: 304,
      EXPIRED_NEW_SENT: 305,
      EXPIRED: 306,
      TOO_MANY_ATTEMPTS_NEW_SENT: 307,
      TOO_MANY_ATTEMPTS: 308,
      INVALID: 309,
      MAX_RESENDS: 310,
    },
  },

  // 1000+ domain codes. Most are used as raw literals at the throw site; codes
  // the client maps to a specific user-facing message are named here so the
  // backend throw and the `caller.ts` mapping share one source of truth. Kept as
  // `Record<string, number>` so the many unregistered raw domain codes
  // (4043, 1001, …) still satisfy `createCustomError`'s `ErrorCode` param.
  DOMAIN: {
    CUSTOMER_BANNED: 1540,
    INSTAGRAM_BANNED: 1541,
  } as Record<string, number>,
} as const);

type Values<T> = T[keyof T];
type DeepValues<T> = T extends object
  ? Values<{ [K in keyof T]: DeepValues<T[K]> }>
  : T;

// Flat union of all numeric codes
export type ErrorCode = DeepValues<typeof ERROR_CODES>;
