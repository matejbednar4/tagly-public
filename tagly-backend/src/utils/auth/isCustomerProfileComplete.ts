/**
 * A customer's onboarding profile is complete once they have a full name — the
 * single field the profile step writes. Centralized so every flow that reports
 * onboarding resume state (OAuth sign-in, OTP verify, registration-token check)
 * shares one definition of "profile complete" instead of re-deriving
 * `fullName !== null` inline at each call site.
 */
export function isCustomerProfileComplete(pendingCustomer: {
  fullName: string | null;
}): boolean {
  return pendingCustomer.fullName !== null;
}
