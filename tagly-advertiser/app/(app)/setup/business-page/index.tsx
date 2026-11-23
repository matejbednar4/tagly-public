import { useEffect } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  useTheme,
  CustomButton,
  StepProgressOverline,
  customAlert,
  showToast,
  CreateBusinessWizard,
} from "@tagly/client";
import {
  createBusinessInit,
  createBusinessConfirm,
} from "@tagly/sdk/v2/advertiserApp";
import type { BusinessOwnerPreview } from "@tagly/models/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { LOCAL_KEYS } from "@/constants/storageKeys";
import { useAnalytics } from "@/utils/analytics";

/**
 * Setup · business-page step — hosts the reusable CreateBusinessWizard with
 * the setup chrome: the step overline ("4 of 4" on a fresh flow) and a "Set up
 * later" escape on the wizard's first page. Creation resolves the step
 * immediately — the device-local dismissal flips the (app) gate straight to
 * the tabs, no interstitial success screen. The gate only routes here while
 * the advertiser has no business page and hasn't dismissed the step, so every
 * mount is a real funnel view.
 */
export default function SetupBusinessPageScreen() {
  const { t } = useTranslation("setupBusiness");
  const { theme } = useTheme();
  const { color } = theme;
  const { advertiser, refresh, dismissBusinessSetup } = useAdvertiser();
  const { track } = useAnalytics();

  useEffect(() => {
    track("setup_business_page_viewed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreated = (business: BusinessOwnerPreview) => {
    track("setup_business_page_created");
    // Keep the server-derived hasBusinessPage fact fresh (best-effort).
    void refresh();
    showToast({
      type: "success",
      text1: t("createdToast", { name: business.name }),
    });
    dismissBusinessSetup(); // flips the (app) gate to the tabs
  };

  // A business page is the whole point — confirm so nobody skips it by mistake.
  const skip = () => {
    customAlert(t("skipAlertTitle"), t("skipAlertBody"), [
      { text: t("skipAlertCancel"), style: "cancel", onPress: () => {} },
      {
        text: t("skipAlertConfirm"),
        style: "destructive",
        onPress: () => {
          track("setup_business_page_skipped");
          dismissBusinessSetup(); // flips the (app) gate to the tabs
        },
      },
    ]);
  };

  return (
    // No SafeAreaView here: the wizard's scroll content pads BOTH vertical
    // insets itself, so pages span the physical screen and content scrolls
    // under the notch and home indicator instead of being clipped.
    <View style={{ flex: 1, backgroundColor: color.background }}>
      {/* The overline scrolls with each page's content ("Business page · N of
          3") — each page bakes in its own sub-step, so the count changes as a
          natural part of the slide. */}
      <CreateBusinessWizard
        api={{
          init: (jwt, body) => createBusinessInit({ jwt, body }),
          confirm: (jwt, body) => createBusinessConfirm({ jwt, body }),
        }}
        locale={advertiser?.locale ?? "US"}
        draftKey={LOCAL_KEYS.CREATE_BUSINESS_DRAFT}
        onCreated={onCreated}
        stepHeader={(step) => (
          <StepProgressOverline
            step={step + 1}
            total={3}
            label={t("overlineLabel")}
            // Sits in the wizard's back-arrow row — no stacked bottom padding.
            style={{ paddingBottom: 0 }}
          />
        )}
        firstStepFooter={
          <CustomButton
            type="soft"
            label={t("skip")}
            onPress={skip}
            style={{ marginTop: theme.spacing.sm }}
          />
        }
      />
    </View>
  );
}
