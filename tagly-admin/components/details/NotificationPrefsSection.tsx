import { notificationEventBySlug } from "@tagly/models/shared";
import type { AdminNotificationPref, AdminAuthIdentity } from "@tagly/models/v2/adminApp";
import { StatSection } from "@/components/statistics/StatKit";
import { InfoRows, type InfoRow } from "@/components/details/DetailKit";

/**
 * Per-event notification preferences (§B.5) — one row per transactional event
 * with the EFFECTIVE push/email state (mandatory channels render as "always").
 * Shared by the customer and advertiser detail screens. Labels come from the
 * shared notification catalog (English — admin convention); unknown slugs fall
 * back to the raw slug.
 */
export function NotificationPrefsSection({
  prefs,
}: {
  prefs: AdminNotificationPref[];
}) {
  if (prefs.length === 0) return null;

  // "always" = mandatory (the account can't turn it off); null channel = the
  // event doesn't offer it at all.
  const channelState = (
    pref: AdminNotificationPref,
    channel: "PUSH" | "EMAIL",
  ): string | null => {
    const value = channel === "PUSH" ? pref.push : pref.email;
    if (value == null) return null;
    const name = channel === "PUSH" ? "Push" : "Email";
    if (pref.mandatoryChannels.includes(channel)) return `${name} always`;
    return `${name} ${value ? "on" : "off"}`;
  };

  const rows: InfoRow[] = prefs.map((pref) => {
    const parts = [
      channelState(pref, "PUSH"),
      channelState(pref, "EMAIL"),
    ].filter((p): p is string => p != null);
    const allOff = pref.push !== true && pref.email !== true;
    return {
      label: notificationEventBySlug.get(pref.slug)?.label.en ?? pref.slug,
      value: parts.length > 0 ? parts.join(" · ") : "—",
      tone: allOff ? "muted" : "default",
    };
  });

  const pushOnCount = prefs.filter((p) => p.push === true).length;

  return (
    <StatSection
      title="Notification preferences"
      icon="notifications-outline"
      tint="accent"
      summary={`${pushOnCount}/${prefs.length} push on`}
    >
      <InfoRows rows={rows} />
    </StatSection>
  );
}

/** "Google (g@…), Apple" or "Email code only" — the Account section's sign-in row. */
export function formatAuthIdentities(
  identities: AdminAuthIdentity[],
): string {
  if (identities.length === 0) return "Email code only";
  return identities
    .map((i) => {
      const name = i.provider === "GOOGLE" ? "Google" : "Apple";
      return i.email ? `${name} (${i.email})` : name;
    })
    .join(", ");
}
