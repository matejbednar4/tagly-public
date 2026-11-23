import { Router } from "express";
import { validateReq } from "../../../middleware/request/validateRequest.js";
import { requireSuperAdmin } from "../../../middleware/auth/requireAdminRole.js";
import {
  AdminListEntitiesQuerySchema,
  AdminSearchQuerySchema,
  AdminCustomerUidParamsSchema,
  AdminAdvertiserUidParamsSchema,
  AdminBusinessUidParamsSchema,
  AdminShareUidParamsSchema,
  AdminSharesFromUidParamsSchema,
  AdminSharesFromUidQuerySchema,
  AdminLedgerEventsFromUidParamsSchema,
  AdminLedgerEventsFromUidQuerySchema,
  AdminApproveShareParamsSchema,
  AdminRejectShareParamsSchema,
  AdminRejectShareBodySchema,
  AdminReviewShareReportParamsSchema,
  AdminReviewShareReportBodySchema,
  AdminAssessShareParamsSchema,
  AdminAssessShareBodySchema,
  AdminReviewLinkParamsSchema,
  AdminReviewLinkBodySchema,
  AdminCreateBusinessInitBodySchema,
  AdminCreateBusinessConfirmBodySchema,
  AdminUpdateBusinessBodySchema,
  AdminUpdateBusinessMediaInitBodySchema,
  AdminUpdateBusinessMediaConfirmBodySchema,
  AdminSetBusinessSubsidizedBodySchema,
  AdminSetBusinessBannedBodySchema,
  AdminSetBusinessAdvertiserBodySchema,
  AdminSetCustomerBannedBodySchema,
  AdminSetCustomerMultiplierBodySchema,
  AdminAssignPromotionalCreditBodySchema,
  AdminSetAdvertiserReferrerBodySchema,
  AdminCreditPurchaseUidParamsSchema,
  AdminRefundCreditPurchaseBodySchema,
  AdminQrStickerIdParamsSchema,
  AdminAssignQrStickerBodySchema,
  AdminSendBlastBodySchema,
} from "@tagly/models/v2/adminApp";
import { getMe } from "../../../controllers/v2/adminApp/auth/getMe.js";
import { logout } from "../../../controllers/v2/adminApp/auth/logout.js";
import { getStatistics } from "../../../controllers/v2/adminApp/statistics/getStatistics.js";
import { getStripeBalance } from "../../../controllers/v2/adminApp/balance/getStripeBalance.js";
import { listEntities } from "../../../controllers/v2/adminApp/entities/listEntities.js";
import { search } from "../../../controllers/v2/adminApp/search/search.js";
import { getCustomerByUid } from "../../../controllers/v2/adminApp/customers/getCustomerByUid.js";
import { setCustomerBanned } from "../../../controllers/v2/adminApp/customers/setCustomerBanned.js";
import { setCustomerMultiplier } from "../../../controllers/v2/adminApp/customers/setCustomerMultiplier.js";
import { getAdvertiserByUid } from "../../../controllers/v2/adminApp/advertisers/getAdvertiserByUid.js";
import { getBusinessByUid } from "../../../controllers/v2/adminApp/businesses/getBusinessByUid.js";
import { createBusinessInit } from "../../../controllers/v2/adminApp/businesses/createBusinessInit.js";
import { createBusinessConfirm } from "../../../controllers/v2/adminApp/businesses/createBusinessConfirm.js";
import { updateBusiness } from "../../../controllers/v2/adminApp/businesses/updateBusiness.js";
import { updateBusinessMediaInit } from "../../../controllers/v2/adminApp/businesses/updateBusinessMediaInit.js";
import { updateBusinessMediaConfirm } from "../../../controllers/v2/adminApp/businesses/updateBusinessMediaConfirm.js";
import { setBusinessSubsidized } from "../../../controllers/v2/adminApp/businesses/setBusinessSubsidized.js";
import { setBusinessBanned } from "../../../controllers/v2/adminApp/businesses/setBusinessBanned.js";
import { setBusinessAdvertiser } from "../../../controllers/v2/adminApp/businesses/setBusinessAdvertiser.js";
import { assignQrSticker } from "../../../controllers/v2/adminApp/stickers/assignQrSticker.js";
import { unassignQrSticker } from "../../../controllers/v2/adminApp/stickers/unassignQrSticker.js";
import { getBusinessQrStickers } from "../../../controllers/v2/adminApp/stickers/getBusinessQrStickers.js";
import { getShareByUid } from "../../../controllers/v2/adminApp/shares/getShareByUid.js";
import { getSharesFromUid } from "../../../controllers/v2/adminApp/shares/getSharesFromUid.js";
import { getLedgerEventsFromUid } from "../../../controllers/v2/adminApp/ledger/getLedgerEventsFromUid.js";
import { getReviewCounts } from "../../../controllers/v2/adminApp/review/getReviewCounts.js";
import { getSharesPendingApproval } from "../../../controllers/v2/adminApp/shares/getSharesPendingApproval.js";
import { getSharesPendingReport } from "../../../controllers/v2/adminApp/shares/getSharesPendingReport.js";
import { getUnratedShares } from "../../../controllers/v2/adminApp/shares/getUnratedShares.js";
import { approveShare } from "../../../controllers/v2/adminApp/shares/approveShare.js";
import { rejectShare } from "../../../controllers/v2/adminApp/shares/rejectShare.js";
import { reviewShareReport } from "../../../controllers/v2/adminApp/shares/reviewShareReport.js";
import { assessShare } from "../../../controllers/v2/adminApp/shares/assessShare.js";
import { getPendingLinks } from "../../../controllers/v2/adminApp/links/getPendingLinks.js";
import { reviewLink } from "../../../controllers/v2/adminApp/links/reviewLink.js";
import { assignPromotionalCredit } from "../../../controllers/v2/adminApp/advertisers/assignPromotionalCredit.js";
import { setAdvertiserReferrer } from "../../../controllers/v2/adminApp/advertisers/setAdvertiserReferrer.js";
import { refundCreditPurchase } from "../../../controllers/v2/adminApp/creditPurchases/refundCreditPurchase.js";
import { adminSendBlast } from "../../../controllers/v2/adminApp/notifications/adminSendBlast.js";
import { adminGetBlasts } from "../../../controllers/v2/adminApp/notifications/adminGetBlasts.js";
import { adminGetBlastSenderDomains } from "../../../controllers/v2/adminApp/notifications/adminGetBlastSenderDomains.js";

/**
 * Authed admin group `/v2/admin/**`. Mounted in `routes/v2/index.ts` behind
 * `verifyJwt, authedUserLimiter, gentlePerRouteLimiter, requireAdminCapability`,
 * so every route here already has an active admin's `req.user`.
 *
 * Roles (decided 2026-07-22, confirmed permanent 2026-07-25): every DATA route
 * is `requireSuperAdmin` — no SUPER+OPS split is planned. The account routes
 * (`me`, `logout`) stay any-admin — every admin can read themselves and sign out.
 */
const r = Router();

// Any admin
r.get("/me", getMe);
r.post("/logout", logout);

// SUPER-only reads
r.get("/statistics", requireSuperAdmin, getStatistics);
r.get("/balance/stripe", requireSuperAdmin, getStripeBalance);
r.get(
  "/entities",
  requireSuperAdmin,
  validateReq("query", AdminListEntitiesQuerySchema),
  listEntities,
);
r.get(
  "/search",
  requireSuperAdmin,
  validateReq("query", AdminSearchQuerySchema),
  search,
);
r.get(
  "/customers/:uid",
  requireSuperAdmin,
  validateReq("params", AdminCustomerUidParamsSchema),
  getCustomerByUid,
);
// — Customer actions (ban / rating-multiplier set) —
r.patch(
  "/customers/:uid/banned",
  requireSuperAdmin,
  validateReq("params", AdminCustomerUidParamsSchema),
  validateReq("body", AdminSetCustomerBannedBodySchema),
  setCustomerBanned,
);
r.patch(
  "/customers/:uid/multiplier",
  requireSuperAdmin,
  validateReq("params", AdminCustomerUidParamsSchema),
  validateReq("body", AdminSetCustomerMultiplierBodySchema),
  setCustomerMultiplier,
);
r.get(
  "/advertisers/:uid",
  requireSuperAdmin,
  validateReq("params", AdminAdvertiserUidParamsSchema),
  getAdvertiserByUid,
);
// — Businesses (create + edit; wire-twins of the advertiser endpoints over
// the shared `utils/businesses/write/*Core` orchestration) —
// Static `/businesses/{init,confirm}` before `/businesses/:uid` so the
// literal segments aren't swallowed by the by-uid routes.
r.post(
  "/businesses/init",
  requireSuperAdmin,
  validateReq("body", AdminCreateBusinessInitBodySchema),
  createBusinessInit,
);
r.post(
  "/businesses/confirm",
  requireSuperAdmin,
  validateReq("body", AdminCreateBusinessConfirmBodySchema),
  createBusinessConfirm,
);
r.get(
  "/businesses/:uid",
  requireSuperAdmin,
  validateReq("params", AdminBusinessUidParamsSchema),
  getBusinessByUid,
);
// — Billing actions (SUPER-only money movements) —
r.post(
  "/advertisers/:uid/promotional-credit",
  requireSuperAdmin,
  validateReq("params", AdminAdvertiserUidParamsSchema),
  validateReq("body", AdminAssignPromotionalCreditBodySchema),
  assignPromotionalCredit,
);
// — Referrals (sales-assisted attribution fix: link a business to the
// influencer who brought it when the code was never entered at onboarding) —
r.post(
  "/advertisers/:uid/referrer",
  requireSuperAdmin,
  validateReq("params", AdminAdvertiserUidParamsSchema),
  validateReq("body", AdminSetAdvertiserReferrerBodySchema),
  setAdvertiserReferrer,
);
r.post(
  "/credit-purchases/:uid/refund",
  requireSuperAdmin,
  validateReq("params", AdminCreditPurchaseUidParamsSchema),
  validateReq("body", AdminRefundCreditPurchaseBodySchema),
  refundCreditPurchase,
);
r.patch(
  "/businesses/:uid",
  requireSuperAdmin,
  validateReq("params", AdminBusinessUidParamsSchema),
  validateReq("body", AdminUpdateBusinessBodySchema),
  updateBusiness,
);
r.post(
  "/businesses/:uid/media/init",
  requireSuperAdmin,
  validateReq("params", AdminBusinessUidParamsSchema),
  validateReq("body", AdminUpdateBusinessMediaInitBodySchema),
  updateBusinessMediaInit,
);
r.post(
  "/businesses/:uid/media/confirm",
  requireSuperAdmin,
  validateReq("params", AdminBusinessUidParamsSchema),
  validateReq("body", AdminUpdateBusinessMediaConfirmBodySchema),
  updateBusinessMediaConfirm,
);
// — Business actions (subsidize / ban / onboarding-assist handover) —
r.patch(
  "/businesses/:uid/subsidized",
  requireSuperAdmin,
  validateReq("params", AdminBusinessUidParamsSchema),
  validateReq("body", AdminSetBusinessSubsidizedBodySchema),
  setBusinessSubsidized,
);
r.patch(
  "/businesses/:uid/banned",
  requireSuperAdmin,
  validateReq("params", AdminBusinessUidParamsSchema),
  validateReq("body", AdminSetBusinessBannedBodySchema),
  setBusinessBanned,
);
r.patch(
  "/businesses/:uid/advertiser",
  requireSuperAdmin,
  validateReq("params", AdminBusinessUidParamsSchema),
  validateReq("body", AdminSetBusinessAdvertiserBodySchema),
  setBusinessAdvertiser,
);
// — QR stickers (printed sticker → business mapping) —
r.get(
  "/businesses/:uid/stickers",
  requireSuperAdmin,
  validateReq("params", AdminBusinessUidParamsSchema),
  getBusinessQrStickers,
);
r.put(
  "/stickers/:id",
  requireSuperAdmin,
  validateReq("params", AdminQrStickerIdParamsSchema),
  validateReq("body", AdminAssignQrStickerBodySchema),
  assignQrSticker,
);
r.delete(
  "/stickers/:id",
  requireSuperAdmin,
  validateReq("params", AdminQrStickerIdParamsSchema),
  unassignQrSticker,
);
// — Notifications (admin blast: one-off operational/promo announcements) —
r.post(
  "/notifications/blast",
  requireSuperAdmin,
  validateReq("body", AdminSendBlastBodySchema),
  adminSendBlast,
);
r.get("/notifications/blasts", requireSuperAdmin, adminGetBlasts);
r.get(
  "/notifications/sender-domains",
  requireSuperAdmin,
  adminGetBlastSenderDomains,
);
// — Review (moderation queues + actions) —
r.get("/review/counts", requireSuperAdmin, getReviewCounts);
// Static share paths before `/shares/:uid` so the literal segments aren't
// swallowed by the share-by-uid route.
r.get("/shares/pending-approval", requireSuperAdmin, getSharesPendingApproval);
r.get("/shares/pending-report", requireSuperAdmin, getSharesPendingReport);
r.get("/shares/unrated", requireSuperAdmin, getUnratedShares);
r.post(
  "/shares/:uid/approve",
  requireSuperAdmin,
  validateReq("params", AdminApproveShareParamsSchema),
  approveShare,
);
r.post(
  "/shares/:uid/reject",
  requireSuperAdmin,
  validateReq("params", AdminRejectShareParamsSchema),
  validateReq("body", AdminRejectShareBodySchema),
  rejectShare,
);
r.put(
  "/shares/:uid/report-review",
  requireSuperAdmin,
  validateReq("params", AdminReviewShareReportParamsSchema),
  validateReq("body", AdminReviewShareReportBodySchema),
  reviewShareReport,
);
r.post(
  "/shares/:uid/assess",
  requireSuperAdmin,
  validateReq("params", AdminAssessShareParamsSchema),
  validateReq("body", AdminAssessShareBodySchema),
  assessShare,
);
r.get("/links/pending", requireSuperAdmin, getPendingLinks);
r.post(
  "/links/:id/review",
  requireSuperAdmin,
  validateReq("params", AdminReviewLinkParamsSchema),
  validateReq("body", AdminReviewLinkBodySchema),
  reviewLink,
);

// `/shares/from/:uid` before `/shares/:uid` — the literal `from` segment must
// not be swallowed by the single-segment share-by-uid route.
r.get(
  "/shares/from/:uid",
  requireSuperAdmin,
  validateReq("params", AdminSharesFromUidParamsSchema),
  validateReq("query", AdminSharesFromUidQuerySchema),
  getSharesFromUid,
);
r.get(
  "/shares/:uid",
  requireSuperAdmin,
  validateReq("params", AdminShareUidParamsSchema),
  getShareByUid,
);
r.get(
  "/ledger-events/from/:uid",
  requireSuperAdmin,
  validateReq("params", AdminLedgerEventsFromUidParamsSchema),
  validateReq("query", AdminLedgerEventsFromUidQuerySchema),
  getLedgerEventsFromUid,
);

export default r;
