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
  StepBasics,
  type BasicsValues,
} from "@tagly/client";
import { updateBusiness } from "@tagly/sdk/v2/advertiserApp";
import type { UpdateBusinessBody } from "@tagly/models/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { useBusiness } from "@/hooks/details/useBusiness";

/**
 * Edit name, type & address (`/businesses/:uid/settings/basics`) — the
 * `StepBasics` form (shared with the create wizard) seeded from the live
 * `BusinessOwnerDetails` and saved via `PATCH .../businesses/:uid` with only
 * the changed fields. An address change is sent whole (the backend re-geocodes
 * and re-runs the country invariant, exactly like create); error codes map to
 * the same alerts the wizard shows.
 */
export default function EditBusinessBasicsScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { t } = useTranslation("businessPageForm");
  const { theme } = useTheme();
  const { color } = theme;
  const queryClient = useQueryClient();
  const { advertiser } = useAdvertiser();
  const locale = advertiser?.locale ?? "US";

  const query = useBusiness(uid ?? "", router);
  const data = query.data;

  const [values, setValues] = useState<BasicsValues | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed the form once from the loaded business (the geocoder-normalized
  // stored fields); later background refetches must not clobber typing.
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

    const body: UpdateBusinessBody = {};
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

    // Confirm before committing (the CTA is always on screen, so guard against
    // an accidental tap). No changes above already backed out silently.
    customAlert(t("saveConfirmTitle"), t("saveConfirmBody"), [
      { text: t("saveConfirmCancel"), style: "cancel" },
      { text: t("saveConfirmCta"), onPress: () => void commit(body) },
    ]);
  };

  const commit = async (body: UpdateBusinessBody) => {
    if (saving) return;
    setSaving(true);
    const res = await callAuthed(
      router,
      (jwt) => updateBusiness({ jwt, params: { uid: uid ?? "" }, body }),
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

    queryClient.setQueryData(["business", uid], res.data.business);
    showToast({ type: "success", text1: t("savedToast") });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("basicsEditTitle")} showBack subheading={data?.name} />
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
