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
  getAdvertiserReferrals,
  updateReferralCode,
  updateReferrerCode,
} from "@tagly/sdk/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";

/**
 * Referral settings — the "config" half of referrals (the stats + share hub lives
 * on `/referrals`, which links here). Twin of the customer referral settings.
 * Two fields:
 *  - **Your code** — changeable **once** (locked afterwards).
 *  - **Who referred you** — only relevant in the first 24h after sign-up: editable
 *    inside that window (once), read-only once set, and hidden afterwards if never
 *    set.
 *
 * Adaptation vs the customer twin: `AdvertiserMe` does not expose
 * `referralCodeUpdatedAt`, so the "your code" field can't be pre-locked on load.
 * Instead it starts editable and locks on a successful change OR on the backend's
 * `1219` ("already changed once") — so a code that was changed on another device
 * still gets a clear, correct outcome. The signup window for the referrer field
 * uses `advertiser.createdAt`.
 */
export default function ReferralSettingsScreen() {
  const { t } = useTranslation("settingsReferrals");
  const { t: ts } = useTranslation("settingsAdvertiser");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const { advertiser } = useAdvertiser();

  const [code, setCode] = useState<string | null>(null);
  const [referrer, setReferrer] = useState<string | null>(null);
  // No `referralCodeUpdatedAt` on `AdvertiserMe`, so we can't pre-lock — start
  // editable and lock on a successful change or a `1219` from the server.
  const [codeLocked, setCodeLocked] = useState(false);

  const load = useCallback(async () => {
    const res = await callAuthed(router, (jwt) =>
      getAdvertiserReferrals({ jwt }),
    );
    if (res.ok && res.data) {
      setCode(res.data.referrals.code);
      setReferrer(res.data.referrals.referredEvent?.referrerCode.code ?? null);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  // Referrer: one-time, only within 24h of sign-up. Show it while it's still
  // settable, or once it's set (read-only); hide it otherwise.
  const alreadyReferred = referrer != null;
  const createdAt = advertiser?.createdAt ? new Date(advertiser.createdAt) : null;
  const withinWindow = createdAt
    ? Date.now() - createdAt.getTime() <
      ACCOUNT_UPDATE_COOLDOWNS.referrerCodeSinceCreatedMs
    : false;

  const isValidCode = (v: string) =>
    /^[a-z0-9_.-]+$/i.test(v) && !v.endsWith(".") ? null : t("codeInvalid");

  const saveCode = async (referralCode: string): Promise<boolean> => {
    const res = await callAuthed(
      router,
      (jwt) => updateReferralCode({ jwt, body: { referralCode } }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok) {
      const c = res.error?.error.code;
      if (c === 1220) {
        customAlert(t("codeTakenTitle"), t("codeTakenBody"));
      } else if (c === 1219) {
        // Already changed once (possibly on another device) — lock the field.
        setCodeLocked(true);
        customAlert(t("codeAlreadyChangedTitle"), t("codeAlreadyChangedBody"));
      }
      return false;
    }
    if (!res.data) return false;
    setCode(res.data.referralCode);
    setCodeLocked(true);
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
      } else if (c === 1006) {
        customAlert(t("referrerClosedTitle"), t("referrerClosedBody"));
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
              disabled={codeLocked}
              note={codeLocked ? t("codeUsedNote") : t("codeOnceWarning")}
              validate={isValidCode}
              confirmLabel={t("codeConfirmLabel")}
              onSave={saveCode}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={t("referrerSection")} />
            {alreadyReferred ? (
              <SettingCard
                icon="person-add-outline"
                heading={t("referrerHeading")}
                note={t("referrerSetNote")}
              >
                <Text style={[text.bodyMedium, { color: color.text.primary }]}>
                  {referrer}
                </Text>
              </SettingCard>
            ) : withinWindow ? (
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
            ) : (
              // Window closed and never set: show the field read-only (no editing
              // affordance) with a note explaining it can no longer be set, rather
              // than hiding it entirely.
              <SettingCard
                icon="person-add-outline"
                heading={t("referrerHeading")}
                note={t("referrerClosedNote")}
              >
                <Text style={[text.body, { color: color.text.tertiary }]}>
                  {t("referrerClosedValue")}
                </Text>
              </SettingCard>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
