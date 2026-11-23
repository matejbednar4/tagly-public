import { upsertLink } from "../../moderation/upsertLink.js";

/** `undefined` = leave unchanged, `null` = clear, string = set to this URL. */
export type DesiredLinkSlots = {
  websiteUrl?: string | null;
  reservationUrl?: string | null;
  menuUrl?: string | null;
};

/** The business's current link rows (pass nothing on create — there are none). */
export type CurrentLinkSlots = {
  websiteLink: { id: number; url: string } | null;
  reservationLink: { id: number; url: string } | null;
  menuLink: { id: number; url: string } | null;
};

export type ResolvedLinkChanges = {
  /** Per slot: `undefined` = don't touch, `null` = disconnect, number = link id to connect. */
  websiteLinkId: number | null | undefined;
  reservationLinkId: number | null | undefined;
  menuLinkId: number | null | undefined;
};

/**
 * Resolve the desired web-link slots of a business (website / reservation /
 * menu) into `Link` registry ids, running every **new** URL through
 * `upsertLink` — which screens it with Google Safe Browsing (flagged →
 * REJECTED) and otherwise creates it PENDING for admin review. An unchanged
 * URL keeps its current row (and whatever moderation status it has); a known
 * URL is reused as-is, including a prior REJECTED (the cross-business
 * kill-switch).
 *
 * Shared by create confirm, update, and future admin — the single place link
 * writes happen, so a link entered on EDIT goes through exactly the same
 * review pipeline as one entered on create.
 *
 * Must run OUTSIDE the DB transaction (`upsertLink` calls Safe Browsing over
 * the network); the caller connects the returned ids inside its tx. `Link`
 * rows are shared/de-duplicated, so a row created here that the tx never
 * connects is harmless registry data, not an orphan to clean up.
 */
export async function resolveBusinessLinkChanges({
  desired,
  current,
}: {
  desired: DesiredLinkSlots;
  current?: CurrentLinkSlots;
}): Promise<ResolvedLinkChanges> {
  const resolveSlot = async (
    desiredUrl: string | null | undefined,
    currentLink: { id: number; url: string } | null,
  ): Promise<number | null | undefined> => {
    if (desiredUrl === undefined) return undefined;
    if (desiredUrl === null) return currentLink ? null : undefined;
    const url = desiredUrl.trim();
    if (currentLink && currentLink.url === url) return undefined;
    return (await upsertLink(url)).id;
  };

  const [websiteLinkId, reservationLinkId, menuLinkId] = await Promise.all([
    resolveSlot(desired.websiteUrl, current?.websiteLink ?? null),
    resolveSlot(desired.reservationUrl, current?.reservationLink ?? null),
    resolveSlot(desired.menuUrl, current?.menuLink ?? null),
  ]);

  return { websiteLinkId, reservationLinkId, menuLinkId };
}
