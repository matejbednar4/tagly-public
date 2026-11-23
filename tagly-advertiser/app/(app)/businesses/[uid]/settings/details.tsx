import { useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
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
  toWeekHours,
  type DetailsValues,
  type SectionKey,
  type WeekHours,
} from "@tagly/client";
import { updateBusiness } from "@tagly/sdk/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { useBusiness } from "@/hooks/details/useBusiness";

/** The `?focus=` values a detail-screen "Add …" prompt may deep-link with. */
const FOCUS_SECTIONS: SectionKey[] = [
  "instagram",
  "description",
  "hours",
  "website",
  "menu",
  "reservation",
  "phone",
  "email",
];

/**
 * Edit details & hours (`/businesses/:uid/settings/details`) — the
 * `StepDetails` form (shared with the create wizard) seeded from the live
 * `BusinessOwnerDetails`. Accepts `?focus=<section>` so the business detail's
 * "Add …" prompts land with that chip already revealed.
 *
 * Save PATCHes the whole detail set with `trim() || null` semantics — a chip
 * the user deselected clears its field, and the backend treats `null` as
 * clear. `openingHours` always rides along (replace-all). Link URLs re-sent
 * unchanged keep their `Link` row + moderation status; a new/changed URL
 * enters PENDING review exactly like on create.
 */
export default function EditBusinessDetailsScreen() {
  const { uid, focus } = useLocalSearchParams<{ uid: string; focus?: string }>();
  const router = useRouter();
  const { t } = useTranslation("businessPageForm");
  const { theme } = useTheme();
  const { color } = theme;
  const queryClient = useQueryClient();
  const { advertiser } = useAdvertiser();
  const locale = advertiser?.locale ?? "US";

  const focusSection = FOCUS_SECTIONS.find((s) => s === focus);

  const query = useBusiness(uid ?? "", router);
  const data = query.data;

  const [values, setValues] = useState<DetailsValues | null>(null);
  const [hours, setHours] = useState<WeekHours>({});
  const [saving, setSaving] = useState(false);

  // Seed once from the loaded business; background refetches must not clobber.
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
        tags: "", // admin-only field; never rendered or submitted here
      });
      setHours(toWeekHours(data.openingHours));
    }
  }, [data, values]);

  const save = async () => {
    if (!data || !values || saving) return;
    Keyboard.dismiss();
    // Confirm before committing (the CTA is always on screen).
    customAlert(t("saveConfirmTitle"), t("saveConfirmBody"), [
      { text: t("saveConfirmCancel"), style: "cancel" },
      { text: t("saveConfirmCta"), onPress: () => void commit() },
    ]);
  };

  const commit = async () => {
    if (!data || !values || saving) return;
    setSaving(true);

    const periods = Object.entries(hours).flatMap(([day, dayPeriods]) =>
      (dayPeriods ?? []).map((p) => ({
        dayOfWeek: Number(day),
        openMinute: p.open,
        closeMinute: p.close,
      })),
    );

    const res = await callAuthed(
      router,
      (jwt) =>
        updateBusiness({
          jwt,
          params: { uid: uid ?? "" },
          body: {
            description: values.description.trim() || null,
            instagramTag: values.instagramTag.trim() || null,
            // Add the scheme the user may have omitted (cafetagly.com → https://…).
            websiteUrl: normalizeUrl(values.websiteUrl) || null,
            reservationUrl: normalizeUrl(values.reservationUrl) || null,
            menuUrl: normalizeUrl(values.menuUrl) || null,
            phoneNumber: values.phoneNumber.trim() || null,
            contactEmail: values.contactEmail.trim() || null,
            openingHours: periods,
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

    queryClient.setQueryData(["business", uid], res.data.business);
    showToast({ type: "success", text1: t("savedToast") });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("editPageTitle")} showBack subheading={data?.name} />
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
          onSubmit={() => void save()}
          submitting={saving}
          ctaLabel={t("save")}
          focusSection={focusSection}
        />
      )}
    </View>
  );
}
