import { useTranslation } from "react-i18next";
import type { SavedCard } from "@tagly/models/v2/advertiserApp";

/**
 * The saved card as words — "Visa •••• 4242" and "Expires 04/28" — rendered
 * from the shared `billing` copy so the card reads identically on the "How you
 * pay" row and inside `CardSheet`. Both were capitalising the brand and
 * slicing the year by hand, which is exactly the kind of two-line duplication
 * that drifts into two different-looking cards.
 *
 * Returns empty strings for a null card (loading, or none on file) so callers
 * can fall back with a plain truthiness check.
 */
export function useCardLabels(card: SavedCard | null): {
  label: string;
  expiry: string;
} {
  const { t } = useTranslation("billing");
  if (!card) return { label: "", expiry: "" };
  return {
    label: t("card.onFile", {
      brand: card.brand.charAt(0).toUpperCase() + card.brand.slice(1),
      last4: card.last4,
    }),
    expiry: t("card.expires", {
      month: String(card.expMonth).padStart(2, "0"),
      year: String(card.expYear).slice(-2),
    }),
  };
}
