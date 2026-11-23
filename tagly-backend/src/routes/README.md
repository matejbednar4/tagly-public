# Routes — folder structure & middleware convention

**Rule: every URL path segment is its own folder.** The on-disk tree under
`routes/` mirrors the request path, one segment per folder, so a route's security
posture (rate limiting, auth, capability / IDOR checks) is legible from _where the
file lives_ — you never have to dig through `app.ts` to know what guards an
endpoint.

## How it maps

`POST /v2/public/auth/customers/start-email` resolves through:

```
routes/v2/index.ts                        # /v2         → mounts /public
routes/v2/public/index.ts                 # /v2/public  → mounts /auth (+ leaf routes, e.g. /suggest-locale)
routes/v2/public/auth/index.ts            # …/auth      → mounts /customers (+ /advertisers)
routes/v2/public/auth/customers/index.ts  # …/customers → defines the leaf routes (start-email, verify-otp, …)
```

- **Grouping segments are folders.** `v2`, `public`, `auth`, `customers` each get a
  folder with an `index.ts`.
- **Leaf endpoints live in the deepest folder's `index.ts`.** `start-email`,
  `verify-otp`, … are `r.post(...)` lines inside `customers/index.ts` — they are not
  their own folders.
- **A folder's `index.ts` mounts its children, applies that segment's middleware,
  and `export default`s the router.**

## Middleware is applied at the segment it guards

Declare each guard at the mount of the segment it protects — not in `app.ts`. The
folder you're in tells you what's already been applied above you:

| Segment             | Middleware at its mount                                                            |
| ------------------- | --------------------------------------------------------------------------------- |
| `/v2/public/…`      | per-route public limiter (`appIpLimiter`)                                          |
| `/v2/public/auth/…` | `authIpLimiter` (stricter IP limit for OTP/OAuth brute-force)                      |
| `/v2/customers/…`   | `verifyJwt, authedUserLimiter, gentlePerRouteLimiter, requireCustomerCapability`   |
| `/v2/advertisers/…` | `verifyJwt, authedUserLimiter, gentlePerRouteLimiter, requireAdvertiserCapability` |
| `/v2/cross/…`       | `verifyJwt, authedUserLimiter, gentlePerRouteLimiter`                              |
| `/v2/admin/…`       | `verifyJwt, authedUserLimiter, gentlePerRouteLimiter, requireAdminCapability`      |

Example (`public/index.ts`):

```ts
r.post("/suggest-locale", appIpLimiter, validateReq("body", SuggestLocaleBodySchema), suggestLocale);
r.use("/auth", authIpLimiter, authRouter); // the whole /auth subtree inherits authIpLimiter
```

Because middleware is mounted per segment, an authed group applies its
`verifyJwt + requireXCapability` **once** at the group folder, and every leaf below
it is guaranteed to sit behind it — **the auth / IDOR boundary is the folder
boundary.**

## Input validation lives at the leaf

Each leaf route validates its request with
`validateReq("body" | "query" | "params", Schema)` using the matching
`@tagly/models` schema, before the controller runs.

## Conventions

- One `index.ts` per folder; it owns mounting + middleware for that segment.
- **Folder names are URL segments** (`customers`, not `customerApp`). The
  `controllers/` and `models/` trees use the `…App` suffix; the `routes/` tree
  follows the URL.
- **All new routing follows this convention** — `v2/` is the canonical example.
