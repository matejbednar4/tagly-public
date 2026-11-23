/**
 * Links seed — business web links in every review state, for the admin Review
 * tab's "Review links" queue.
 *
 * The Link registry is shared and de-duplicated by url: each distinct URL is one
 * row, PENDING until an admin approves it (customers only ever see APPROVED
 * links; REJECTED is a global kill-switch across every business using the URL).
 *
 *   url                                          status    used by (slot)
 *   italiancorner.example.cz                     PENDING   Italian Corner (website)
 *   sushigarden.example.cz/menu.pdf              PENDING   Sushi Garden (menu)
 *   booking.goodmorningcafe.example.cz           PENDING   Good Morning Cafe (reservation)
 *   linktr.ee/prague-food-collective (shared!)   PENDING   Riverside Brunch (website)
 *   grindgym.example.cz                          APPROVED  Grind Gym (website) — already live
 *   bloomcafe.com                                APPROVED  Bloom Cafe (website) — already live (showcase)
 *   flow-yoga-menus.example.com/download.exe     REJECTED  Flow Yoga (menu) — Safe-Browsing-style auto-reject
 *
 * → the pending-links queue shows 4 entries. The linktr.ee row is still the
 * shared-URL demo shape (one verdict can flip several businesses at once); its
 * second consumer, Bloom Cafe's menu, was dropped so the showcase page shows a
 * website and no menu.
 */

import { LinkStatus } from "../../generated/prisma/client.js";
import prisma from "../../prisma/prisma.js";

type LinkSlot = "website" | "reservation" | "menu";

type LinkSeed = {
  url: string;
  status: LinkStatus;
  uses: { business: string; slot: LinkSlot }[];
};

const LINKS: LinkSeed[] = [
  {
    url: "https://www.italiancorner.example.cz",
    status: LinkStatus.PENDING,
    uses: [{ business: "Italian Corner", slot: "website" }],
  },
  {
    url: "https://www.sushigarden.example.cz/menu.pdf",
    status: LinkStatus.PENDING,
    uses: [{ business: "Sushi Garden", slot: "menu" }],
  },
  {
    url: "https://booking.goodmorningcafe.example.cz",
    status: LinkStatus.PENDING,
    uses: [{ business: "Good Morning Cafe", slot: "reservation" }],
  },
  // A shared-registry URL — the queue lists every consumer, and a single verdict
  // flips the link for all of them (the dedupe / kill-switch demo).
  {
    url: "https://linktr.ee/prague-food-collective",
    status: LinkStatus.PENDING,
    uses: [{ business: "Riverside Brunch", slot: "website" }],
  },
  // Already reviewed — visible on the business detail, not in the queue.
  {
    url: "https://www.grindgym.example.cz",
    status: LinkStatus.APPROVED,
    uses: [{ business: "Grind Gym", slot: "website" }],
  },
  // Showcase — live on the Bloom Cafe page (screenshots).
  {
    url: "https://bloomcafe.com",
    status: LinkStatus.APPROVED,
    uses: [{ business: "Bloom Cafe", slot: "website" }],
  },
  // Auto-rejected at write time (Safe Browsing style) — the kill-switch state.
  {
    url: "http://flow-yoga-menus.example.com/download.exe",
    status: LinkStatus.REJECTED,
    uses: [{ business: "Flow Yoga", slot: "menu" }],
  },
];

const SLOT_FK: Record<LinkSlot, "websiteLinkId" | "reservationLinkId" | "menuLinkId"> = {
  website: "websiteLinkId",
  reservation: "reservationLinkId",
  menu: "menuLinkId",
};

export async function seedLinks(): Promise<void> {
  console.log(`Seeding ${LINKS.length} links...`);

  // Reviewed rows stamp the seeded admin (null-safe — the column has SetNull).
  const admin = await prisma.admin.findFirst({ select: { id: true } });

  for (const l of LINKS) {
    const reviewed = l.status !== LinkStatus.PENDING;
    const link = await prisma.link.create({
      data: {
        url: l.url,
        status: l.status,
        reviewedAt: reviewed ? new Date() : null,
        reviewedByAdminId: reviewed ? (admin?.id ?? null) : null,
      },
      select: { id: true },
    });

    for (const use of l.uses) {
      const updated = await prisma.localSubaccount.updateMany({
        where: { name: use.business },
        data: { [SLOT_FK[use.slot]]: link.id },
      });
      if (updated.count === 0) {
        throw new Error(
          `Local "${use.business}" not found for link ${l.url}. Run businessPages seed first.`,
        );
      }
    }

    console.log(
      `  → ${l.status.padEnd(8)} ${l.url} (${l.uses
        .map((u) => `${u.business}:${u.slot}`)
        .join(", ")})`,
    );
  }
}
