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
  StepDetails,
  normalizeUrl,
  parseBusinessTags,
  toWeekHours,
  weekHoursToPeriods,
  type DetailsValues,
  type WeekHours,
} from "@tagly/client";
import { adminUpdateBusiness } from "@tagly/sdk/v2/adminApp";
import type { LocalSubaccountUid } from "@tagly/models/shared";
import { useAdminBusiness } from "@/hooks/useAdminBusiness";

/**
 * Admin edit of a business's details & hours — the shared `StepDetails` form
 * with the admin-only search-tags section (`enableTags`) over
 * `PATCH /v2/admin/businesses/:uid`. Saves the whole detail set with
 * `trim() || null` semantics (a deselected chip clears its field), hours
 * replace-all, and `tags` replace-all. Link URLs re-sent unchanged keep their
 * `Link` row + moderation status; a new URL enters PENDING review.
 */
export default function AdminEditBusinessDetailsScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { t } = useTranslation("businessPageForm");
  const { theme } = useTheme();
  const { color } = theme;

  const { business: data } = useAdminBusiness(uid);
  const locale = data?.address.countryCode === "CZ" ? "CZ" : "US";

  const [values, setValues] = useState<DetailsValues | null>(null);
  const [hours, setHours] = useState<WeekHours>({});
  const [saving, setSaving] = useState(false);

  // Seed once from the loaded business.
  useEffect(() => {
    if (data && !values) {
      setValues({
        description: data.description ?? "",
        instagramTag: data.instagramTag ?? "",
        websiteUrl: data.websiteLink?.url ?? "",
        reservationUrl: data.reservationLink?.url ?? "",
        menuUrl: data.menuLink?.url ?? "",
        phoneNumber: data.phoneNumber ?? "",
        contactEmail: data.contactEmail ?? "",
        tags: data.tags.join(", "),
      });
      setHours(toWeekHours(data.openingHours));
    }
  }, [data, values]);

  const save = async () => {
    if (!data || !values || saving) return;
    Keyboard.dismiss();
    customAlert(t("saveConfirmTitle"), t("saveConfirmBody"), [
      { text: t("saveConfirmCancel"), style: "cancel" },
      { text: t("saveConfirmCta"), onPress: () => void commit() },
    ]);
  };

  const commit = async () => {
    if (!data || !values || saving) return;
    setSaving(true);

    const res = await callAuthed(
      router,
      (jwt) =>
        adminUpdateBusiness({
          jwt,
          params: { uid: uid as LocalSubaccountUid },
          body: {
            description: values.description.trim() || null,
            instagramTag: values.instagramTag.trim() || null,
            // Add the scheme the user may have omitted (cafetagly.com → https://…).
            websiteUrl: normalizeUrl(values.websiteUrl) || null,
            reservationUrl: normalizeUrl(values.reservationUrl) || null,
            menuUrl: normalizeUrl(values.menuUrl) || null,
            phoneNumber: values.phoneNumber.trim() || null,
            contactEmail: values.contactEmail.trim() || null,
            openingHours: weekHoursToPeriods(hours),
            tags: parseBusinessTags(values.tags),
          },
        }),
      { handleSpecificErrorManually: true },
    );
    setSaving(false);
    if (!res.ok || !res.data) {
      // Shared mapper — names the exact field when the backend attached it.
      alertBusinessFormError(
        !res.ok ? res.error?.error.code : undefined,
        !res.ok ? res.error?.error.errors : undefined,
        { mode: "edit" },
      );
      return;
    }

    showToast({ type: "success", text1: t("savedToast") });
    router.back(); // the detail screen refetches on focus
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu
        title={t("detailsEditTitle")}
        showBack
        hideMenu
        subheading={data?.name}
      />
      {!values || !data ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      ) : (
        <StepDetails
          topInset={false}
          title={t("detailsEditTitle")}
          subtitle={t("detailsEditSubtitle")}
          businessName={data.name}
          values={values}
          onChange={(patch) => setValues((v) => v && { ...v, ...patch })}
          hours={hours}
          setHours={setHours}
          locale={locale}
          enableTags
          onSubmit={() => void save()}
          submitting={saving}
          ctaLabel={t("save")}
        />
      )}
    </View>
  );
}
