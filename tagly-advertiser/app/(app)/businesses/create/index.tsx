import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  useTheme,
  TopMenu,
  showToast,
  CreateBusinessWizard,
  useBlockBackWhile,
} from "@tagly/client";
import {
  createBusinessInit,
  createBusinessConfirm,
} from "@tagly/sdk/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { LOCAL_KEYS } from "@/constants/storageKeys";

/**
 * In-app "add a business page" screen — the general host of the reusable
 * CreateBusinessWizard (the setup phase hosts the same wizard with its own
 * chrome, no top bar). Pushed onto the (app) Stack; the TopMenu's back button
 * is the exit (the typed draft persists, so leaving loses nothing), and
 * creation `replace`s the wizard with the new business page (the page itself is
 * the confirmation; the toast is secondary). `topInset={false}` because the
 * TopMenu already consumes the notch inset.
 *
 * While a create is in flight the TopMenu is HIDDEN (`submitting`) so the back
 * button can't abandon a half-done creation (the wizard's submit overlay only
 * covers the wizard's own area, not this bar) — the full-screen overlay then
 * spans the whole screen — and `useBlockBackWhile` blocks the iOS edge-swipe +
 * the Android hardware back for the same reason.
 */
export default function CreateBusinessScreen() {
  const { t } = useTranslation("createBusinessScreen");
  const { theme } = useTheme();
  const router = useRouter();
  const { advertiser, refresh } = useAdvertiser();
  const [submitting, setSubmitting] = useState(false);
  useBlockBackWhile(submitting);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.background }}>
      {!submitting && <TopMenu title={t("title")} showBack />}
      <CreateBusinessWizard
        topInset={false}
        api={{
          init: (jwt, body) => createBusinessInit({ jwt, body }),
          confirm: (jwt, body) => createBusinessConfirm({ jwt, body }),
        }}
        locale={advertiser?.locale ?? "US"}
        draftKey={LOCAL_KEYS.CREATE_BUSINESS_DRAFT}
        onSubmittingChange={setSubmitting}
        onCreated={(business) => {
          void refresh();
          showToast({
            type: "success",
            text1: t("createdToast", { name: business.name }),
          });
          // Land on the page they just made rather than popping back to the
          // list: the rendered page IS the confirmation, so a transient toast
          // isn't the only signal that anything happened. `replace` (not push)
          // drops the wizard from the stack, so back goes to wherever create
          // was opened from and can never return to a spent form.
          router.replace(`/businesses/${business.uid}`);
        }}
      />
    </View>
  );
}
