import express from "express";
import morgan from "morgan";
import * as errorsMiddleware from "./middleware/request/errors.js";
import prisma from "./prisma/prisma.js";
import v2Router from "./routes/v2/index.js";
import { envVariables } from "./environment/envVariables.js";
import { stripePlatformWebhook } from "./controllers/webhooks/stripe/stripePlatformWebhook.js";
import { stripeConnectWebhook } from "./controllers/webhooks/stripe/stripeConnectWebhook.js";
import { unsubscribeEmail } from "./controllers/webhooks/email/unsubscribeEmail.js";
import { appIpLimiter } from "./middleware/security/rateLimit.js";
import { deauthorizeInstagramWebhook } from "./controllers/webhooks/instagram/deauthorizeInstagram.js";
import { deleteInstagramDataWebhook } from "./controllers/webhooks/instagram/deleteInstagramData.js";
import { getInstagramDeletionStatus } from "./controllers/webhooks/instagram/deletionStatus.js";
import { seedNotifications } from "./seed/notifications.js";
import { seedVerticals } from "./seed/verticals.js";
import { shutdownRedis } from "./utils/clients/redis.js";
import { shutdownDb } from "./db/kysely.js";
import { shutdownPostHog } from "./utils/clients/posthog.js";
import { reportError } from "./utils/core/errors/reportError.js";
import { enforceMinVersion } from "./middleware/security/enforceMinVersion.js";

const app = express();

app.set("trust proxy", 1);

// log requests in dev/staging
if (
  envVariables.APP_STAGE === "development" ||
  envVariables.APP_STAGE === "staging"
) {
  app.use(morgan("dev"));
}

app.post(
  "/webhooks/instagram/deauthorize",
  express.urlencoded({ extended: false }),
  deauthorizeInstagramWebhook,
);

app.post(
  "/webhooks/instagram/delete-data",
  express.urlencoded({ extended: false }),
  deleteInstagramDataWebhook,
);

app.get(
  "/webhooks/instagram/deletion-status",
  express.urlencoded({ extended: false }),
  getInstagramDeletionStatus,
);

app.post(
  "/webhooks/stripe/platform",
  express.raw({ type: "application/json" }),
  stripePlatformWebhook,
);

app.post(
  "/webhooks/stripe/connect",
  express.raw({ type: "application/json" }),
  stripeConnectWebhook,
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health endpoints
app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});
app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).send("db:ok");
  } catch (e) {
    res.status(500).send(`db:error ${String(e)}`);
  }
});

// Enforce minimum app version for mobile clients
app.use(enforceMinVersion); // Skips requests without X-App-Client header (dashboard, webhooks, workers)

// One-click email unsubscribe — PERMANENT surface: the URL is baked into
// every promo email ever sent (footer link + RFC 8058 List-Unsubscribe
// headers) and the tokens never expire, so both paths must survive every
// cutover (never move them under a versioned tree). GET = the human footer
// link; POST = the provider one-click callback (same idempotent handler,
// token in the query string).
// Canonical path (baked into all mail sent from 2026-08-02 on):
app.get("/webhooks/email/unsubscribe", appIpLimiter, unsubscribeEmail);
app.post("/webhooks/email/unsubscribe", appIpLimiter, unsubscribeEmail);

// Legacy path — every unsubscribe link/header sent before the rename points
// here. Additive migration: keep forever, never remove or repoint.
app.get("/public/unsubscribe", appIpLimiter, unsubscribeEmail);
app.post("/public/unsubscribe", appIpLimiter, unsubscribeEmail);

// v2 namespace — clean, shim-free routes that v2 clients talk to exclusively.
// The v2 router owns its own per-group middleware (see routes/v2/index.ts).
app.use("/v2", v2Router);

app.use(errorsMiddleware.notFound);
app.use(errorsMiddleware.errorHandler);

// make bigInts safe to return
app.set("json replacer", (_key: any, value: any) => {
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value.toString();
  }
  return value;
});

async function bootstrap() {
  await seedNotifications();
  await seedVerticals();

  const server = app
    .listen(envVariables.PORT, () => {
      console.log(
        `App listening on ${envVariables.API_BASE_URL}:${envVariables.PORT}.`,
      );
    })
    .on("error", (err) => {
      // Boot crash (port bind etc.) — track it, keep one stdout line as the
      // only local-dev signal, flush, fail fast.
      console.error("app.listen error:", err);
      reportError(err, {
        source: "system",
        errorClass: "crash",
        service: "api",
        phase: "listen",
      });
      void shutdownPostHog().finally(() => process.exit(1));
    });

  // Graceful shutdown: App Runner sends SIGTERM on deploy/scale-in. Stop
  // accepting new connections, then close the shared clients (Redis, Kysely
  // pool). A watchdog force-exits if draining hangs on a keep-alive connection.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await Promise.allSettled([
        shutdownRedis(),
        shutdownDb(),
        shutdownPostHog(),
      ]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Process-level crash capture for errors that escape the request cycle (a
  // floating promise rejection, a throw off the event loop) — the API twin of
  // the worker crash handlers in runWorkerLoop. `errorHandler` covers everything
  // inside a request; these cover everything outside it. Both report → flush →
  // exit(1): the process is in an undefined state, so we fail fast (App Runner
  // replaces the instance) rather than limp on. Not registering a non-exiting
  // `unhandledRejection` handler is deliberate — that would suppress Node's
  // default crash and mask real bugs.
  const onFatal =
    (phase: "unhandledRejection" | "uncaughtException") => (err: unknown) => {
      reportError(err, {
        source: "api",
        errorClass: "crash",
        service: "api",
        phase,
      });
      void shutdownPostHog().finally(() => process.exit(1));
    };
  process.on("unhandledRejection", onFatal("unhandledRejection"));
  process.on("uncaughtException", onFatal("uncaughtException"));
}

bootstrap().catch((err) => {
  // Same shape as the listen failure: track + one stdout line + fail fast.
  console.error("Bootstrap failed", err);
  reportError(err, {
    source: "system",
    errorClass: "crash",
    service: "api",
    phase: "bootstrap",
  });
  void shutdownPostHog().finally(() => process.exit(1));
});
