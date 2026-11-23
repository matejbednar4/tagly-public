import prisma from "../../prisma/prisma.js";
import {
  OAuthProvider,
  OAuthAccountKind,
} from "../../generated/prisma/client.js";
import { createCustomError } from "../core/errors/createCustomError.js";
import { generateSecureToken } from "../core/uids/generateSecureToken.js";
import { isCustomerProfileComplete } from "./isCustomerProfileComplete.js";
import type { SupportedLocale, SupportedLanguage } from "@tagly/models/shared";

/**
 * Resolves a verified Google/Apple identity into a login or a registration —
 * the shared core of the customer + advertiser `google`/`apple` controllers
 * (they differ only in how the token is verified and the `kind` they pass).
 *
 * `kind` scopes everything to one account namespace (the customer app resolves
 * CUSTOMER, the advertiser app ADVERTISER), so the same Google/Apple identity
 * can independently back a customer and an advertiser. Branches:
 *
 *   1. Known `(provider, subject, kind)` → that account (real → login, pending
 *      → resume). The only path Apple can satisfy after its first
 *      authorization (it stops returning the email).
 *   2. No identity yet, but the verified email matches an existing account or
 *      pending account of this kind → link the identity, then login / resume.
 *   3. Brand-new → create a pending account (provider verified the email, so no
 *      OTP) with the identity attached. ToS/Privacy stamped passively;
 *      marketing left for the client (US sends true, EU via the screen).
 *
 * Returns a `registrationToken` for registrations — the pending account's
 * resume/cancel token (customer + advertiser share the same field now).
 * `profileComplete` is customer-specific (advertisers have no profile step →
 * always true).
 */
export type OAuthSignInResult =
  | { type: "login"; account: { id: number; uid: string; jwtVersion: number } }
  | {
      type: "registration";
      registrationToken: string;
      profileComplete: boolean;
    };

export async function handleOAuthSignIn(opts: {
  kind: OAuthAccountKind;
  provider: OAuthProvider;
  subject: string;
  email: string | null;
  /** Whether the provider verified the email. Unverified → treated as no email. */
  emailVerified: boolean;
  locale: SupportedLocale;
  language: SupportedLanguage;
}): Promise<OAuthSignInResult> {
  const { kind, provider, subject, locale, language } = opts;
  const rawEmail = opts.email?.trim().toLowerCase() ?? null;
  // Only trust the email for linking to / creating an account when the provider
  // verified it. A validly-signed token can still carry an UNVERIFIED address
  // (e.g. a Google Workspace alias the org never verified), which an attacker
  // could use to link to — or pre-empt — an account they don't own. Unverified
  // → treat as no email (Branch 1 still works: it matches the stable `subject`,
  // not the email, so already-linked identities log in regardless).
  const email = opts.emailVerified ? rawEmail : null;

  // 1) Existing federated identity → that account.
  const identity = await prisma.oAuthIdentity.findUnique({
    where: { provider_subject_kind: { provider, subject, kind } },
    select: {
      customer: { select: { id: true, uid: true, jwtVersion: true } },
      advertiser: { select: { id: true, uid: true, jwtVersion: true } },
      pendingCustomer: { select: { registrationToken: true, fullName: true } },
      pendingAdvertiser: { select: { registrationToken: true } },
    },
  });
  if (identity?.customer) return { type: "login", account: identity.customer };
  if (identity?.advertiser) {
    return { type: "login", account: identity.advertiser };
  }
  if (identity?.pendingCustomer) {
    return {
      type: "registration",
      registrationToken: identity.pendingCustomer.registrationToken,
      profileComplete: isCustomerProfileComplete(identity.pendingCustomer),
    };
  }
  if (identity?.pendingAdvertiser) {
    return {
      type: "registration",
      registrationToken: identity.pendingAdvertiser.registrationToken,
      profileComplete: true,
    };
  }

  // 2) No identity yet — match by the provider-verified email, within this kind.
  if (email) {
    if (kind === "CUSTOMER") {
      const customer = await prisma.customer.findUnique({
        where: { email },
        select: { id: true, uid: true, jwtVersion: true },
      });
      if (customer) {
        await prisma.oAuthIdentity.create({
          data: { provider, subject, kind, email, customerId: customer.id },
        });
        return { type: "login", account: customer };
      }
      const pending = await prisma.pendingCustomer.findUnique({
        where: { email },
        select: { id: true, registrationToken: true, fullName: true },
      });
      if (pending) {
        await prisma.$transaction([
          prisma.oAuthIdentity.create({
            data: {
              provider,
              subject,
              kind,
              email,
              pendingCustomerId: pending.id,
            },
          }),
          prisma.pendingCustomer.update({
            where: { id: pending.id },
            data: { emailVerified: true },
          }),
        ]);
        return {
          type: "registration",
          registrationToken: pending.registrationToken,
          profileComplete: isCustomerProfileComplete(pending),
        };
      }
    } else {
      const advertiser = await prisma.advertiser.findUnique({
        where: { email },
        select: { id: true, uid: true, jwtVersion: true },
      });
      if (advertiser) {
        await prisma.oAuthIdentity.create({
          data: { provider, subject, kind, email, advertiserId: advertiser.id },
        });
        return { type: "login", account: advertiser };
      }
      const pending = await prisma.pendingAdvertiserAccount.findUnique({
        where: { email },
        select: { id: true, registrationToken: true },
      });
      if (pending) {
        await prisma.$transaction([
          prisma.oAuthIdentity.create({
            data: {
              provider,
              subject,
              kind,
              email,
              pendingAdvertiserId: pending.id,
            },
          }),
          prisma.pendingAdvertiserAccount.update({
            where: { id: pending.id },
            data: { emailVerified: true },
          }),
        ]);
        return {
          type: "registration",
          registrationToken: pending.registrationToken,
          profileComplete: true,
        };
      }
    }
  }

  // 3) Brand-new account. Requires a provider-VERIFIED email — `email` is null
  // here either because the provider returned none, or returned an unverified
  // one (which we refuse to trust for account creation or linking). Both are
  // hard rejects; the distinct code separates them for observability.
  if (!email) {
    throw createCustomError(
      rawEmail ? 2239 : 2235,
      rawEmail
        ? "Sign-in email address is not verified by the provider"
        : "Sign-in provider did not return an email address",
      400,
    );
  }

  const now = new Date();
  const registrationToken = generateSecureToken();

  if (kind === "CUSTOMER") {
    const created = await prisma.pendingCustomer.create({
      data: {
        email,
        registrationToken,
        locale,
        language,
        emailVerified: true,
        agreedToTermsOfServiceAt: now,
        agreedToPrivacyPolicyAt: now,
        oauthIdentities: { create: { provider, subject, kind, email } },
      },
      select: { registrationToken: true },
    });
    return {
      type: "registration",
      registrationToken: created.registrationToken,
      profileComplete: false,
    };
  }

  const created = await prisma.pendingAdvertiserAccount.create({
    data: {
      email,
      registrationToken,
      locale,
      language,
      emailVerified: true,
      agreedToTermsOfServiceAt: now,
      agreedToPrivacyPolicyAt: now,
      oauthIdentities: { create: { provider, subject, kind, email } },
    },
    select: { registrationToken: true },
  });
  return {
    type: "registration",
    registrationToken: created.registrationToken,
    profileComplete: true,
  };
}
