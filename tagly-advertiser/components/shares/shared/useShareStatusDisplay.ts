import type Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@tagly/client";
import type { AdvertiserShareStatus } from "@tagly/models/shared";

/**
 * The one status identity for an `AdvertiserShareStatus` — label (from the
 * feature-level `shares` namespace next to this file), icon, and tone — consumed
 * by every surface that shows a share's status (`SharePreviewCard` pill, the
 * detail screen's status card), so the surfaces can't drift apart.
 */
export function useAdvertiserShareStatusDisplay(status: AdvertiserShareStatus): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
} {
  const { t } = useTranslation("shares");
  const { theme } = useTheme();
  const { color } = theme;

  switch (status) {
    // Settled — the customer got their reward and the spend left the budget.
    case "PAID":
      return {
        label: t("status.PAID"),
        icon: "checkmark-circle",
        tone: color.success,
      };
    // The advertiser's report was found valid — they won't be charged for this
    // share. (Copy says "report valid", never "removed"/"upheld" — the backend
    // keeps the row; it just never pays.)
    case "REJECTED":
      return {
        label: t("status.REJECTED"),
        icon: "close-circle",
        tone: color.danger,
      };
    // The share couldn't be completed (payout failure) — nothing is charged.
    case "UNPAYABLE":
      return {
        label: t("status.UNPAYABLE"),
        icon: "close-circle",
        tone: color.text.tertiary,
      };
    // The advertiser's report holds settlement while an admin reviews it.
    case "REPORT_REVIEW":
      return {
        label: t("status.REPORT_REVIEW"),
        icon: "flag",
        tone: color.on.brand,
      };
    // In flight (PROCESSING) — approved, not settled yet.
    default:
      return {
        label: t("status.PROCESSING"),
        icon: "time-outline",
        tone: color.text.secondary,
      };
  }
}
