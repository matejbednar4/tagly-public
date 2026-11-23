import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { verifyOtpForSessionOrThrow } from "../../../../../utils/auth/otp/verifyOtpForSessionOrThrow.js";
import { forfeitRemainingBudgetToPlatformOnAccountDeletion } from "../../../../../utils/money/ledger/events/forfeitRemainingBudgetToPlatformOnAccountDeletion.js";
import { deleteS3KeysOrThrow } from "../../../../../utils/aws/s3/deleteS3KeysOrThrow.js";
import { sendEmail } from "../../../../../utils/email/sendEmail.js";
import { queueNotificationJobs } from "../../../../../utils/queue/queueNotificationJobs.js";
import type { ConfirmDeleteAccountBody } from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/delete-account/confirm` — verify the `ACCOUNT_DELETION`
 * OTP, then hard-delete the advertiser. Requires a prior `/start`.
 *
 * Flow:
 * 1. Load the advertiser + budget; reject if the account owes money (a negative
 *    combined balance — 1305). A positive balance is forfeited to the platform.
 * 2. Verify the OTP WITHOUT consuming it (`deleteOnSuccess: false`) so a failed
 *    teardown leaves the code reusable on retry (it's cascade-deleted with the
 *    advertiser once deletion actually succeeds).
 * 3. Atomically: mark every not-yet-settled share UNPAYABLE (customers can't be
 *    paid for shares after the advertiser is gone), forfeit any remaining budget
 *    to platform revenue (ledger event; its `advertiserId` nulls on delete,
 *    preserving accounting history), collect the pages' media keys, delete the
 *    business pages (subsidization periods cascade), then delete the advertiser +
 *    its sensitive-data row. Open PAYG periods cascade-delete with the advertiser.
 * 4. Best-effort S3 cleanup of the collected media keys.
 *
 * PAYG note: an open PAYG period is torn down (cascade) without a final charge —
 * the shares that would have driven that charge are marked UNPAYABLE in the same
 * transaction, so no customer is paid and nothing is owed on them.
 */
export const confirmDeleteAccount: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    const { otp } = req.validatedBody as ConfirmDeleteAccountBody;

    const advertiser = await prisma.advertiser.findUnique({
      where: { id: advertiserId },
      select: {
        email: true,
        language: true,
        sensitiveDataId: true,
        sensitiveData: {
          select: {
            availableBudgetUsdCents: true,
            lockedBudgetUsdCents: true,
          },
        },
      },
    });
    if (!advertiser) {
      throw createCustomError(1304, "advertiser not found", 404);
    }

    const { availableBudgetUsdCents, lockedBudgetUsdCents } =
      advertiser.sensitiveData;
    const combinedBalance = availableBudgetUsdCents + lockedBudgetUsdCents;

    // A negative balance means the account owes money (e.g. a PAYG charge that
    // hasn't settled) — deletion would strand that debt. Block it.
    if (combinedBalance < 0n) {
      throw createCustomError(1305, "advertiser owes money", 409);
    }

    const otpSession = await prisma.otpSession.findFirst({
      where: { advertiserId, purpose: "ACCOUNT_DELETION" },
      select: { id: true },
    });
    if (!otpSession) {
      throw createCustomError(1100, "no pending account deletion", 400);
    }

    // Verify without consuming — see docblock step 2.
    await verifyOtpForSessionOrThrow({
      code: otp,
      expectedPurpose: "ACCOUNT_DELETION",
      otpSessionId: otpSession.id,
      deleteOnSuccess: false,
    });

    let s3KeysToDelete: string[] = [];

    await prisma.$transaction(async (tx) => {
      // Snapshot who loses an in-flight share BEFORE the bulk void, so the
      // affected customers can be told (same slug + daily dedupe as the shared
      // void helper; queued in-tx = outbox, so a rollback erases the rows).
      const voidedShares = await tx.share.findMany({
        where: {
          advertiserId,
          status: { notIn: ["PAID", "UNPAYABLE"] },
          approvalStatus: { not: "REJECTED" },
        },
        select: { customerId: true },
      });

      // Mark all unsettled shares UNPAYABLE — customers must not be paid for
      // shares after the advertiser deletes their account.
      await tx.share.updateMany({
        where: {
          advertiserId,
          status: { notIn: ["PAID", "UNPAYABLE"] },
          approvalStatus: { not: "REJECTED" },
        },
        data: {
          status: "UNPAYABLE",
          lastProcessingError: "advertiser deleted their account",
          lastProcessingErrorAt: new Date(),
        },
      });

      const affectedCustomerIds = [
        ...new Set(
          voidedShares
            .map((s) => s.customerId)
            .filter((c): c is number => c !== null),
        ),
      ];
      if (affectedCustomerIds.length > 0) {
        const day = new Date().toISOString().slice(0, 10);
        for (const cId of affectedCustomerIds) {
          await queueNotificationJobs({
            customerIds: [cId],
            eventSlug: "c.shares.unpayable",
            dedupeKey: `share-unpayable:${cId}:${day}`,
            tx,
          });
        }
      }

      const media = await tx.media.findMany({
        where: {
          OR: [
            { photoOfLocal: { advertiserId } },
            { bannerOfLocal: { advertiserId } },
          ],
        },
        select: { id: true, key: true },
      });
      const mediaIds = media.map((m) => m.id);
      s3KeysToDelete = media.map((m) => m.key);

      // Forfeit any remaining positive budget to platform revenue.
      if (combinedBalance > 0n) {
        await forfeitRemainingBudgetToPlatformOnAccountDeletion(tx, {
          advertiserId,
          currency: "usd",
          meta: { source: "deleteAdvertiserV2" },
        });
      }

      // Delete the business pages before the advertiser so an `advertiserId`
      // SetNull can't leave orphaned pages behind. Subsidization periods cascade
      // from the pages; open PAYG periods cascade from the advertiser.
      await tx.localSubaccount.deleteMany({ where: { advertiserId } });

      await tx.advertiser.delete({ where: { id: advertiserId } });
      await tx.advertiserSensitiveData.delete({
        where: { id: advertiser.sensitiveDataId },
      });

      await tx.media.deleteMany({ where: { id: { in: mediaIds } } });
    });

    if (s3KeysToDelete.length > 0) {
      await deleteS3KeysOrThrow(s3KeysToDelete).catch(() => {});
    }

    // Deletion confirmation — a direct email, NOT a notification-queue job: the
    // recipient row (and their prefs) are already gone, so the queue could
    // never resolve them. Best-effort: the account is deleted either way.
    await sendEmail(
      advertiser.language === "cs"
        ? {
            target: advertiser.email,
            lang: "cs" as const,
            subject: "Tvůj účet Tagly Partner byl smazán",
            title: "Tvůj účet byl smazán",
            preheader: "Tvůj účet Tagly Partner a tvá data byly smazány.",
            bodyHtml: [
              "<p>Tvůj účet Tagly Partner byl smazán spolu s tvými stránkami podniku a osobními údaji.</p>",
              "<p>Pokud žádost o smazání nebyla od tebe, okamžitě nás prosím kontaktuj odpovědí na tento e-mail.</p>",
            ].join(""),
          }
        : {
            target: advertiser.email,
            lang: "en" as const,
            subject: "Your Tagly Partner account has been deleted",
            title: "Your account has been deleted",
            preheader: "Your Tagly Partner account and your data have been deleted.",
            bodyHtml: [
              "<p>Your Tagly Partner account has been deleted, along with your business pages and personal data.</p>",
              "<p>If you didn't request this deletion, please contact us immediately by replying to this email.</p>",
            ].join(""),
          },
    ).catch(() => {});

    res.status(200).json({ message: "Account deleted" });
  },
);
