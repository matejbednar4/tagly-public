import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  useTheme,
  callAuthed,
  customAlert,
  CustomButton,
  CustomTextInput,
  BottomSheet,
} from "@tagly/client";
import { adminSetAdvertiserReferrer } from "@tagly/sdk/v2/adminApp";
import type { AdminAdvertiser } from "@tagly/models/v2/adminApp";
import { StatSection } from "@/components/statistics/StatKit";
import { InfoRows, type InfoRow } from "@/components/details/DetailKit";
import { formatInt, formatDateTime } from "@/utils/format";

/**
 * The Referral section of the admin advertiser detail screen: the account's own
 * code + counts, who referred it, and — when nobody did — the action that links
 * it to the influencer who actually brought it.
 *
 * That action exists because the referral is routinely lost in sales-assisted
 * onboarding: an influencer brings a business, the salesperson signs them up,
 * and nobody tells the business to enter the code, so the commission
 * relationship never gets created. `POST /v2/admin/advertisers/:uid/referrer`
 * creates it after the fact.
 *
 * It is deliberately **set-only** — the button is absent once a referrer exists,
 * and the server 409s regardless, so commissions can never be redirected from
 * here. The acting admin is stamped on the referral event and surfaced back in
 * these rows. `onDone` refetches so the new referrer shows immediately.
 */
export function AdvertiserReferralSection({
  advertiser,
  onDone,
}: {
  advertiser: AdminAdvertiser;
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const { spacing, text, color } = theme;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const referral = advertiser.referral;
  const referredBy = referral.referredBy;

  // Mirrors ReferralCodeSchema (a-z 0-9 _ . -, no trailing dot). The server
  // stays authoritative — this only keeps the submit button honest.
  const normalizedCode = code.trim().toLowerCase();
  const codeValid =
    /^[a-z0-9_.-]+$/.test(normalizedCode) &&
    !normalizedCode.endsWith(".") &&
    normalizedCode !== referral.code;

  const submit = () => {
    if (!codeValid) return;
    customAlert(
      `Set "${normalizedCode}" as the referrer?`,
      `${advertiser.email} will count as referred by this code from now on, and its owner starts earning referral commission on this business. This cannot be changed or undone afterwards. Shares that already settled keep the payouts they had.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Set referrer",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                const res = await callAuthed(
                  router,
                  (jwt) =>
                    adminSetAdvertiserReferrer({
                      jwt,
                      params: { uid: advertiser.uid },
                      body: {
                        referrerCode: normalizedCode,
                        ...(reason.trim() ? { reason: reason.trim() } : {}),
                      },
                    }),
                  { handleSpecificErrorManually: true },
                );
                if (res.ok) {
                  setOpen(false);
                  setCode("");
                  setReason("");
                  onDone();
                  return;
                }
                // A mistyped code is the likely failure here, so the server's
                // own message ("Invalid referrer code", "already has a
                // referrer") is worth far more than the generic alert the
                // caller would otherwise show for a domain code.
                const err = res.error?.error;
                if (err && typeof err.code === "number" && err.code >= 1000) {
                  customAlert("Could not set referrer", err.message);
                }
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const rows: InfoRow[] = [
    { label: "Code", value: referral.code },
    { label: "Status", value: referral.status },
    {
      label: "Referred users",
      value: formatInt(referral.referredUsersCount),
    },
    {
      label: "Referred businesses",
      value: formatInt(referral.referredBusinessesCount),
    },
    referredBy
      ? {
          label: "Referred by",
          value: `${referredBy.code} (${referredBy.referrerType}) · ${formatDateTime(referredBy.at)}`,
          onPress: () => {
            router.push(
              referredBy.referrerType === "customer"
                ? `/customers/${referredBy.referrerUid}`
                : `/advertisers/${referredBy.referrerUid}`,
            );
          },
        }
      : { label: "Referred by", value: "Organic" },
  ];

  // Audit trail — only present when an admin linked the accounts after the fact.
  if (referredBy?.setByAdmin) {
    rows.push({
      label: "Linked by admin",
      value: referredBy.setByAdmin.username,
      tone: "muted",
    });
    if (referredBy.setByAdmin.reason) {
      rows.push({
        label: "Reason",
        value: referredBy.setByAdmin.reason,
        tone: "muted",
      });
    }
  }

  return (
    <>
      <StatSection
        title="Referral"
        icon="gift-outline"
        tint="brand"
        summary={referral.code}
      >
        <InfoRows rows={rows} />
        {referredBy ? null : (
          <View style={{ flexBasis: "100%" }}>
            <CustomButton
              type="secondary"
              label="Set referrer"
              icon="person-add-outline"
              onPress={() => setOpen(true)}
            />
          </View>
        )}
      </StatSection>

      <BottomSheet open={open} onClose={busy ? undefined : () => setOpen(false)}>
        <View style={{ gap: spacing.lg }}>
          <Text style={[text.body, { color: color.text.secondary }]}>
            Use this when an influencer brought the business but the code was
            never entered during onboarding. It can only be set once.
          </Text>
          <CustomTextInput
            heading="Referrer code"
            subheading="The code of the customer or business that referred this account."
            placeholder="influencer.code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
            error={
              code.trim() && !codeValid
                ? normalizedCode === referral.code
                  ? "That is this advertiser's own code"
                  : "Only a-z, 0-9, underscore, dot and dash; cannot end with a dot"
                : undefined
            }
          />
          <CustomTextInput
            heading="Reason (optional)"
            subheading="Stored on the referral event for the audit trail."
            placeholder="Why is this being linked after the fact?"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <CustomButton
            type="primary"
            label="Set referrer"
            disabled={!codeValid || busy}
            loading={busy}
            onPress={submit}
          />
        </View>
      </BottomSheet>
    </>
  );
}
