import { useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  callAuthed,
  customAlert,
  alertBusinessFormError,
  showToast,
  TopMenu,
  useTheme,
  StepBasics,
  type BasicsValues,
} from "@tagly/client";
import { adminUpdateBusiness } from "@tagly/sdk/v2/adminApp";
import type { AdminUpdateBusinessBody } from "@tagly/models/v2/adminApp";
import type { LocalSubaccountUid } from "@tagly/models/shared";
import { useAdminBusiness } from "@/hooks/useAdminBusiness";

/**
 * Admin edit of a business's name, type & address — the shared `StepBasics`
 * form (same one the advertiser edit + create wizard use) over
 * `PATCH /v2/admin/businesses/:uid`. Only changed fields are sent; an address
 * change is sent whole (the backend re-geocodes; the locale ↔ country
 * invariant applies only when the page HAS an advertiser). Country stays
 * locked to the page's current market. Confirm-guarded per the admin
 * destructive-actions rule (uses the canonical `saveConfirm*` copy).
 */
export default function AdminEditBusinessBasicsScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { t } = useTranslation("businessPageForm");
  const { theme } = useTheme();
  const { color } = theme;

  const { business: data } = useAdminBusiness(uid);
  const locale = data?.address.countryCode === "CZ" ? "CZ" : "US";

  const [values, setValues] = useState<BasicsValues | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed the form once from the loaded business (the geocoder-normalized
  // stored fields).
  useEffect(() => {
    if (data && !values) {
      setValues({
        name: data.name,
        typeSlug: data.type.slug,
        street: data.address.street,
        zip: data.address.zip,
        city: data.address.city,
        region: data.address.region ?? null,
      });
    }
  }, [data, values]);

  const save = async () => {
    if (!data || !values || saving) return;
    Keyboard.dismiss();

    const addressChanged =
      values.street.trim() !== data.address.street ||
      values.zip.trim() !== data.address.zip ||
      values.city.trim() !== data.address.city ||
      (values.region ?? null) !== (data.address.region ?? null);

    const body: AdminUpdateBusinessBody = {};
    if (values.name.trim() !== data.name) body.name = values.name;
    if (values.typeSlug && values.typeSlug !== data.type.slug) {
      body.typeSlug = values.typeSlug;
    }
    if (addressChanged) {
      body.address = {
        country: locale === "CZ" ? "Czechia" : "United States",
        city: values.city,
        region: values.region,
        zip: values.zip,
        street: values.street,
      };
    }
    if (Object.keys(body).length === 0) {
      router.back();
      return;
    }

    // Confirm before committing (admin rule: every live-data write confirms).
    customAlert(t("saveConfirmTitle"), t("saveConfirmBody"), [
      { text: t("saveConfirmCancel"), style: "cancel" },
      { text: t("saveConfirmCta"), onPress: () => void commit(body) },
    ]);
  };

  const commit = async (body: AdminUpdateBusinessBody) => {
    if (saving) return;
    setSaving(true);
    const res = await callAuthed(
      router,
      (jwt) =>
        adminUpdateBusiness({
          jwt,
          params: { uid: uid as LocalSubaccountUid },
          body,
        }),
      { handleSpecificErrorManually: true },
    );
    setSaving(false);
    if (!res.ok || !res.data) {
      // Shared mapper — names the exact field when the backend attached it.
      alertBusinessFormError(
        !res.ok ? res.error?.error.code : undefined,
        !res.ok ? res.error?.error.errors : undefined,
        {
          mode: "edit",
          countryLabel: t(locale === "CZ" ? "countryCz" : "countryUs"),
        },
      );
      return;
    }

    showToast({ type: "success", text1: t("savedToast") });
    router.back(); // the detail screen refetches on focus
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu
        title={t("basicsEditTitle")}
        showBack
        hideMenu
        subheading={data?.name}
      />
      {!values ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      ) : (
        <StepBasics
          topInset={false}
          values={values}
          onChange={(patch) => setValues((v) => v && { ...v, ...patch })}
          locale={locale}
          onContinue={() => void save()}
          ctaLabel={t("save")}
          loading={saving}
        />
      )}
    </View>
  );
}
