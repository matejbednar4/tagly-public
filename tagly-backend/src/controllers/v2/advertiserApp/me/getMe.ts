import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import {
  isAdvertiserVisible,
  businessOwnerVisibleWhere,
} from "../../../../utils/businesses/businessAccessibility.js";
import { derivePaygStatus } from "../../../../utils/hydrators/billing/derivePaygStatus.js";
import { deriveMonthlyBudgetStatus } from "../../../../utils/hydrators/billing/deriveMonthlyBudgetStatus.js";
import {
  hasAdvertiserEverPurchasedCredits,
  sumAdvertiserCreditPurchasesCents,
} from "../../../../utils/money/ledger/advertiserCreditPurchases.js";
import {
  LATEST_TERMS_OF_SERVICE_RELEASE_DATE,
  LATEST_PRIVACY_POLICY_RELEASE_DATE,
} from "../../../../constants/platform/TERMS.js";

/**
 * `GET /v2/advertisers/me` — return the logged-in advertiser's lean core
 * profile (`AdvertiserMe`). Pure read. The (app) shell fetches it on sign-in:
 * the derived `funded` / `hasBusinessPage` facts drive the setup gate (a step
 * shows while its fact is unsatisfied and not dismissed on the device — the
 * "skipped" fact is a device-local flag, not server state), and `locale`
 * drives the PAYG consent checkbox. Bulkier slices (balance, business pages,
 * PAYG state) land as their own endpoints when the screens that need them are
 * built.
 *
 * `funded` = any funding signal: an open PAYG period, a positive available
 * OR locked balance (locked = credits reserved for in-flight shares, e.g. a
 * grant that's already in use), or any past credit purchase (spent) —
 * deliberately sticky so a previously funded account is never re-onboarded
 * into the payment step. The "ever purchased" leg and the lifetime
 * `totalCreditPurchasesCents` figure are derived from the ledger
 * (`utils/money/ledger/advertiserCreditPurchases.ts`) — there is no stored
 * accumulator.
 *
 * The response carries Zod-*input* values (raw `Date`); the JSON serializer +
 * the SDK's response schema coerce them to the wire shape, so this isn't
 * annotated with the `GetMeResponse` output type.
 */
export const getMe: RequestHandler = asyncHandler(async (req, res) => {
  const [advertiser, visible, everPurchasedCredits, totalCreditPurchasesCents] =
    await Promise.all([
    prisma.advertiser.findUnique({
      where: { id: req.user.id },
      select: {
        uid: true,
        email: true,
        locale: true,
        language: true,
        promoNotificationsEnabled: true,
        agreedToTermsOfServiceAt: true,
        agreedToPrivacyPolicyAt: true,
        createdAt: true,
        sensitiveData: {
          select: {
            availableBudgetUsdCents: true,
            lockedBudgetUsdCents: true,
            savedPaymentMethodId: true,
          },
        },
        // Latest PAYG period: open (endedAt null) = active; closed = its
        // endedReason feeds the status derivation (at most one is open —
        // partial unique index).
        paygPeriods: {
          orderBy: { startedAt: "desc" },
          select: { endedAt: true, endedReason: true },
          take: 1,
        },
        // Same for the monthly budget (same partial-unique invariant).
        monthlyBudgetPeriods: {
          orderBy: { startedAt: "desc" },
          select: {
            endedAt: true,
            endedReason: true,
            targetCents: true,
            nextRunAt: true,
          },
          take: 1,
        },
        // DELETED businesses must not count as "has a page" (a v1-migrated
        // account whose only business was deleted should be re-prompted to
        // create one, not shown funding notices for a page that's gone).
        _count: {
          select: { locals: { where: businessOwnerVisibleWhere } },
        },
      },
    }),
    // Account-level roll-up of per-business accessibility (credits / PAYG /
    // subsidization). Distinct from the sticky `funded` — see the DTO.
    isAdvertiserVisible(req.user.id),
    hasAdvertiserEverPurchasedCredits(req.user.id),
    sumAdvertiserCreditPurchasesCents(req.user.id),
  ]);
  if (!advertiser) throw createCustomError(1304, "advertiser not found", 404);

  const latestPayg = advertiser.paygPeriods[0] ?? null;
  const paygActive = latestPayg != null && latestPayg.endedAt === null;
  const latestMonthly = advertiser.monthlyBudgetPeriods[0] ?? null;
  const monthlyBudgetActive =
    latestMonthly != null && latestMonthly.endedAt === null;
  const cardOnFile = advertiser.sensitiveData.savedPaymentMethodId != null;
  const funded =
    paygActive ||
    advertiser.sensitiveData.availableBudgetUsdCents > 0n ||
    advertiser.sensitiveData.lockedBudgetUsdCents > 0n ||
    everPurchasedCredits;

  res.status(200).json({
    advertiser: {
      uid: advertiser.uid,
      email: advertiser.email,
      locale: advertiser.locale,
      language: advertiser.language,
      funded,
      hasBusinessPage: advertiser._count.locals > 0,
      visible,
      // Spendable money state — drives the home hero + conditional add-budget
      // CTA. Cents ride as bigint (Zod input), coerced by the response schema.
      budgets: {
        availableCents: advertiser.sensitiveData.availableBudgetUsdCents,
        lockedCents: advertiser.sensitiveData.lockedBudgetUsdCents,
        totalCreditPurchasesCents,
        paygActive,
        paygStatus: derivePaygStatus({
          cardOnFile,
          periodOpen: paygActive,
          lastEndedReason: latestPayg?.endedReason ?? null,
        }),
        monthlyBudget: {
          status: deriveMonthlyBudgetStatus({
            cardOnFile,
            periodOpen: monthlyBudgetActive,
            lastEndedReason: latestMonthly?.endedReason ?? null,
          }),
          targetCents: monthlyBudgetActive ? latestMonthly.targetCents : null,
          nextChargeAt: monthlyBudgetActive ? latestMonthly.nextRunAt : null,
        },
      },
      promoNotificationsEnabled: advertiser.promoNotificationsEnabled,
      // Re-acceptance gates (twin of the customer): true when the latest ToS /
      // Privacy version postdates this advertiser's last agreement. Cleared by
      // POST /v2/cross/.../agree (which stamps agreed-at = now).
      shouldAgreeWithLatestTos:
        advertiser.agreedToTermsOfServiceAt <
        LATEST_TERMS_OF_SERVICE_RELEASE_DATE,
      shouldAgreeWithLatestPrivacyPolicy:
        advertiser.agreedToPrivacyPolicyAt <
        LATEST_PRIVACY_POLICY_RELEASE_DATE,
      createdAt: advertiser.createdAt,
    },
  });
});
