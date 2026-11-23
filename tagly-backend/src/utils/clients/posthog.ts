import { PostHog } from "posthog-node";
import { envVariables } from "../../environment/envVariables.js";

// Singleton PostHog (node) client — backend error tracking, the node twin of the
// client analytics project. This is the ONE file that names the vendor; the rest
// of the codebase goes through `observability/reportError.ts`, so swapping to
// another tracker is a change here + that one file.
//
// `POSTHOG_API_KEY`/`POSTHOG_HOST` are required env (validated at boot), so the
// client always exists. Constructed lazily on first use so importing this module
// never starts the client / its flush timer.
let client: PostHog | undefined;

export function getPostHog(): PostHog {
  if (!client) {
    client = new PostHog(envVariables.POSTHOG_API_KEY, {
      host: envVariables.POSTHOG_HOST,
      // Exceptions are low-volume — send promptly, and drain on shutdown.
      flushAt: 1,
      flushInterval: 5_000,
    });
  }
  return client;
}

/** Flush + close the batch. Call from every process's shutdown path. */
export async function shutdownPostHog(): Promise<void> {
  if (!client) return;
  try {
    await client.shutdown(2_000);
  } catch {
    // best-effort — never block shutdown on the tracker
  }
}
