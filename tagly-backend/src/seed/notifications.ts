import {
  notificationCategories,
  notificationEvents as sharedNotificationEvents,
  type NotificationEventSlug,
} from "@tagly/models/shared";
import {
  allEventSlugs,
  transactionalEventsForSeed,
} from "../constants/catalogs/notifications/notificationRegistry.js";
import { transactionalTemplates } from "../constants/catalogs/notifications/transactionalCatalog.js";
import prisma from "../prisma/prisma.js";

/**
 * Startup-time alignment check: every transactional event declared in the
 * shared catalog must have a corresponding backend template, and there must
 * be no orphan templates without a shared catalog entry. Mismatches throw
 * before the backend serves traffic — the FE can't render a slug whose
 * template the backend doesn't know how to send.
 */
function validateTransactionalTemplateAlignment() {
  const sharedSlugs = new Set(sharedNotificationEvents.map((e) => e.slug));
  const templateSlugs = new Set(Object.keys(transactionalTemplates));

  const missingTemplates = [...sharedSlugs].filter(
    (s) => !templateSlugs.has(s),
  );
  const orphanTemplates = [...templateSlugs].filter(
    (s) => !sharedSlugs.has(s as NotificationEventSlug),
  );

  if (missingTemplates.length || orphanTemplates.length) {
    const parts: string[] = [];
    if (missingTemplates.length) {
      parts.push(
        `Shared notification events without a backend template:\n  • ${missingTemplates.join(
          "\n  • ",
        )}\n\nAdd entries to tagly-backend/src/constants/catalogs/notifications/transactionalCatalog.ts.`,
      );
    }
    if (orphanTemplates.length) {
      parts.push(
        `Backend templates without a matching shared catalog entry:\n  • ${orphanTemplates.join(
          "\n  • ",
        )}\n\nAdd entries to tagly-shared/models/src/catalogs/notifications/notificationEventsCatalog.ts or remove the templates.`,
      );
    }
    throw new Error(
      "Notification catalog ↔ template alignment failed:\n\n" +
        parts.join("\n\n"),
    );
  }
}

export async function seedNotifications() {
  console.log("Validating notification catalog ↔ template alignment...");
  validateTransactionalTemplateAlignment();
  console.log("Alignment OK.");

  console.log("Seeding transactional notification categories");
  // Display names + descriptions live only in the shared catalog — the DB
  // stores just structural fields (slug + sortOrder + relations).
  for (const c of notificationCategories) {
    await prisma.notificationCategory.upsert({
      where: { slug: c.slug },
      update: {
        sortOrder: c.sortOrder,
      },
      create: {
        slug: c.slug,
        sortOrder: c.sortOrder,
      },
    });
  }

  console.log("Seeding transactional notification events");
  for (const e of transactionalEventsForSeed) {
    await prisma.notificationEvent.upsert({
      where: { slug: e.slug },
      update: {
        target: e.target,
        availableChannels: e.availableChannels,
        mandatoryChannels: e.mandatoryChannels,
        sortOrder: e.sortOrder,
        category: { connect: { slug: e.categorySlug } },
      },
      create: {
        slug: e.slug,
        target: e.target,
        availableChannels: e.availableChannels,
        mandatoryChannels: e.mandatoryChannels,
        sortOrder: e.sortOrder,
        category: { connect: { slug: e.categorySlug } },
      },
    });
  }

  // Prune events removed from the catalog (e.g. the retired referral events):
  // delete any DB event whose slug is no longer in the catalog, keeping the DB an
  // exact mirror of the catalog. The opt-out FK (and the legacy preference FKs)
  // are `onDelete: Cascade`, so each user's now-orphaned opt-outs for it are
  // removed with it. Trade-off: this is destructive on every deploy — removing
  // an event from the catalog wipes users' opt-outs for it; re-adding recreates
  // the event with everyone back at the all-on default.
  const catalogSlugs = transactionalEventsForSeed.map((e) => e.slug);
  const { count: pruned } = await prisma.notificationEvent.deleteMany({
    where: { slug: { notIn: catalogSlugs } },
  });
  if (pruned > 0) {
    console.log(`Pruned ${pruned} stale notification event(s) + their prefs.`);
  }

  // Prune not-yet-sent queue rows whose slug left the catalog entirely
  // (transactional + promo + admin — the queue has no FK by design, so this is
  // the only mirror-cleanup it gets). Without this, rows queued just before a
  // deploy that removed their event would be claimed and terminal-fail with
  // "Unknown event slug" (harmless but noisy). Only SCHEDULED rows: a
  // PROCESSING row is mid-claim (deleting it would race the worker; the 8000
  // permanent-fail handles that rare case), and finished rows are history the
  // cleanup worker's retention already purges.
  const { count: prunedQueue } = await prisma.notificationQueue.deleteMany({
    where: { status: "SCHEDULED", eventSlug: { notIn: allEventSlugs } },
  });
  if (prunedQueue > 0) {
    console.log(
      `Pruned ${prunedQueue} scheduled queue row(s) for removed event slugs.`,
    );
  }

  // Promo events are NOT seeded — they are not user-configurable and have no
  // NotificationEvent rows. Eligibility is gated by promoNotificationsEnabled on each recipient model.

  console.log("Finished seeding events.");
}

// Only run if executed directly
const isDirectExecution =
  process.argv[1]?.includes("notifications.ts") ||
  process.argv[1]?.includes("notifications.js");
if (isDirectExecution) {
  seedNotifications()
    .then(() => {
      console.log("Notifications seed completed!");
    })
    .catch((e) => {
      console.error("Notifications seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
