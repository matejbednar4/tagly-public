import { BUSINESS_MAX_PHOTOS } from "@tagly/models/v2/advertiserApp";
import { customAlert } from "../../feedback/alert";
// Import the local i18n module directly (not the "@tagly/client" barrel) to
// avoid an import cycle, since this file is itself part of @tagly/client.
import { i18n } from "../../../i18n";

/** Which form step/section can fix the error — hosts with steps jump there. */
export type BusinessFormErrorStep = "basics" | "media" | "details" | null;

// Keys are composed dynamically (`field_${key}`, `modCat_${key}`), which the
// typed-resource `t` union can't express — go through an untyped view.
const tUntyped = i18n.t as unknown as (
  key: string,
  options?: Record<string, unknown>,
) => string;
const t = (key: string, vars?: Record<string, unknown>) =>
  tUntyped(key, { ns: "businessPageForm", ...vars });

// Machine keys the backend rides on errors[].path for 4951 (profanity).
const TEXT_FIELD_KEYS = new Set([
  "name",
  "description",
  "instagramTag",
  "contactEmail",
]);

// Machine keys the backend rides on errors[].message for 5210 (moderation).
const MODERATION_CATEGORY_KEYS = new Set([
  "nudity",
  "violence",
  "drugs",
  "tobacco",
  "gambling",
  "hate",
  "selfHarm",
]);

/** "banner" / "photos.N" → localized, capitalized slot label ("Photo 3"). */
const slotLabel = (path: string | undefined): string | null => {
  if (path === "banner") return t("slotBanner");
  const m = path?.match(/^photos\.(\d+)$/);
  if (m) return t("slotPhoto", { n: Number(m[1]) + 1 });
  return null;
};

/**
 * The one place business-page form submit errors turn into user copy — used by
 * the create wizard and every edit screen, so the same backend code always
 * reads the same. Handles only the codes the business `init`/`confirm`/PATCH
 * endpoints throw; anything else ≥1000 gets the mode's generic failure alert
 * (codes <1000 were already alerted centrally by the caller wrapper).
 *
 * The backend attaches `errors: [{ path, message }]` detail on moderation and
 * image failures (which field / which image / what was found) — when present,
 * the alert names the exact field or image and the reason; when absent (or an
 * unknown key), it falls back to the code-level copy.
 *
 * Returns the step that can fix the error so stepped hosts (the wizard) can
 * jump there; single-section hosts ignore it.
 */
export function alertBusinessFormError(
  code: number | undefined,
  detail: { path: string; message: string }[] | undefined,
  opts: { mode: "create" | "edit"; countryLabel?: string },
): BusinessFormErrorStep {
  const first = detail?.[0];
  const slot = slotLabel(first?.path);

  // Address — not found / geocoding failed.
  if (code === 1203 || code === 1204 || code === 5200) {
    customAlert(t("addressInvalidTitle"), t("addressInvalidBody"));
    return "basics";
  }

  // Address outside the advertiser's country.
  if (code === 4944) {
    customAlert(
      t("addressCountryTitle"),
      t("addressCountryBody", { country: opts.countryLabel ?? "" }),
    );
    return "basics";
  }

  // Profanity — name the flagged field when the backend tells us which.
  if (code === 4951) {
    const fieldKey =
      first && TEXT_FIELD_KEYS.has(first.path) ? first.path : null;
    customAlert(
      t("inputFlaggedTitle"),
      fieldKey
        ? t("inputFlaggedFieldBody", { field: t(`field_${fieldKey}`) })
        : t("inputFlaggedBody"),
    );
    return fieldKey === "name" ? "basics" : fieldKey ? "details" : null;
  }

  // Image moderation — name the image and what was found in it.
  if (code === 5210) {
    const category =
      first && MODERATION_CATEGORY_KEYS.has(first.message)
        ? first.message
        : null;
    customAlert(
      t("contentFlaggedTitle"),
      slot && category
        ? t("contentFlaggedDetailBody", {
            slot,
            category: t(`modCat_${category}`),
          })
        : t("contentFlaggedBody"),
    );
    return "media";
  }

  // Image validation — split by the backend's machine reason so "too large"
  // stops masquerading as a connection problem.
  if (code === 5203 || code === 5204 || code === 5205) {
    switch (first?.message) {
      case "tooLarge":
        customAlert(
          t("imageTooLargeTitle"),
          slot ? t("imageTooLargeBody", { slot }) : t("imageInvalidBody"),
        );
        return "media";
      case "badAspect":
        customAlert(t("imageInvalidTitle"), t("bannerAspectBody"));
        return "media";
      case "notImage":
      case "invalidImage":
        customAlert(
          t("imageInvalidTitle"),
          slot ? t("imageInvalidDetailBody", { slot }) : t("imageInvalidBody"),
        );
        return "media";
      case "notUploaded":
        customAlert(
          t("uploadIncompleteTitle"),
          slot
            ? t("uploadIncompleteDetailBody", { slot })
            : t("uploadIncompleteBody"),
        );
        return null;
      default:
        // No detail (e.g. the cores' pending-row 5203s) — code-level fallback.
        if (code === 5205) {
          customAlert(t("imageInvalidTitle"), t("imageInvalidBody"));
          return "media";
        }
        customAlert(t("uploadIncompleteTitle"), t("uploadIncompleteBody"));
        return null;
    }
  }

  // Photo cap crossed server-side (concurrent edit).
  if (code === 5206) {
    customAlert(
      t("photoLimitTitle"),
      t("photoLimitBody", { max: BUSINESS_MAX_PHOTOS }),
    );
    return "media";
  }

  if (typeof code === "number" && code >= 1000) {
    customAlert(
      t(opts.mode === "create" ? "createFailedTitle" : "saveFailedTitle"),
      t(opts.mode === "create" ? "createFailedBody" : "saveFailedBody"),
    );
  }
  return null;
}
