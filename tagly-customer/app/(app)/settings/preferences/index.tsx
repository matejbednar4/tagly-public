import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trans, useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  callAuthed,
  customAlert,
  LOCALE_FLAG,
  PressableText,
  pressFeedbackStyle,
  showToast,
  SupportSheet,
  TopMenu,
  useBusinessMapCache,
  useTheme,
  useUserPreferences,
} from "@tagly/client";
import {
  getConnectStatus,
  updateLanguage,
  updateLocale,
} from "@tagly/sdk/v2/customerApp";
import type { SupportedLocale } from "@tagly/models/shared";
import { useCustomer } from "@/contexts/Customer";

type Language = "en" | "cs";

/**
 * App preferences — the two device-scoped display settings driven by
 * `UserPreferencesContext` (language, distance unit) plus the account-scoped
 * **region**.
 *
 * Distance unit is purely local. **Language** is the exception: the
 * in-app display language is local (instant, via `setDisplayLanguage` → i18next),
 * but we also fire `POST /v2/customers/me/update/language` so the backend renders
 * server-sent copy (transactional push + email) in the same language. That call is
 * best-effort — the local switch already gave instant feedback, and the device
 * preference is authoritative for display, so a transient failure only leaves the
 * email/push language momentarily out of sync (callAuthed surfaces the error).
 *
 * **Region** (`locale`, US↔CZ) is server state, not a device preference: it picks
 * the display currency and the country the Stripe Express payout account is created
 * in. Stripe locks that country at account creation, so the control is offered only
 * while no Connect account exists — after that it stays **visible but disabled**
 * (with a support affordance) rather than disappearing, so the current region is
 * still discoverable. The gate is fail-closed: until the connect-status probe
 * confirms there's no account, the control is locked. The server enforces the same
 * rule regardless (1721), so this only avoids offering a switch we can't honor.
 * The other self-serve entry point is the withdraw screen's region gate.
 *
 * Each setting is a connected segmented control (a white track lifted by
 * `shadow.chip`, with the selected option an inset `color.ink` pill), headed by an
 * icon + label.
 */
export default function PreferencesSettingsScreen() {
  const { t } = useTranslation("settingsPreferences");
  const { t: ts } = useTranslation("settings");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, spacing, layout, text } = theme;
  const { customer, reloadCustomer } = useCustomer();
  const { resetCache } = useBusinessMapCache();
  const {
    distanceUnit,
    setDistanceUnit,
    displayLanguage,
    setDisplayLanguage,
    hydrated,
  } = useUserPreferences();

  // `null` while the probe is in flight. Fail closed: an unresolved or failed
  // probe locks the region control (see the region note in the docblock).
  const [hasConnectAccount, setHasConnectAccount] = useState<boolean | null>(
    null,
  );
  const [switchingRegion, setSwitchingRegion] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const regionLocked = hasConnectAccount !== false || switchingRegion;

  // Cheap DB-backed read (no `sync` — we only need "does an account exist", and
  // the account.updated webhook keeps that fresh). Alerts are suppressed: this is
  // a background probe on a settings screen, and failure just leaves the control
  // locked rather than warranting a popup.
  useEffect(() => {
    (async () => {
      const res = await callAuthed(router, (jwt) => getConnectStatus({ jwt }), {
        suppressAlerts: true,
      });
      setHasConnectAccount(res.ok && res.data ? res.data.hasAccount : true);
    })();
  }, [router]);

  // Switch the in-app language instantly, then sync the server-side language for
  // push/email (best-effort — display already updated locally).
  const onSelectLanguage = (lang: Language) => {
    if (lang === displayLanguage) return;
    setDisplayLanguage(lang);
    void callAuthed(router, (jwt) =>
      updateLanguage({ jwt, body: { language: lang } }),
    );
  };

  const switchRegion = async (next: SupportedLocale) => {
    setSwitchingRegion(true);
    try {
      const res = await callAuthed(
        router,
        (jwt) => updateLocale({ jwt, body: { locale: next } }),
        { handleSpecificErrorManually: true },
      );
      if (!res.ok) {
        // 1721 = a payout account was created since our probe (another device /
        // a stale screen). Lock the control and hand the user to support.
        if (res.error?.error.code === 1721) {
          setHasConnectAccount(true);
          setSupportOpen(true);
        }
        return;
      }
      // Re-read the customer so the currency (ExchangeRateProvider is fed
      // `customer.locale`) and every other locale-driven surface follow.
      await reloadCustomer();
      // Business discovery is country-scoped server-side (every business endpoint
      // filters on `address.country_code = customer.locale`), so the map's cached
      // tiles/locals are now the wrong country. Drop them or the map keeps showing
      // the old market until something else resets it.
      resetCache();
      showToast({ type: "success", text1: t("regionUpdatedToast") });
    } finally {
      setSwitchingRegion(false);
    }
  };

  // Confirm first: the pick decides which country Stripe will create the payout
  // account in, and that becomes permanent the moment onboarding starts.
  const promptSwitchRegion = (next: SupportedLocale) => {
    if (regionLocked || !customer || next === customer.locale) return;
    customAlert(
      t("regionSwitchTitle"),
      t("regionSwitchBody", {
        country: t(`country.${next}` as "country.US" | "country.CZ"),
      }),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("regionSwitchConfirm"), onPress: () => void switchRegion(next) },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} subheading={ts("title")} showBack />
      {hydrated ? (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: layout.screenPadding,
            paddingTop: spacing.xl,
            paddingBottom: insets.bottom + layout.screenPadding,
            gap: spacing.xl,
          }}
        >
          <PrefBlock icon="language-outline" title={t("languageSection")}>
            <Segmented
              selected={displayLanguage}
              options={[
                { value: "en", label: t("languageEn") },
                { value: "cs", label: t("languageCs") },
              ]}
              onSelect={(v) => onSelectLanguage(v as Language)}
            />
          </PrefBlock>

          <PrefBlock icon="navigate-outline" title={t("distanceSection")}>
            <Segmented
              selected={distanceUnit}
              options={[
                { value: "KM", label: t("distanceKm") },
                { value: "MI", label: t("distanceMi") },
              ]}
              onSelect={(v) => setDistanceUnit(v as "KM" | "MI")}
            />
          </PrefBlock>

          {/* Rendered only once the customer is known — a segmented control with
              no segment selected would read as broken. */}
          {customer ? (
            <PrefBlock icon="globe-outline" title={t("regionSection")}>
              <Segmented
                selected={customer.locale}
                disabled={regionLocked}
                options={[
                  { value: "US", label: `${LOCALE_FLAG.US}  ${t("regionUs")}` },
                  { value: "CZ", label: `${LOCALE_FLAG.CZ}  ${t("regionCz")}` },
                ]}
                onSelect={(v) => promptSwitchRegion(v as SupportedLocale)}
              />
              {/* Locked: "contact support" is an in-text link (only part of the
                  run is tappable), so PressableText rather than a button. */}
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {hasConnectAccount ? (
                  <Trans
                    t={t}
                    i18nKey="regionLockedNote"
                    components={{
                      support: (
                        <PressableText
                          onPress={() => setSupportOpen(true)}
                          style={text.caption}
                        />
                      ),
                    }}
                  />
                ) : (
                  t("regionNote")
                )}
              </Text>
            </PrefBlock>
          ) : null}
        </ScrollView>
      ) : null}

      <SupportSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        context="settings-region"
      />
    </View>
  );
}

/** A preference block: an icon + label header above its segmented control. */
function PrefBlock({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { color, spacing, text } = theme;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Ionicons name={icon} size={18} color={color.text.secondary} />
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

/**
 * A connected segmented control: a single white track lifted off the cream page by
 * `shadow.chip`, holding equal-width segments. The selected segment is an inset
 * `color.ink` pill (`on.ink` label); unselected segments are transparent over the
 * track (`text.secondary` label). Reads as one control, not floating pills.
 *
 * `disabled` dims the whole track and blocks presses while still showing which
 * option is active — used by the region setting, which stays readable after the
 * payout account locks it.
 */
function Segmented({
  options,
  selected,
  onSelect,
  disabled = false,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const { color, spacing, radius, shadow, text } = theme;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.xs,
        padding: spacing.xs,
        backgroundColor: color.surface,
        borderRadius: radius.pill,
        boxShadow: shadow.chip,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(opt.value)}
            style={({ pressed, hovered }) => [
              {
                flex: 1,
                minHeight: 40,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                backgroundColor: isSelected ? color.ink : "transparent",
              },
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                text.label,
                { color: isSelected ? color.on.ink : color.text.secondary },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
