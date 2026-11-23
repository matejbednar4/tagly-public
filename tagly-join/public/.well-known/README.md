# `.well-known/` — universal links & App Links association files (join page)

Same pattern as `tagly-redirect/.well-known/` — **read that README for the full
rationale**; this file only notes what differs here.

| File | Purpose |
| --- | --- |
| `apple-app-site-association` | Source of truth. Extension-less, as Apple requires. |
| `apple-app-site-association.json` | The actually-served copy (via an Amplify 200-rewrite). Keep byte-identical to the file above. |
| `assetlinks.json` | Android App Links. Serves fine as-is. |

## Why the twin, when the extension-less path already returns 200 here

The join page is a **Next.js SSR app**, so it does not suffer the redirect page's
trailing-slash 301 — the file is reachable. Its symptom is different: Amplify serves
Next `public/` assets from S3/CloudFront **bypassing the Next compute layer**, so S3
cannot infer a type from an extension-less key and returns
`application/octet-stream`. Apple documents `application/json` as required.

That also explains why the `headers()` rule in `next.config.ts` never fixed it: it is
correct, but it only runs for requests that reach the Next server — which these never
do in production. It is kept because it *is* correct for `next dev` / `next start` /
self-hosting.

Serving the `.json` twin makes S3 set `application/json` from the extension, which is
the same mechanism `assetlinks.json` has always relied on. `customHttp.yml` in the app
root also sets the header, as belt-and-braces.

## Scope differs from the redirect page

This file lists **customer** appIDs only, with `"paths": ["*"]` — join links are
referral links and the advertiser app does not claim the join hosts (see
`iosAssociatedDomainsByEnv` in `tagly-advertiser/app.config.ts`). The redirect page's
AASA lists all six appIDs and path-scopes them `/customer/*` vs `/advertiser/*`.
There is no `webcredentials` section here; the join hosts are not an OAuth callback
surface.

## If you edit the content

```bash
cp public/.well-known/apple-app-site-association public/.well-known/apple-app-site-association.json
```

## Verify (a check that can fail)

```bash
curl -si https://staging.join.tagly.dev/.well-known/apple-app-site-association | head -5
# must be 200, Content-Type: application/json, and NO 3xx in the chain
```

Prod (`join.taglyapp.com`, `join.tagly.cz`) currently 404s this file: the AASA was
added in commit `fd125a71`, which is not yet on `origin/main` (the join app's
PRODUCTION branch). It resolves when v2 ships to prod.

Remember: iOS resolves the association **at install time** — delete and reinstall the
app to see a change; relaunching is not enough.
