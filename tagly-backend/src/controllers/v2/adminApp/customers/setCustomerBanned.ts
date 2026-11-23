import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import { queueNotificationJobs } from "../../../../utils/queue/queueNotificationJobs.js";
import adminHydrateCustomer from "../../../../utils/hydrators/admin/adminHydrateCustomer.js";
import type {
  AdminCustomerUidParams,
  AdminSetCustomerBannedBody,
} from "@tagly/models/v2/adminApp";

/**
 * `PATCH /v2/admin/customers/:uid/banned` — ban or unban a customer:
 *
 * Ban:   ACTIVE → BANNED (1542 if already banned)
 * Unban: BANNED → ACTIVE (1543 if not banned)
 *
 * Banning also records the customer's Instagram in `BannedInstagram` (same
 * tx) so the same Instagram can't be re-used on Tagly (delete account +
 * re-register, or move the IG elsewhere — `assertInstagramNotBannedOrThrow`
 * gates every IG assignment). The ban targets the IG connected AT THAT MOMENT
 * — INTENDED scope (Matej, 2026-08-02, E059): no link history is kept, so an
 * IG disconnected before the ban is simply not blocklisted. Every blocklist
 * row is stamped with the customer's `customerUid` (audit pointer), and
 * UNBAN clears by that pointer OR the currently-linked uid — never by the
 * relation alone, which is deletable and used to orphan the row forever when
 * the customer disconnected/switched IG after the ban (this endpoint is the
 * table's only writer). A BANNED
 * customer can still log in but can't perform value-bearing actions
 * (`assertCustomerNotBannedOrThrow` in create-share / withdrawal; the client
 * maps 1540/1541 centrally). The customer detail (`GET /v2/customers/me`)
 * surfaces `status` + `banReason` from these rows.
 *
 * Deliberate: in-flight shares are NOT voided — pre-ban shares
 * still settle and pay (the ban gates future actions, it does not claw back).
 *
 * The customer is always emailed (mandatory email-only event) so they know
 * what happened; on ban the admin's reason rides the payload. The queue util
 * is best-effort by design (never throws), so a notification hiccup can't
 * break the ban itself.
 *
 * SUPER-gated in the router.
 */
export const setCustomerBanned: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminCustomerUidParams;
    const { banned, reason } = req.validatedBody as AdminSetCustomerBannedBody;
    const adminId = req.user.id;

    const customer = await prisma.customer.findUnique({
      where: { uid },
      select: {
        id: true,
        uid: true,
        status: true,
        // The IG identity lives on the linked CustomerInstagramAccount.
        instagram: { select: { instagramUid: true } },
      },
    });
    if (!customer) throw createCustomError(4043, "Customer not found", 404);
    const instagramUid = customer.instagram?.instagramUid ?? null;

    if (banned) {
      if (customer.status === "BANNED") {
        throw createCustomError(1542, "Customer is already banned", 409);
      }

      await prisma.$transaction(async (tx) => {
        await tx.customer.update({
          where: { id: customer.id },
          data: { status: "BANNED" },
        });

        // Persist the IG ban so the same Instagram can't be re-used, even if
        // the customer later deletes their account.
        if (instagramUid) {
          await tx.bannedInstagram.upsert({
            where: { instagramUid },
            update: {
              reason: reason ?? null,
              bannedByAdminId: adminId,
              customerUid: customer.uid,
            },
            create: {
              instagramUid,
              reason: reason ?? null,
              bannedByAdminId: adminId,
              customerUid: customer.uid,
            },
          });
        }
      });

      await queueNotificationJobs({
        eventSlug: "c.account.banned",
        payload: { reason: reason ?? null },
        customerIds: [customer.id],
        dedupeKey: `customer-banned:${customer.id}:${Date.now()}`,
      });
    } else {
      if (customer.status !== "BANNED") {
        throw createCustomError(1543, "Customer is not banned", 409);
      }

      await prisma.$transaction(async (tx) => {
        await tx.customer.update({
          where: { id: customer.id },
          data: { status: "ACTIVE" },
        });

        // Unban clears by the `customerUid` audit pointer the ban stamped, not
        // (only) the currently-linked IG: the relation is deletable, so keying
        // on it alone orphaned the row forever when the customer disconnected
        // or switched Instagram after the ban — and this endpoint is the
        // table's only writer, so nothing else could ever clear it (E059).
        // The `instagramUid` leg stays for rows predating the pointer.
        await tx.bannedInstagram.deleteMany({
          where: {
            OR: [
              { customerUid: customer.uid },
              ...(instagramUid ? [{ instagramUid }] : []),
            ],
          },
        });
      });

      await queueNotificationJobs({
        eventSlug: "c.account.unbanned",
        customerIds: [customer.id],
        dedupeKey: `customer-unbanned:${customer.id}:${Date.now()}`,
      });
    }

    const hydrated = await adminHydrateCustomer({ customerId: customer.id });

    // No `satisfies` — the hydrator emits the schema's INPUT shape (Date /
    // bigint before coercion), same as every other hydrated admin response.
    res.status(200).json({
      message: banned ? "Customer banned" : "Customer unbanned",
      customer: hydrated,
    });
  },
);
