# backend utils — index

> Every util, grouped by domain (the lifecycle buckets were collapsed on 2026-09-01 — one version, one tree). Check here before adding a util; put new ones in the matching domain folder.
> **Auto-generated** by `yarn gen:index` (tagly-backend/scripts/genIndex.mjs). Do not edit by hand; re-run after changes.

## advertisers/

| Exports | File | Purpose |
| --- | --- | --- |
| `createAdvertiserWithUniqueUid` | advertisers/createAdvertiserWithUniqueUid.ts | Advertiser creation. Advertisers are passwordless (OTP / Google / Apple |

## auth/

| Exports | File | Purpose |
| --- | --- | --- |
| `getAdvertiserRegistrationResumeState` | auth/getAdvertiserRegistrationResumeState.ts | Onboarding "resume state" derived from a PendingAdvertiserAccount — the facts |
| `getAdvertiserResumeStateByToken` | auth/getAdvertiserResumeStateByToken.ts | Load a pending advertiser's onboarding resume state by registration token. |
| `getCustomerResumeStateByToken` | auth/getCustomerResumeStateByToken.ts | Load a pending customer's onboarding resume state by registration token. |
| `getRegistrationResumeState` | auth/getRegistrationResumeState.ts | Onboarding "resume state" derived from a PendingCustomer — the facts the |
| `OAuthSignInResult, handleOAuthSignIn` | auth/handleOAuthSignIn.ts | Resolves a verified Google/Apple identity into a login or a registration — |
| `hashPassword, verifyPassword` | auth/hashPassword.ts | Argon2id password hashing (admin auth — advertisers and customers are |
| `isCustomerProfileComplete` | auth/isCustomerProfileComplete.ts | A customer's onboarding profile is complete once they have a full name — the |
| `issueSessionJwt` | auth/issueSessionJwt.ts | Signs a session JWT for any account type (customer or advertiser). The single |
| `createAdminLoginOtpSessionAndSendEmail` | auth/otp/createAdminLoginOtpSession.ts | Creates (or replaces) the admin's LOGIN OTP session with a fresh 64-hex code |
| `generateNumericOtpAndHash, generateLongCodeAndHash` | auth/otp/generateOtp.ts | Generates a long, high-entropy code (32 random bytes → 64 hex chars) + bcrypt |
| `resendOtpForSession` | auth/otp/resendOtpForSession.ts | Re-point the session at a new email as part of this send. Updated together |
| `resolveOtpSubjectLanguage, resolveOtpSessionLanguage` | auth/otp/resolveOtpSubjectLanguage.ts | Resolves the preferred language for an OTP subject (the entity the session |
| `OtpSubject, startOrResendOtpSession` | auth/otp/startOrResendOtpSession.ts | Subject entity that the OTP session belongs to. |
| `verifyOtpForSessionOrThrow` | auth/otp/verifyOtpForSessionOrThrow.ts | Verifies an OTP code against a stored session. |
| `VerifiedIdToken, verifyOidcIdToken` | auth/verifyOidcIdToken.ts | Verifies a Google / Apple OpenID Connect **ID token** (an RS256 JWT) against |

## aws/

| Exports | File | Purpose |
| --- | --- | --- |
| `BusinessTagValidationClassification, BusinessTagValidationResult, rek…` | aws/rekognition/rekognitionValidateBusinessTagged.ts | Rekognition business-tag validator (v2). |
| `validateRekognitionImage` | aws/rekognition/validateRekognitionImage.ts | Client-facing slot label ("banner", "photos.2") for errors[].path. |
| `copyS3ObjectSafe` | aws/s3/copyS3ObjectSafe.ts | optional: verify exists |
| `deleteS3KeysOrThrow` | aws/s3/deleteS3KeysOrThrow.ts | — |
| `cdnUrlFromKey` | aws/s3/helpers/cdnUrlFromKey.ts | Build a public CDN URL from an S3 object key. |
| `createLocalBannerKey, createLocalMediaKey, createShareMediaKey, creat…` | aws/s3/helpers/createMediaKeys.ts | S3 object-key builders for every media kind (local banners/media, share |
| `ensureMimeMatches` | aws/s3/helpers/ensureMimeMatches.ts | — |
| `getImageMeta` | aws/s3/helpers/getImageMeta.ts | Fetch an image object from S3 and read its metadata via sharp. |
| `head` | aws/s3/helpers/head.ts | — |
| `presignUploadToS3` | aws/s3/presignUploadToS3.ts | 5 minutes — a create can carry a banner + BUSINESS_MAX_PHOTOS images at |
| `promotePendingMedia, promoteOnePendingMedia` | aws/s3/promotePendingMedia.ts | — |
| `uploadRemoteMediaToS3` | aws/s3/upload/uploadRemoteMediaToS3.ts | Download a remote media URL and upload it to S3, returning the stored key, |
| `PendingImageSlot, ImageCopy, validateAndCopyImages` | aws/s3/validation/validateAndCopyImages.ts | Batch validator+copier for image uploads. |
| `ValidateUploadOptions, ValidatedImageUpload, validatePresignedImageUp…` | aws/s3/validation/validatePresignedImageUpload.ts | Client-facing slot label ("banner", "photos.2") attached as |

## businesses/

| Exports | File | Purpose |
| --- | --- | --- |
| `LOW_BUDGET_THRESHOLD_CENTS, isInLowBudgetWarningBand, businessVisible…` | businesses/businessAccessibility.ts | Single source of truth for business (local subaccount) **accessibility** — the |
| `getCustomerSharedVerticals` | businesses/discover/getCustomerSharedVerticals.ts | The set of verticals a customer has actually shared into — derived from the |
| `AudienceLocationPoint, getTopAudienceLocations` | businesses/discover/getTopAudienceLocations.ts | The customer's top `n` Instagram audience locations (highest follower count |
| `verticalsForInterests, typeSlugsForVerticals` | businesses/discover/verticalMatching.ts | Pure catalog lookups shared by the Discover ranking endpoints |
| `getBusinessShareTags` | businesses/getBusinessShareTags.ts | The set of names a customer's Instagram story can show to validate a share for a |
| `assertBusinessCountryMatchesAdvertiserLocaleOrThrow` | businesses/write/assertBusinessCountryMatchesAdvertiserLocaleOrThrow.ts | Enforce the advertiser-locale ↔ business-country invariant: an advertiser |
| `assertBusinessTextsAllowedOrThrow` | businesses/write/assertBusinessTextsAllowedOrThrow.ts | Profanity-gate the customer-surfaced text fields of a business page (4951 on |
| `BusinessWriteActor, pendingBusinessOwnerId, businessWriteScopeWhere, …` | businesses/write/businessWriteActor.ts | Who is performing a business-page write. The create/update cores in this |
| `createBusinessConfirmCore` | businesses/write/createBusinessConfirmCore.ts | Phase 2 of creating a business page — the shared orchestration behind the |
| `createBusinessInitCore` | businesses/write/createBusinessInitCore.ts | Phase 1 of creating a business page (local subaccount) — the shared |
| `GeocodedBusinessAddress, geocodeBusinessAddressOrThrow` | businesses/write/geocodeBusinessAddressOrThrow.ts | Geocoder-normalized fields — the single source of truth to persist. |
| `BusinessPendingMediaRow, createBusinessPendingMedia, presignBusinessP…` | businesses/write/media/createBusinessPendingUploads.ts | Create one `PendingMedia` row for a business banner or gallery photo — the |
| `validateAndCopyBusinessImages` | businesses/write/media/validateAndCopyBusinessImages.ts | The business-media validate/copy batch shared by create confirm and media |
| `normalizeInstagramTag` | businesses/write/normalizeInstagramTag.ts | Normalize a business's Instagram handle the same way the customer side does: |
| `replaceOpeningHours` | businesses/write/replaceOpeningHours.ts | Replace a business's opening hours wholesale inside an existing transaction: |
| `DesiredLinkSlots, CurrentLinkSlots, ResolvedLinkChanges, resolveBusin…` | businesses/write/resolveBusinessLinkChanges.ts | `undefined` = leave unchanged, `null` = clear, string = set to this URL. |
| `resolveBusinessTypeBySlugOrThrow` | businesses/write/resolveBusinessTypeBySlugOrThrow.ts | Resolve a business-type catalog slug (the v2 wire form) to its DB id. |
| `updateBusinessCore` | businesses/write/updateBusinessCore.ts | Edit a business page — the shared orchestration behind the advertiser |
| `updateBusinessMediaConfirmCore` | businesses/write/updateBusinessMediaConfirmCore.ts | Phase 2 of editing a business page's banner/photos — the shared |
| `updateBusinessMediaInitCore` | businesses/write/updateBusinessMediaInitCore.ts | Phase 1 of editing a business page's banner/photos — the shared |

## clients/

| Exports | File | Purpose |
| --- | --- | --- |
| `geoPlacesClient` | clients/aws/geoPlaces.ts | Amazon Location Service — Places API (forward geocoding). Auth is IAM via the |
| `rekognitionClient` | clients/aws/rekognition.ts | Timeouts (E061 follow-up): the SDK default is NO timeout at all, so a hung |
| `s3Client` | clients/aws/s3.ts | Timeouts (E061 follow-up): the SDK default is NO timeout at all, so a hung |
| `getPostHog, shutdownPostHog` | clients/posthog.ts | Flush + close the batch. Call from every process's shutdown path. |
| `redis, shutdownRedis` | clients/redis.ts | Shared Redis (ElastiCache Valkey) client singleton, imported wherever we need a |
| `resendClient` | clients/resend.ts | — |
| `stripe` | clients/stripe.ts | — |

## core/

| Exports | File | Purpose |
| --- | --- | --- |
| `withAdvisoryLock` | core/db/advisoryLock.ts | Runs a callback while holding a PostgreSQL session-level advisory lock. |
| `applyOffsetPagination, hasMoreFromPage` | core/db/applyOffsetPagination.ts | Offset-pagination helpers shared by every paginated controller. The wire |
| `readRdsCa` | core/db/rdsCa.ts | The RDS CA bundle used by every SSL-enabled Postgres connection, read once |
| `captureServerEvent` | core/errors/captureServerEvent.ts | The single product-analytics sink for backend-emitted events — the analytics |
| `CustomError, CustomErrorOptions, createCustomError, isCustomError` | core/errors/createCustomError.ts | Worker retry axis: when true, the job runner fails the job terminally |
| `logError` | core/errors/logError.ts | Structured error logging for the API's central error handler (and 404s). |
| `ErrorSource, ErrorClass, ReportErrorContext, reportError` | core/errors/reportError.ts | The single error-tracking sink for the whole backend — the API request path |
| `asyncHandler` | core/http/asyncHandler.ts | — |
| `fetchJSONWithAbort` | core/http/fetchJSONWithAbort.ts | Fetch JSON with a hard timeout, throwing a `CustomError` (carrying the |
| `fetchWithTimeout` | core/http/fetchWithTimeout.ts | `fetch` with a hard timeout via `AbortController`. Returns the raw `Response` |
| `headerOr` | core/http/headerOr.ts | Read a request header as a single trimmed string, falling back when it's |
| `sleep` | core/sleep.ts | — |
| `generateReferralCode` | core/uids/generateReferralCode.ts | — |
| `generateSecureToken` | core/uids/generateSecureToken.ts | Generates a cryptographically-secure random token: a 64-char hex string |
| `generateUid` | core/uids/generateUid.ts | — |
| `getEntityFromUid` | core/uids/getEntityFromUid.ts | — |

## customers/

| Exports | File | Purpose |
| --- | --- | --- |
| `multiplierDeltaForStars, adjustCustomerMultiplierBps` | customers/adjustCustomerMultiplierBps.ts | Customer rolling-multiplier bookkeeping. Version-coupled on purpose: it reads |
| `assertCustomerNotBannedOrThrow` | customers/assertCustomerNotBannedOrThrow.ts | Throws if the customer is BANNED. BANNED customers can still log in, but are |
| `createCustomerWithUniqueUid` | customers/createCustomerWithUniqueUid.ts | Creates a customer record with a unique UID, retrying on collision. |

## email/

| Exports | File | Purpose |
| --- | --- | --- |
| `acquireEmailSendBudget` | email/acquireEmailSendBudget.ts | Global (cross-process, Redis-backed) send-rate budget for WORKER email |
| `PromoEmailTag, EMAIL_ENV_TAG_NAME, PromoEmailTagData, buildPromoEmail…` | email/promoEmailTags.ts | Resend analytics tags stamped on outbound sends — the PROMO attribution |
| `sendEmail` | email/sendEmail.ts | The canonical **product** email sender: wraps the body in one of the two |
| `sendOTPEmail` | email/sendOTPEmail.ts | Bilingual OTP email template. Inlined here because this is its only consumer |
| `sendTeamAlertEmail` | email/sendTeamAlertEmail.ts | Send an internal operational alert to the Tagly team (withdrawals.md D4). This |
| `buildMarketingEmailHTML` | email/templates/buildMarketingEmailHTML.ts | Visible headline inside the masthead (Playfair, reversed on ink). |
| `htmlToPlainText, buildPlainTextEmail` | email/templates/buildPlainTextEmail.ts | Same headline the HTML part renders. |
| `EMAIL_SIGN_OFF, buildTransactionalEmailHTML` | email/templates/buildTransactionalEmailHTML.ts | Visible headline in the email body (Playfair). Omit for headline-less mail. |
| `escapeEmailHtml` | email/templates/escapeEmailHtml.ts | Escape interpolated text for safe use in email HTML — element text AND |
| `EMAIL_CTA_LABELS, resolveEmailCtaLink, renderEmailButton` | email/templates/renderEmailButton.ts | Which app the CTA opens — resolves to that app's OneLink for this stage. |
| `EMAIL_FOOTER_STRINGS, renderEmailFooter` | email/templates/renderEmailFooter.ts | `compact` — the transactional footer: left-aligned text links only, no |
| `renderEmailShell` | email/templates/renderEmailShell.ts | Document title (browser tab / some clients' header). |
| `UnsubscribeTokenPayload, signUnsubscribeToken, verifyUnsubscribeToken…` | email/unsubscribeToken.ts | Utilities for signing and verifying one-click email unsubscribe tokens. |

## formatting/

| Exports | File | Purpose |
| --- | --- | --- |
| `asBigInt` | formatting/asBigInt.ts | Converts bigint \| number \| string \| null \| undefined to bigint. |
| `bpsOfCents` | formatting/bpsOfCents.ts | round half-up for basis points (e.g., 30% = 3000 bps) |
| `escapeHtml` | formatting/escapeHtml.ts | Escape a user-supplied string so it can't inject markup into HTML — e.g. when |
| `getExtensionFromMime` | formatting/getExtensionFromMime.ts | — |
| `getMediaTypeFromMime` | formatting/getMediaTypeFromMime.ts | — |
| `validateCurrencyIsSupportedOrThrow` | formatting/validateCurrencyIsSupportedOrThrow.ts | Normalizes a currency string (`.trim().toLowerCase()`) and asserts it's in |

## geo/

| Exports | File | Purpose |
| --- | --- | --- |
| `AddressInput, GeocodedAddress, geocodeAddressOrReturn` | geo/geocodeAddressOrReturn.ts | Loose result from Amazon Location Service (Places / Geocode). lat/lon are the |
| `Coords, StrictGeocodedAddress, geocodeAddressOrThrow` | geo/geocodeAddressOrThrow.ts | Strictly-validated geocode for flows that need a full address (e.g. local |
| `getTimezoneForCoordinates` | geo/getTimezoneForCoordinates.ts | Resolve the IANA timezone (e.g. "America/New_York") for a geographic point. |
| `resolveCzechRegion` | geo/resolveCzechRegion.ts | If `region` is a recognizable Czech kraj (any of its English/Czech variants), |

## hydrators/

| Exports | File | Purpose |
| --- | --- | --- |
| `adminGetNotificationPrefs` | hydrators/admin/adminGetNotificationPrefs.ts | The per-event EFFECTIVE push/email state for one account — the admin-detail |
| `adminHydrateAdvertiser` | hydrators/admin/adminHydrateAdvertiser.ts | Latest period of each card-charging feature: open = on; closed = its |
| `adminHydrateCustomer` | hydrators/admin/adminHydrateCustomer.ts | Share aggregate stats (customer-facing: all their shares, unfiltered). |
| `adminHydrateLedgerEvents` | hydrators/admin/adminHydrateLedgerEvents.ts | Hydrates transaction-ledger events into `AdminLedgerEvent`s, preserving the |
| `adminHydrateLocal` | hydrators/admin/adminHydrateLocal.ts | Batch share statistics per local, over APPROVED shares only (what the |
| `adminHydrateShare` | hydrators/admin/adminHydrateShare.ts | Hydrates shares into the full admin view, preserving input order. Shows the |
| `hydrateAdvertiserReferrals` | hydrators/advertisers/hydrateAdvertiserReferrals.ts | Referral state for `GET /v2/advertisers/me/referrals` — the advertiser's own |
| `hydrateAdvertiserStatistics` | hydrators/advertisers/hydrateAdvertiserStatistics.ts | Lifetime advertiser statistics for `GET /v2/advertisers/me/statistics`. |
| `deriveMonthlyBudgetStatus` | hydrators/billing/deriveMonthlyBudgetStatus.ts | The single derivation of the wire `MonthlyBudgetStatus` — used by both |
| `derivePaygStatus` | hydrators/billing/derivePaygStatus.ts | The single derivation of the wire `PaygStatus` — used by both |
| `deriveWithdrawalDisplayState` | hydrators/billing/deriveWithdrawalDisplayState.ts | Collapse a `StripeWithdrawal`'s raw, overloaded ledger `status` plus its |
| `hydrateBusinessOwnerDetails` | hydrators/businesses/hydrateBusinessOwnerDetails.ts | Hydrates one of the advertiser's own businesses into `BusinessOwnerDetails` |
| `hydrateBusinessPublicDetails` | hydrators/businesses/hydrateBusinessPublicDetails.ts | Hydrates one business into `BusinessPublicDetails` for the customer detail page: |
| `hydrateBusinessPublicPreviews` | hydrators/businesses/hydrateBusinessPublicPreviews.ts | Hydrates a set of businesses (local subaccounts) into `BusinessPublicPreview` |
| `hydrateCustomerMe` | hydrators/customers/hydrateCustomerMe.ts | Builds the lean `CustomerMe` DTO for `GET /v2/customers/me`. One Prisma read, |
| `hydrateCustomerReferrals` | hydrators/customers/hydrateCustomerReferrals.ts | Referral state for `GET /v2/customers/me/referrals` — the customer's own code |
| `hydrateCustomerStatistics` | hydrators/customers/hydrateCustomerStatistics.ts | Lifetime sharing statistics for `GET /v2/customers/me/statistics`. |
| `deriveAdvertiserShareStatus` | hydrators/shares/deriveAdvertiserShareStatus.ts | Derive the single advertiser-facing share status from the payout `status` and |
| `deriveCustomerShareStatus` | hydrators/shares/deriveCustomerShareStatus.ts | Derive the single customer-facing share status from the three internal axes |
| `hydrateAdvertiserShareDetails` | hydrators/shares/hydrateAdvertiserShareDetails.ts | Hydrates one share into `AdvertiserShareDetails` for the detail screen: the |
| `hydrateAdvertiserSharePreviews` | hydrators/shares/hydrateAdvertiserSharePreviews.ts | Hydrates a set of share ids into `AdvertiserSharePreview`s, preserving the |
| `hydrateCustomerShareDetails` | hydrators/shares/hydrateCustomerShareDetails.ts | Hydrates one share into `CustomerShareDetails` for the detail page: the shared |
| `hydrateCustomerSharePreviews` | hydrators/shares/hydrateCustomerSharePreviews.ts | Hydrates a set of share ids into `CustomerSharePreview`s, preserving the input |

## instagram/

| Exports | File | Purpose |
| --- | --- | --- |
| `AudienceCityBucket, AudienceCityBreakdown, fetchAudienceCityBreakdown…` | instagram/accountInsights/fetchAudienceCityBreakdownFromIG.ts | Fetches a raw audience city breakdown from the Instagram insights API — |
| `getAudienceGenderAgeFromIG` | instagram/accountInsights/getAudienceGenderAgeFromIG.ts | Fetch top audience gender/age buckets with coverage-based selection. |
| `getUserDataFromIG` | instagram/accountInsights/getUserDataFromIg.ts | Fetch basic user data from the Instagram Graph API. |
| `GeocodeMemo, geocodeAudienceLocation` | instagram/accountInsights/helpers/geocodeAudienceLocations.ts | Per-job geocode memo: normalized "city\|region" → result. Negative results |
| `AudienceLocationRow, selectAndGeocodeAudienceLocations` | instagram/accountInsights/helpers/selectAndGeocodeAudienceLocations.ts | Selects + geocodes the top city buckets of an audience breakdown until the |
| `assertInstagramNotBannedOrThrow` | instagram/assertInstagramNotBannedOrThrow.ts | Throws if the given Instagram account is on the persistent ban-list |
| `deleteCustomerInstagramData` | instagram/deleteCustomerInstagramData.ts | Deletes all Instagram-related data for a customer. |
| `getStoryInsights` | instagram/mediaInsights/getStoryInsights.ts | Pull a simple IG insights metric's scalar value out of the `data` array by name. |
| `throwForBadResponse` | instagram/mediaInsights/helpers/throwForBadResponse.ts | The ONLY Meta errors that fail a job terminally. Both mean the token itself is |
| `checkUserInstagramPermission` | instagram/permission/checkUserInstagramPermission.ts | Verifies that the user has granted instagram_manage_insights permission. |
| `customerHasSnapshot` | instagram/snapshots/customerHasSnapshot.ts | Canonical "does this customer have an Instagram audience snapshot yet?" check — |
| `getLatestSnapshot` | instagram/snapshots/getLatestSnapshot.ts | Canonical "latest Instagram snapshot for a customer" query — the single |
| `exchangeIGCodeForToken` | instagram/tokens/exchangeIGCodeForToken.ts | Exchange an OAuth code for a short-lived IG token. |
| `getAndEncryptIgLongLivedToken` | instagram/tokens/getAndEncryptIgLLT.ts | Get a long-lived IG token from a short-lived token. |
| `getDecryptedInstagramTokenForCustomer` | instagram/tokens/getDecryptedIgTokenForCustomer.ts | Retrieves and decrypts the Instagram access token for a customer. |
| `encryptIgToken, decryptIgToken` | instagram/tokens/igTokenEnc.ts | map to your error shape; DO NOT log the token |
| `refreshIgLongLivedTokenOrThrow` | instagram/tokens/refreshIgTokenOrThrow.ts | Exchanges a still-valid long-lived Instagram token for a fresh one via the |
| `saveIgTokenToDb` | instagram/tokens/saveIgTokenToDb.ts | Encrypts and upserts an Instagram access token for an IG account row. |
| `getStoriesFromInstagram` | instagram/userMedia/getStoriesFromInstagram.ts | Fetch the user's active Instagram stories from the Instagram Graph API. |
| `getUnsharedLiveStories` | instagram/userMedia/getUnsharedLiveStories.ts | The customer's currently-live Instagram stories that are still **eligible for a |
| `parseInstagramSignedRequest` | instagram/webhooks/parseInstagramSignedRequest.ts | — |

## localization/

| Exports | File | Purpose |
| --- | --- | --- |
| `getCountryForTimezone` | localization/getCountryForTimezone.ts | IANA-timezone → ISO alpha-2 country code (supported locales only). Unknown |
| `normalizeLanguage` | localization/localizeCatalog.ts | Display labels for verticals / advertiser types / interests / notification |
| `validateLanguageIsSupportedOrThrow` | localization/validateLanguageIsSupportedOrThrow.ts | Normalizes a language string (`.trim().toLowerCase()`) and asserts it's in |
| `validateLocaleIsSupportedOrThrow` | localization/validateLocaleIsSupportedOrThrow.ts | Normalizes a locale string (`.trim().toUpperCase()`) and asserts it's in |

## moderation/

| Exports | File | Purpose |
| --- | --- | --- |
| `assertTextAllowedOrThrow` | moderation/assertTextAllowedOrThrow.ts | Rejects user-authored text that contains profanity or slurs (EN via the |
| `UrlSafety, checkUrlSafety` | moderation/checkUrlSafety.ts | `"unsafe"` — Google flagged it. `"safe"` — not flagged. `"unknown"` — we |
| `upsertLink` | moderation/upsertLink.ts | Find or create the shared, de-duplicated `Link` for a URL and return its id + |

## money/

| Exports | File | Purpose |
| --- | --- | --- |
| `hasAdvertiserEverPurchasedCredits, CREDIT_PURCHASE_LEDGER_EVENT_WHERE…` | money/ledger/advertiserCreditPurchases.ts | Lifetime advertiser credit purchases, derived from the ledger on read. |
| `applyBalancesFromEvent` | money/ledger/applyBalancesFromEvent.ts | Applies an event's deltas to the per-currency balance columns on the |
| `CreateLedgerEventInput, createLedgerEvent` | money/ledger/createLedgerEvent.ts | at least one delta must be non-zero |
| `createPromotionalCreditEvent` | money/ledger/events/createPromotionalCreditEvent.ts | Creates a PROMOTIONAL_CREDIT ledger event: credits an advertiser's |
| `createReferralPayoutEvent` | money/ledger/events/createReferralPayoutEvent.ts | Tell it who to pay by providing exactly one of advertiserId OR customerId. |
| `createAdvertiserCreditPurchase` | money/ledger/events/creditPurchase/createAdvertiserCreditPurchaseEvent.ts | Idempotency on (externalRef, kind) |
| `lockBudgetForCreditPurchaseRefund` | money/ledger/events/creditPurchase/lockBudgetForCreditPurchaseRefund.ts | Lock budget for a credit-purchase refund (available → locked). |
| `refundAdvertiserCreditPurchase, getPendingLockedAmount` | money/ledger/events/creditPurchase/refundAdvertiserCreditPurchase.ts | Create a CREDIT_PURCHASE_REFUND event with idempotency on (externalRef, kind). |
| `unlockBudgetForFailedCreditPurchaseRefund` | money/ledger/events/creditPurchase/unlockBudgetForFailedCreditPurchaseRefund.ts | Unlock budget after a credit-purchase refund fails (locked → available). |
| `forfeitRemainingBalanceToPlatformOnAccountDeletion` | money/ledger/events/forfeitRemainingBalanceToPlatformOnAccountDeletion.ts | Customer twin of `forfeitRemainingBudgetToPlatformOnAccountDeletion`: zero out |
| `forfeitRemainingBudgetToPlatformOnAccountDeletion` | money/ledger/events/forfeitRemainingBudgetToPlatformOnAccountDeletion.ts | This helper is only meant to run when there is a positive net budget. |
| `createPaygChargeEvent` | money/ledger/events/payg/createPaygChargeEvent.ts | Books a PAYG_CHARGE: an advertiser's saved card charged off-session to fund a |
| `lockBudgetForShare` | money/ledger/events/sharePayment/lockBudgetForShare.ts | Reserves funds for a share by locking 150% of the estimated price |
| `settleSharePayoutAndUnlockRemainder` | money/ledger/events/sharePayment/settleSharePayoutAndUnlockRemainder.ts | Settle an advertiser-funded share: pay the customer the FULL gross price, |
| `settleSubsidizedSharePayout` | money/ledger/events/sharePayment/settleSubsidizedSharePayout.ts | Settles a subsidized share payout. |
| `SHARE_LOCK_META_KEYS` | money/ledger/events/sharePayment/shareLockMeta.ts | The keys Tagly writes into a SHARE_LOCK ledger event's `meta` JSON, single- |
| `unlockLockedBudgetForShare` | money/ledger/events/sharePayment/unlockLockedBudgetForShare.ts | Pull the original SHARE_LOCK event so we can mirror its currency on the |
| `unlockPlatformBudgetForShare` | money/ledger/events/sharePayment/unlockPlatformBudgetForShare.ts | Unlocks platform budget that was locked for a subsidized share. |
| `createWithdrawalFromLocked` | money/ledger/events/withdrawals/createWithdrawalFromLocked.ts | Secondary idempotency guard by withdrawal linkage (helps reconciliation) |
| `lockBalanceForWithdrawal` | money/ledger/events/withdrawals/lockBalanceForWithdrawal.ts | Source-of-truth: currency comes from the StripeWithdrawal row that the |
| `reverseWithdrawalFromTransfer` | money/ledger/events/withdrawals/reverseWithdrawalFromTransfer.ts | nothing meaningful reversed |
| `unlockBalanceForFailedWithdrawal` | money/ledger/events/withdrawals/unlockBalanceForFailedWithdrawal.ts | Source-of-truth: currency comes from the StripeWithdrawal row. |
| `maybeQueueAdvertiserBudgetNotificaions` | money/ledger/helpers/maybeQueueAdvertiserBudgetNotifications.ts | Best-effort advertiser notifications fired after a ledger event changes the |
| `maybeQueueCustomerBalanceNotificaions` | money/ledger/helpers/maybeQueueCustomerBalanceNotifications.ts | Amount formatted server-side as plain USD (no locale/rate machinery in |
| `AnyNumber` | money/ledger/helpers/types.ts | — |
| `closeMonthlyBudgetPeriod` | money/monthlyBudget/closeMonthlyBudgetPeriod.ts | Closes the advertiser's open monthly-budget period (if any), recording why. |
| `nextMonthlyBudgetRunAt, monthlyBudgetPeriodKey` | money/monthlyBudget/monthlyBudgetSchedule.ts | Calendar helpers for the monthly-budget run. Everything is UTC: a "month" |
| `openMonthlyBudgetPeriod` | money/monthlyBudget/openMonthlyBudgetPeriod.ts | Opens the advertiser's monthly-budget period at `targetCents`. Periods are |
| `MonthlyBudgetTopUpOutcome, formatUsdCents, runMonthlyBudgetTopUp` | money/monthlyBudget/runMonthlyBudgetTopUp.ts | Outcome of one run. |
| `closePaygPeriod` | money/payg/closePaygPeriod.ts | Closes the advertiser's open PAYG period (if any), recording why. |
| `openPaygPeriod` | money/payg/openPaygPeriod.ts | Opens a PAYG period for the advertiser. |
| `LinkCardFromSetupIntentResult, linkCardFromSetupIntent` | money/savedCard/linkCardFromSetupIntent.ts | Not a card-link intent we own (e.g. a PaymentSheet top-up saving its card). |
| `removeSavedCard` | money/savedCard/removeSavedCard.ts | Unlink the advertiser's saved off-session card. The ONLY card-clearer, and |
| `OffSessionChargeResult, OffSessionChargeFlow, chargeAdvertiserCardOff…` | money/stripe/chargeAdvertiserCardOffSession.ts | Credited (useful) amount — what funds the budget (gross − surcharge). |
| `ChargeRetryPolicy, chargeRetryBackoffMs` | money/stripe/chargeRetryBackoffMs.ts | The two backoff tunables every off-session charge retry ladder carries. |
| `CreditPurchaseIntent, createAdvertiserCreditPurchaseIntent` | money/stripe/createAdvertiserCreditPurchaseIntent.ts | The native PaymentSheet handoff for a freshly-created credit purchase. |
| `CardSetupIntent, createOffSessionCardSetupIntent` | money/stripe/createOffSessionCardSetupIntent.ts | The native PaymentSheet handoff for a card-link SetupIntent. |
| `ensureStripeCustomerForAdvertiser` | money/stripe/ensureStripeCustomerForAdvertiser.ts | Returns the advertiser's Stripe customer id, creating the Stripe customer (and |
| `ensureStripeExpressAccountForCustomer` | money/stripe/ensureStripeExpressAccountForCustomer.ts | Ensures a customer has a Stripe Express Connect account. |
| `completeOffSessionChargeRow, failOffSessionChargeRow` | money/stripe/offSessionChargeRow.ts | The two terminal-state writes on an off-session charge's |
| `STRIPE_PAYMENT_PURPOSE, CREDIT_PURCHASE_PURPOSES, StripePaymentPurpose` | money/stripe/paymentMetadataPurpose.ts | Single source of truth for the **Stripe payment-metadata `purpose`** vocabulary |
| `retrieveAvailableStripeBalance` | money/stripe/retrieveAvailableStripeBalance.ts | Fetches the platform's Stripe balance and subtracts all funds assigned to |
| `isDefinitiveStripeRejection, stripeErrorFailureFields` | money/stripe/stripeErrorClassification.ts | Split Stripe SDK errors into DEFINITIVE rejections vs AMBIGUOUS failures — the |
| `handleConnectAccountUpdated` | money/stripe/webhookHandlers/connect/handleConnectAccountUpdated.ts | Payouts just enabled |
| `handleExternalAccountChanged` | money/stripe/webhookHandlers/connect/handleExternalAccountChanged.ts | `account.external_account.created` / `account.external_account.updated` — the |
| `handlePayoutCanceled` | money/stripe/webhookHandlers/connect/handlePayoutCanceled.ts | `payout.canceled` — a manual payout was canceled before reaching the bank; |
| `handlePayoutFailed` | money/stripe/webhookHandlers/connect/handlePayoutFailed.ts | `payout.failed` — the bank rejected the payout and Stripe returned the funds to |
| `handlePayoutNotPaid` | money/stripe/webhookHandlers/connect/handlePayoutNotPaid.ts | Shared body for `payout.failed` and `payout.canceled` — the two are money-wise |
| `handlePayoutPaid` | money/stripe/webhookHandlers/connect/handlePayoutPaid.ts | Only handle payouts that belong to Tagly withdrawal flows (the Connect |
| `handleDisputeEvent` | money/stripe/webhookHandlers/platform/handleDisputeEvent.ts | Handles `charge.dispute.created` and `charge.dispute.closed` — chargebacks |
| `handlePaymentIntentFailed` | money/stripe/webhookHandlers/platform/handlePaymentIntentFailed.ts | Handles payment_intent.payment_failed and payment_intent.canceled events. |
| `handlePaymentIntentSucceeded` | money/stripe/webhookHandlers/platform/handlePaymentIntentSucceeded.ts | Handles payment_intent.succeeded events for credit purchases — both the |
| `handleRefundEvent` | money/stripe/webhookHandlers/platform/handleRefundEvent.ts | Handles refund.created and refund.updated events for advertiser charges — |
| `handleSetupIntentSucceeded` | money/stripe/webhookHandlers/platform/handleSetupIntentSucceeded.ts | Handles setup_intent.succeeded events for payment method setup — the |
| `handleTransferReversed` | money/stripe/webhookHandlers/platform/handleTransferReversed.ts | Handles transfer.reversed events for withdrawals (both customer withdrawals |
| `recalcCreditPurchaseRefundStatus` | money/stripe/webhookHandlers/platform/recalcCreditPurchaseRefundStatus.ts | Re-derive a StripeCreditPurchase's REFUNDED / PARTIALLY_REFUNDED status from |
| `PendingAdvertiserNotification, PendingCustomerNotification, ConnectPa…` | money/stripe/webhookHandlers/types.ts | Result of a payout.failed / payout.canceled handler. Carries the (best-effort) |
| `createStandardWithdrawalPayoutOrThrow, isDefinitivePayoutCreateFailur…` | money/withdrawals/createStandardWithdrawalPayoutOrThrow.ts | Create the **standard** Stripe payout that moves a withdrawal's funds from the |
| `sendPayoutRetriesExhaustedAlert` | money/withdrawals/sendPayoutRetriesExhaustedAlert.ts | D4 ops escalation: a withdrawal's payout has failed its final allowed attempt, |
| `WITHDRAWAL_PURPOSE_WIRE, WithdrawalPurposeWire, toWireWithdrawalPurpo…` | money/withdrawals/withdrawalPurpose.ts | The single source of truth for the withdrawal `purpose` vocabulary across its |
| `recordTransferSucceeded, recordTransferFailed, recordSettled, recordP…` | money/withdrawals/withdrawalTransitions.ts | The single owner of `StripeWithdrawal` state transitions (withdrawals.md, "One |
| `withdrawCustomerBalanceToConnectOrThrow` | money/withdrawals/withdrawCustomerBalanceToConnectOrThrow.ts | Cash out a customer's Tagly balance to their Stripe Connect account, as a |

## notifications/

| Exports | File | Purpose |
| --- | --- | --- |
| `getVerifiedResendDomainsOrThrow` | notifications/getVerifiedResendDomainsOrThrow.ts | The domain names an admin blast may send from. Used by the admin blast |
| `resolveEffectiveChannels` | notifications/resolveEffectiveChannels.ts | The one channel-resolution rule for notification delivery — shared by |
| `resolveRecipientAnalyticsId` | notifications/resolveRecipientAnalyticsId.ts | Stable pseudonymous analytics identifier for a notification recipient — the |
| `PushTokenOwner, PushTokenMeta, upsertPushToken` | notifications/upsertPushToken.ts | Which account a device's push token belongs to. A token has EXACTLY ONE owner |

## pricing/

| Exports | File | Purpose |
| --- | --- | --- |
| `EstRewardResult, isLowBudgetEstimate, calculateEstPrices` | pricing/calculateEstPrice.ts | The customer-facing "ending soon" (hot-deal / `isLowBudget`) flag for a |
| `ShareFinalPriceResult, calculateFinalPrice` | pricing/calculateFinalPrice.ts | Calculates the final price for a local share and returns all multiplier data. |
| `getEstPricesCached` | pricing/getEstPricesCached.ts | Read-through cache over `calculateEstPrices` for the DISPLAY paths (Discover / |
| `applyPriceCap` | pricing/helpers/applyPriceCap.ts | Applies the final price cap to a computed subtotal. |
| `calculateAccountQualityBps` | pricing/helpers/calculateAccountQualityBps.ts | Decrease-only account-quality multiplier (bps, ≤ 10_000) from the |
| `calculateActionBonusesCents` | pricing/helpers/calculateActionBonusesCents.ts | Action bonuses deliberately price on the RAW insights reach, NOT the |
| `calculateAudienceRelevanceBps` | pricing/helpers/calculateAudienceRelevanceBps.ts | Account-authenticity multiplier, priced off FOLLOWER COUNT (v12). |
| `calculateCustomerRatingBps` | pricing/helpers/calculateCustomerRatingBps.ts | — |
| `calculateDemographicsBps` | pricing/helpers/calculateDemographicsBps.ts | Calculate the demographics multiplier in basis points. |
| `calculateEstBasePrice` | pricing/helpers/calculateEstBasePrice.ts | Fallback reach for customers without Instagram. Only used if real data is unavailable. |
| `calculateFinalBasePrice` | pricing/helpers/calculateFinalBasePrice.ts | The snapshot captured for this share; its followerCount is the baseline the |
| `FrequencyData, fetchFrequencyData, calculateFrequencyBps` | pricing/helpers/calculateFrequencyBps.ts | Prior shares in the trailing 24h, each with its localId (if any). |
| `calculateGeographicsBps` | pricing/helpers/calculateGeographicsBps.ts | Geo: the share of this post's reach that counts as LOCAL, in bps (0..10_000). |
| `calculateInterestsBps` | pricing/helpers/calculateInterestsBps.ts | Interest→Type exact/close > best Vertical↔Vertical > 1.00x |
| `calculateTypeBps` | pricing/helpers/calculateTypeBps.ts | Business-type price multiplier (bps): how much a post for this CATEGORY of |
| `capReachAtFollowerBaseline` | pricing/helpers/capReachAtFollowerBaseline.ts | The follower-baseline reach cap multiplier for a given follower count. |
| `getCountryMultiplierBps` | pricing/helpers/getCountryMultiplierBps.ts | Resolves the country-specific reward multiplier (bps) for a local's ISO |
| `rewardEstKey, bumpCustomerRewardEstGen, bumpBusinessRewardEstGen, bum…` | pricing/rewardEstCache.ts | Cache key for one (customer, business) estimate at the current customer, |

## queue/

| Exports | File | Purpose |
| --- | --- | --- |
| `resolvePromoTimezone, promoJitterSeed, snapToQuietHours` | queue/promoSendTime.ts | Send-time math for promo notifications: timezone resolution + quiet-hours |
| `queueInstagramInsightsJob` | queue/queueInstagramInsightsJob.ts | One insights job per share (enforced by unique shareId). |
| `queueInstagramSnapshotJob` | queue/queueInstagramSnapshotJob.ts | Queue a snapshot job for an Instagram account by inserting an |
| `QueueNotificationJobsArgs, queueNotificationJobs` | queue/queueNotificationJobs.ts | Optional transaction client. When the notification must be atomic with a |
| `queuePromoNotificationJobsOrReturn` | queue/queuePromoNotificationJobsOrReturn.ts | Enqueue promo notification jobs directly from the catalog, applying the |

## referrals/

| Exports | File | Purpose |
| --- | --- | --- |
| `attachReferrerOrThrow` | referrals/attachReferrerOrThrow.ts | Creates the `ReferralEvent` that records "X referred this account" — the link |
| `ReferrerPayee, findReferrer` | referrals/findReferrer.ts | The account owed a referral payout — exactly one owner kind. |
| `REFERRAL_RATES` | referrals/referralRates.ts | Effective referral rates, derived from the backend economics. The referrer is |

## shares/

| Exports | File | Purpose |
| --- | --- | --- |
| `ShareAssessmentAction, claimShareAssessment` | shares/claimShareAssessment.ts | The single once-only share-assessment write, shared by the advertiser |
| `markShareUnpayableAndUnlock` | shares/markShareUnpayableAndUnlock.ts | Atomically voids an in-flight share and releases any budget it locked. This |
| `releaseShareLockIfAny` | shares/releaseShareLockIfAny.ts | Releases whatever budget a share's original `SHARE_LOCK` debited — the one |
| `ADMIN_APPROVED_SHARE_WHERE, ADMIN_APPROVED_SHARE_STATUS, isAdminAppro…` | shares/shareAccess.ts | Single source of truth for **share access/visibility predicates** — the share |

