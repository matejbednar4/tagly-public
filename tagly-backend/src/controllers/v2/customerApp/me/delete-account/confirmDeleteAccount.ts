import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { verifyOtpForSessionOrThrow } from "../../../../../utils/auth/otp/verifyOtpForSessionOrThrow.js";
import { deleteCustomerInstagramData } from "../../../../../utils/instagram/deleteCustomerInstagramData.js";
import { deleteS3KeysOrThrow } from "../../../../../utils/aws/s3/deleteS3KeysOrThrow.js";
import { sendEmail } from "../../../../../utils/email/sendEmail.js";
import { withdrawCustomerBalanceToConnectOrThrow } from "../../../../../utils/money/withdrawals/withdrawCustomerBalanceToConnectOrThrow.js";
import { WITHDRAWAL_PURPOSE_WIRE } from "../../../../../utils/money/withdrawals/withdrawalPurpose.js";
import { forfeitRemainingBalanceToPlatformOnAccountDeletion } from "../../../../../utils/money/ledger/events/forfeitRemainingBalanceToPlatformOnAccountDeletion.js";
import type { ConfirmDeleteAccountBody } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/delete-account/confirm` — verify the `ACCOUNT_DELETION`
 * OTP, resolve any remaining balance (sweep it to the customer's Stripe Connect
 * account, or forfeit it with explicit consent), then hard-delete the account.
 * Requires a prior `/start`.
 *
 * Flow:
 * 1. Load the customer + sensitiveData; reject if funds are locked (a withdrawal
 *    is already in flight — deleting would strand it). This block also applies
 *    to the forfeit path: an in-flight withdrawal must settle first.
 * 2. Verify the OTP WITHOUT consuming it (`deleteOnSuccess: false`) so a failed
 *    balance sweep leaves the code reusable on retry (it's cascade-deleted with
 *    the customer once deletion actually succeeds).
 * 3. If there's a balance and `forfeitConsent` is NOT set, it must be sweepable:
 *    payouts must be enabled (else 1201 — the client routes the user to
 *    `/withdraw` first). Sweep it via the shared permanent withdrawal util. If
 *    the transfer comes back `null` the withdrawal is genuinely in flight
 *    (ambiguous Stripe error, balance still locked) — we MUST NOT delete the
 *    customer yet (the reconciliation worker needs the balance row), so throw
 *    1202 and let the user retry shortly.
 *    With `forfeitConsent: true` (the App Review 5.1.1(v) path — deletion must
 *    never require Stripe Connect onboarding) the sweep requirement and the
 *    sweep itself are skipped entirely, DETERMINISTICALLY — even if payouts
 *    happen to be enabled (the client only offers forfeit when they aren't; an
 *    explicit "forfeit" tap always means forfeit). The balance is instead
 *    zeroed by an explicit `ADJUSTMENT` forfeit event inside the deletion
 *    transaction (step 4), so the trail is auditable and the cash stays in the
 *    platform's Stripe balance as unassigned.
 * 4. Atomically clean up Instagram data (void in-flight shares + release their
 *    locks, collect S3 keys) and delete the customer + sensitiveData rows. Shares,
 *    ledger events, and the swept withdrawal survive with `customerId` nulled
 *    (`onDelete: SetNull`), preserving accounting + reconciliation history; every
 *    child row (IG account, push tokens, OTP + OAuth sessions, notif prefs)
 *    cascade-deletes.
 * 5. Best-effort S3 cleanup of the collected media keys.
 *
 * Race note (long-standing): a SHARE_PAYMENT that settles between the balance
 * read and the sweep can leave residual cents on the sensitiveData row. Because we
 * delete the row alongside the customer, that residual is wiped from Tagly's books
 * — the cash stays in the platform's Stripe balance (unassigned, no row points at
 * it) and accounting stays consistent; the customer loses access to those cents.
 */
export const confirmDeleteAccount: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;
    const { otp, forfeitConsent } = req.validatedBody as ConfirmDeleteAccountBody;
    const wantsForfeit = forfeitConsent === true;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        email: true,
        language: true,
        sensitiveData: {
          select: {
            id: true,
            balanceUsdCents: true,
            lockedBalanceUsdCents: true,
            payoutsEnabledAt: true,
          },
        },
      },
    });
    if (!customer) {
      throw createCustomError(1002, "customer not found", 404);
    }

    const {
      id: sensitiveDataId,
      balanceUsdCents,
      lockedBalanceUsdCents,
      payoutsEnabledAt,
    } = customer.sensitiveData;

    // A locked balance means a withdrawal is mid-flight — deleting the balance row
    // now would strand its reconciliation. Make them wait for it to settle.
    if (lockedBalanceUsdCents > 0n) {
      throw createCustomError(1200, "funds are locked", 409);
    }

    const otpSession = await prisma.otpSession.findFirst({
      where: { customerId, purpose: "ACCOUNT_DELETION" },
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

    // With explicit forfeit consent the sweep block is skipped entirely — the
    // balance is zeroed by the forfeit ledger event inside the deletion
    // transaction below instead (see docblock step 3).
    if (balanceUsdCents > 0n && !wantsForfeit) {
      // The balance has to land somewhere real. Without payouts enabled the sweep
      // would push funds into a Connect account with no bank → stuck. The client
      // gates this too (routes to `/withdraw`); guard server-side as well.
      if (!payoutsEnabledAt) {
        throw createCustomError(
          1201,
          "withdraw your balance before deleting",
          409,
        );
      }

      const { transfer } = await withdrawCustomerBalanceToConnectOrThrow({
        customerId,
        amountCents: balanceUsdCents,
        currency: "usd",
        purpose: WITHDRAWAL_PURPOSE_WIRE.ACCOUNT_DELETION_SWEEP,
        requirePayoutsEnabledAt: false,
      });

      // `transfer === null` ⇒ the withdrawal is in flight (ambiguous Stripe error,
      // balance still locked, worker will reconcile). Do NOT delete — the worker
      // needs the balance row. The user retries once it settles.
      if (transfer === null) {
        throw createCustomError(
          1202,
          "withdrawal in progress, try again shortly",
          409,
        );
      }
    }

    let s3KeysToDelete: string[] = [];

    await prisma.$transaction(async (tx) => {
      // Consented forfeit: zero the balance with an explicit ADJUSTMENT event
      // before the rows are deleted, so the forfeit is auditable (the event's
      // customerId nulls on delete, preserving accounting history). The wrapper
      // re-reads the balance in-tx, so the delta matches the row at delete time
      // (a settle landing between the read above and this tx leaves the same
      // residual-wipe semantics as the documented sweep race).
      if (wantsForfeit && balanceUsdCents > 0n) {
        await forfeitRemainingBalanceToPlatformOnAccountDeletion(tx, {
          customerId,
          currency: "usd",
          meta: { source: "confirmDeleteAccountV2" },
        });
      }

      // notifyCustomer: false — the recipient is deleted in this same tx, so a
      // share-unpayable queue row would be undeliverable junk.
      const igS3Keys = await deleteCustomerInstagramData(customerId, tx, {
        notifyCustomer: false,
        voidReason: "ACCOUNT_DELETED",
      });
      s3KeysToDelete.push(...igS3Keys);

      await tx.customer.delete({ where: { id: customerId } });
      await tx.customerSensitiveData.delete({ where: { id: sensitiveDataId } });
    });

    if (s3KeysToDelete.length > 0) {
      await deleteS3KeysOrThrow(s3KeysToDelete).catch(() => {});
    }

    // Deletion confirmation — a direct email, NOT a notification-queue job: the
    // recipient row (and their prefs) are already gone, so the queue could
    // never resolve them. Best-effort: the account is deleted either way.
    await sendEmail(
      customer.language === "cs"
        ? {
            target: customer.email,
            lang: "cs" as const,
            subject: "Tvůj účet Tagly byl smazán",
            title: "Tvůj účet byl smazán",
            preheader: "Tvůj účet Tagly a tvá data byly smazány.",
            bodyHtml: [
              "<p>Tvůj účet Tagly byl smazán spolu s tvými osobními údaji.</p>",
              "<p>Pokud žádost o smazání nebyla od tebe, okamžitě nás prosím kontaktuj odpovědí na tento e-mail.</p>",
            ].join(""),
          }
        : {
            target: customer.email,
            lang: "en" as const,
            subject: "Your Tagly account has been deleted",
            title: "Your account has been deleted",
            preheader: "Your Tagly account and your data have been deleted.",
            bodyHtml: [
              "<p>Your Tagly account has been deleted, along with your personal data.</p>",
              "<p>If you didn't request this deletion, please contact us immediately by replying to this email.</p>",
            ].join(""),
          },
    ).catch(() => {});

    res.status(200).json({ message: "Account deleted" });
  },
);
