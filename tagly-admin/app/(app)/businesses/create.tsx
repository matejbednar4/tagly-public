import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  useTheme,
  TopMenu,
  showToast,
  pressFeedbackStyle,
  CreateBusinessWizard,
  useBlockBackWhile,
} from "@tagly/client";
import {
  adminCreateBusinessInit,
  adminCreateBusinessConfirm,
} from "@tagly/sdk/v2/adminApp";
import type { SupportedLocale } from "@tagly/models/shared";
import { LOCAL_KEYS } from "@/constants/storageKeys";

/**
 * Create a business page (Manage tab) — the admin host of the shared
 * `CreateBusinessWizard`, wired to the `/v2/admin/businesses/{init,confirm}`
 * twins. The created page is UNOWNED (`advertiserId: null` — the subsidized
 * track); subsidizing it is a separate admin action, so a fresh page is
 * customer-visible but not yet shareable.
 *
 * Admin has no locale of its own, so step 1 carries a US / CZ market selector
 * (rendered via the wizard's `stepHeader` slot) — it locks the address country
 * + region list exactly like the advertiser's own locale does. `enableTags`
 * adds the admin-only search-aliases section to the details step.
 *
 * While a create is in flight the TopMenu is hidden and `useBlockBackWhile`
 * blocks the edge-swipe + hardware back, so a half-done init/confirm can't be
 * abandoned (same treatment as the advertiser create host).
 */
export default function AdminCreateBusinessScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [locale, setLocale] = useState<SupportedLocale>("US");
  const [submitting, setSubmitting] = useState(false);
  useBlockBackWhile(submitting);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.background }}>
      {!submitting && <TopMenu title="Create business page" showBack hideMenu />}
      <CreateBusinessWizard
        topInset={false}
        api={{
          init: (jwt, body) => adminCreateBusinessInit({ jwt, body }),
          confirm: (jwt, body) => adminCreateBusinessConfirm({ jwt, body }),
        }}
        locale={locale}
        draftKey={LOCAL_KEYS.ADMIN_CREATE_BUSINESS_DRAFT}
        enableTags
        onSubmittingChange={setSubmitting}
        stepHeader={(step) =>
          step === 0 ? (
            <MarketSelector locale={locale} onChange={setLocale} />
          ) : undefined
        }
        onCreated={(business) => {
          showToast({ type: "success", text1: `${business.name} created` });
          router.replace(`/businesses/${business.uid}`);
        }}
      />
    </View>
  );
}

/**
 * US / CZ market chips (the standard selected-pill pattern: ink fill selected,
 * white + chip shadow unselected). Sits in step 1's header slot so it scrolls
 * with the form. Switching mid-typing keeps the fields; a region picked under
 * the other market simply fails the address check and gets re-picked.
 */
function MarketSelector({
  locale,
  onChange,
}: {
  locale: SupportedLocale;
  onChange: (locale: SupportedLocale) => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow } = theme;

  const chip = (value: SupportedLocale, label: string) => {
    const on = locale === value;
    return (
      <Pressable
        key={value}
        onPress={() => onChange(value)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={({
          pressed,
          hovered,
        }: {
          pressed: boolean;
          hovered?: boolean;
        }) => [
          {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.pill,
            backgroundColor: on ? color.ink : color.surface,
            boxShadow: shadow.chip,
          },
          pressFeedbackStyle({ pressed, hovered }),
        ]}
      >
        <Text
          style={[text.label, { color: on ? color.on.ink : color.text.primary }]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.sm,
      }}
    >
      {chip("US", "United States")}
      {chip("CZ", "Czechia")}
    </View>
  );
}
