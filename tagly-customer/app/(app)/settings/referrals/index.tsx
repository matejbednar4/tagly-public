import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  callAuthed,
  customAlert,
  EditableSetting,
  Loading,
  SectionHeader,
  SettingCard,
  TopMenu,
  useTheme,
} from "@tagly/client";
import { ACCOUNT_UPDATE_COOLDOWNS } from "@tagly/models/shared";
import {
  getReferrals,
  updateReferralCode,
  updateReferrerCode,
} from "@tagly/sdk/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";

/**
 * Referral settings — the "config" half of referrals (the stats + share hub lives
 * on `/referrals`, which links here). Two fields:
 *  - **Your code** — changeable **once** (locked afterwards via
 *    `referralCodeUpdatedAt`).
 *  - **Who referred you** — only relevant in the first 24h after sign-up: editable
 *    inside that window (once), read-only once set, and hidden afterwards if never
 *    set. It's a one-time write that establishes the referral relationship.
 * Current code + referrer come from `/me/referrals`; lock/window state from
 * `useCustomer`.
 */
export default function ReferralSettingsScreen() {
  const { t } = useTranslation("settingsReferrals");
  const { t: ts } = useTranslation("settings");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const { customer, setCustomer } = useCustomer();

  const [code, setCode] = useState<string | null>(null);
  const [referrer, setReferrer] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await callAuthed(router, (jwt) => getReferrals({ jwt }));
    if (res.ok && res.data) {
      setCode(res.data.referrals.code);
      setReferrer(res.data.referrals.referredEvent?.referrerCode.code ?? null);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  // One-time change: once `referralCodeUpdatedAt` is set, the code is locked.
  const alreadyChanged = customer?.referralCodeUpdatedAt != null;

  // Referrer: one-time, only within 24h of sign-up. Show it while it's still
  // settable, or once it's set (read-only); hide it otherwise.
  const alreadyReferred = referrer != null;
  const createdAt = customer?.createdAt ? new Date(customer.createdAt) : null;
  const withinWindow = createdAt
    ? Date.now() - createdAt.getTime() <
      ACCOUNT_UPDATE_COOLDOWNS.referrerCodeSinceCreatedMs
    : false;
  const showReferrer = alreadyReferred || withinWindow;

  const isValidCode = (v: string) =>
    /^[a-z0-9_.-]+$/i.test(v) && !v.endsWith(".") ? null : t("codeInvalid");

  const saveCode = async (referralCode: string): Promise<boolean> => {
    const res = await callAuthed(
      router,
      (jwt) => updateReferralCode({ jwt, body: { referralCode } }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok) {
      if (res.error?.error.code === 1220) {
        customAlert(t("codeTakenTitle"), t("codeTakenBody"));
      }
      return false;
    }
    if (!res.data) return false;
    const data = res.data;
    setCode(data.referralCode);
    setCustomer((prev) =>
      prev
        ? { ...prev, referralCodeUpdatedAt: data.referralCodeUpdatedAt }
        : prev,
    );
    return true;
  };

  const saveReferrer = async (referrerCode: string): Promise<boolean> => {
    const res = await callAuthed(
      router,
      (jwt) => updateReferrerCode({ jwt, body: { referrerCode } }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok) {
      const c = res.error?.error.code;
      if (c === 1004) {
        customAlert(t("referrerInvalidTitle"), t("referrerInvalidBody"));
      } else if (c === 1005) {
        customAlert(t("referrerSelfTitle"), t("referrerSelfBody"));
      } else {
        customAlert(t("referrerErrorTitle"), t("referrerErrorBody"));
      }
      return false;
    }
    if (!res.data) return false;
    setReferrer(res.data.referrerCode);
    return true;
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} subheading={ts("title")} showBack />
      {code === null ? (
        <Loading fullscreen />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: layout.screenPadding,
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + layout.screenPadding,
            gap: spacing.xl,
          }}
        >
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={t("codeSection")} />
            <EditableSetting
              icon="pricetag-outline"
              heading={t("codeHeading")}
              value={code}
              placeholder={t("codePlaceholder")}
              autoCapitalize="none"
              disabled={alreadyChanged}
              note={alreadyChanged ? t("codeUsedNote") : t("codeOnceWarning")}
              validate={isValidCode}
              confirmLabel={t("codeConfirmLabel")}
              onSave={saveCode}
            />
          </View>

          {showReferrer ? (
            <View style={{ gap: spacing.sm }}>
              <SectionHeader title={t("referrerSection")} />
              {alreadyReferred ? (
                <SettingCard
                  icon="person-add-outline"
                  heading={t("referrerHeading")}
                  note={t("referrerSetNote")}
                >
                  <Text
                    style={[text.bodyMedium, { color: color.text.primary }]}
                  >
                    {referrer}
                  </Text>
                </SettingCard>
              ) : (
                <EditableSetting
                  icon="person-add-outline"
                  heading={t("referrerHeading")}
                  value=""
                  placeholder={t("referrerPlaceholder")}
                  autoCapitalize="none"
                  note={t("referrerNote")}
                  editLabel={t("addReferrer")}
                  validate={isValidCode}
                  confirmLabel={t("referrerConfirmLabel")}
                  onSave={saveReferrer}
                />
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
