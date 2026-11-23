import { assertTextAllowedOrThrow } from "../../moderation/assertTextAllowedOrThrow.js";

/**
 * Profanity-gate the customer-surfaced text fields of a business page (4951 on
 * a hit). Checks only the fields that are provided, so create and update pass
 * whatever subset they carry. URLs are deliberately NOT wordlist-checked
 * (domains have no word boundaries — legit ones like dickssportinggoods.com
 * would false-flag); they're gated by the admin-reviewed Link registry. The
 * address isn't checked either: the stored fields come from the geocoder, not
 * the user's typing.
 */
export function assertBusinessTextsAllowedOrThrow(texts: {
  name?: string | null;
  description?: string | null;
  instagramTag?: string | null;
  contactEmail?: string | null;
}): void {
  // The field keys ride errors[].path so clients can name the flagged field.
  assertTextAllowedOrThrow(texts.name, "Business name", "name");
  assertTextAllowedOrThrow(texts.description, "Description", "description");
  assertTextAllowedOrThrow(texts.instagramTag, "Instagram tag", "instagramTag");
  assertTextAllowedOrThrow(texts.contactEmail, "Contact email", "contactEmail");
}
