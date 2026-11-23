import prisma from "../../../prisma/prisma.js";
import { normalizeLanguage } from "../../localization/localizeCatalog.js";
import type { SupportedLanguage } from "@tagly/models/shared";
import type { OtpSubject } from "./startOrResendOtpSession.js";

/**
 * Resolves the preferred language for an OTP subject (the entity the session
 * belongs to). Used so OTP emails are sent in the right language.
 *
 * Admin sessions don't have a language column — admin tooling is English-only
 * — so we always return `"en"` for them.
 */
export async function resolveOtpSubjectLanguage(
  subject: OtpSubject,
): Promise<SupportedLanguage> {
  if (subject.kind === "customer") {
    const c = await prisma.customer.findUnique({
      where: { id: subject.customerId },
      select: { language: true },
    });
    return normalizeLanguage(c?.language);
  }
  if (subject.kind === "pendingCustomer") {
    const pc = await prisma.pendingCustomer.findUnique({
      where: { id: subject.pendingCustomerId },
      select: { language: true },
    });
    return normalizeLanguage(pc?.language);
  }
  if (subject.kind === "advertiser") {
    const a = await prisma.advertiser.findUnique({
      where: { id: subject.advertiserId },
      select: { language: true },
    });
    return normalizeLanguage(a?.language);
  }
  if (subject.kind === "pendingAdvertiser") {
    const pa = await prisma.pendingAdvertiserAccount.findUnique({
      where: { id: subject.pendingAdvertiserId },
      select: { language: true },
    });
    return normalizeLanguage(pa?.language);
  }
  return "en";
}

/**
 * Resolves the preferred language for an existing OtpSession row by inspecting
 * which subject FK is set. Used by resendOtpForSession, which only has the
 * session ID. Admin sessions return `"en"` (no language column on Admin).
 */
export async function resolveOtpSessionLanguage(session: {
  customerId: number | null;
  pendingCustomerId: number | null;
  advertiserId: number | null;
  pendingAdvertiserId: number | null;
  adminId: number | null;
}): Promise<SupportedLanguage> {
  if (session.customerId !== null) {
    return resolveOtpSubjectLanguage({
      kind: "customer",
      customerId: session.customerId,
    });
  }
  if (session.pendingCustomerId !== null) {
    return resolveOtpSubjectLanguage({
      kind: "pendingCustomer",
      pendingCustomerId: session.pendingCustomerId,
    });
  }
  if (session.advertiserId !== null) {
    return resolveOtpSubjectLanguage({
      kind: "advertiser",
      advertiserId: session.advertiserId,
    });
  }
  if (session.pendingAdvertiserId !== null) {
    return resolveOtpSubjectLanguage({
      kind: "pendingAdvertiser",
      pendingAdvertiserId: session.pendingAdvertiserId,
    });
  }
  return "en";
}
