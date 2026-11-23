# `.well-known/` — universal links & App Links association files

> **One pattern, both hosted apps.** `tagly-redirect` and `tagly-join` each ship an
> extension-less AASA file **plus a `.json` twin**, and each has an
> `amplify-custom-rules.json` rewriting the extension-less path to the twin. They
> arrived at the same fix from different symptoms (redirect 301'd the path outright;
> join served it as `application/octet-stream`), but the twin-plus-rewrite is the only
> mechanism that works for **both** — a static site and a Next.js SSR app — so it is
> the single documented approach. Don't "simplify" one of them back to a
> header-only fix: `customHttp.yml` sets headers *after* routing and cannot rescue a
> path that 301s.

Three files, and the duplication is deliberate.

| File | Served at | Why it exists |
| --- | --- | --- |
| `apple-app-site-association` | *(source of truth — not directly reachable, see below)* | The canonical AASA content Apple expects at the extensionless path. |
| `apple-app-site-association.json` | `/.well-known/apple-app-site-association` **via an Amplify 200-rewrite** | The actually-served copy. Must stay byte-identical to the file above. |
| `assetlinks.json` | `/.well-known/assetlinks.json` | Android App Links. Serves fine as-is (it has an extension). |

## Why the `.json` twin exists (do not "clean this up")

The redirect page is a **plain static site on AWS Amplify Hosting**. Amplify treats a
request for an **extensionless** path as a directory and answers with a **301 to the
trailing-slash form** *before* any header config runs — so
`GET /.well-known/apple-app-site-association` never reaches the file, and
`customHttp.yml` (which only sets response headers) cannot prevent it.

**Apple does not follow redirects when fetching AASA.** A 301 means the domain
association silently never establishes: no iOS universal links, and no
`webcredentials:` (which `ASWebAuthenticationSession` needs for HTTPS callbacks on
iOS 17.4+ — i.e. the Instagram OAuth return).

`assetlinks.json` was never affected because it has a `.json` extension — which is
also the proof this fix works: the same host serves it 200 `application/json`.

The fix is the rewrite rule in `../amplify-custom-rules.json`:

```
/.well-known/apple-app-site-association  ->  /.well-known/apple-app-site-association.json  (200 rewrite)
```

It must sit **above** the `/<*> -> /index.html (404-200)` catch-all — Amplify evaluates
rules top-down, and the catch-all would otherwise swallow it. Serving a `.json` file
also yields the required `application/json` content type automatically.

## If you edit the AASA content

Edit **both** files and keep them byte-identical:

```bash
cp .well-known/apple-app-site-association .well-known/apple-app-site-association.json
```

## Verifying (a check that can actually fail)

```bash
# Must be 200, application/json, and NO 3xx anywhere in the chain.
curl -si https://staging.redirect.tagly.dev/.well-known/apple-app-site-association | head -5
```

A `301` in that output means the rewrite rule is missing from the Amplify app
(console state, not repo state — re-run the deploy workflow's rules-sync step).

What Apple actually fetched and cached:

```bash
curl -s https://app-site-association.cdn-apple.com/a/v1/staging.redirect.tagly.dev
```

Note: iOS caches the association at **install time**. After fixing the file you must
delete and reinstall the app (or use a fresh device) — relaunching is not enough.
