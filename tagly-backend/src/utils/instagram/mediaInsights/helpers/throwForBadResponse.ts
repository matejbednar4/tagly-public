import { createCustomError } from "../../../core/errors/createCustomError.js";

/**
 * The ONLY Meta errors that fail a job terminally. Both mean the token itself is
 * dead and the customer must reconnect Instagram — no amount of retrying helps.
 *
 * Deliberately an allow-list, and deliberately NOT keyed on
 * `type === "OAuthException"`: Meta files its whole throttling family under that
 * same type (code 4 application-request-limit, 17 user-request-limit, 32
 * page-request-limit, 613 rate-limit), so treating the type as permanent voided
 * a customer's perfectly valid share on the first transient throttle. An
 * allow-list fails safe in the right direction — a genuinely dead token still
 * ends up terminal, just after its retries are exhausted rather than instantly.
 */
const PERMANENT_IG_AUTH_CODES = new Set([
  190, // invalid / expired access token
  102, // session key invalid or session expired
]);

/**
 * Turn a non-OK fetch `Response` into the right kind of throw for the job
 * runner: a `{ permanent: true }` CustomError fails the job now (and fires
 * `onTerminalFailure`, which voids the share), while a plain `Error` is retried
 * with backoff until `maxAttemptsPerJob`.
 *
 * Shared by the IG media-insights fetchers and the notifications worker's Expo
 * push send. Expo returns neither permanent code, so its failures are always
 * retryable — which is the intended behaviour there.
 */
export async function throwForBadResponse(tag: string, res: Response) {
  const text = await res.text();
  // Parse defensively — but do NOT let the JSON-parse catch swallow the
  // permanent-error throw below. Extract the fields inside the try; decide and
  // throw outside it, so a dead token fails the job terminally instead of being
  // misclassified as a retryable generic error.
  let code: unknown;
  let type: unknown;
  try {
    const j = JSON.parse(text);
    code = j?.error?.code;
    type = j?.error?.type;
  } catch {
    /* ignore JSON parse */
  }

  // A 429 or 5xx is transient whatever the body claims — never terminal.
  const transportTransient = res.status === 429 || res.status >= 500;

  if (
    !transportTransient &&
    typeof code === "number" &&
    PERMANENT_IG_AUTH_CODES.has(code)
  ) {
    // 8040 — IG media fetch OAuth error (worker permanent-failure block 8xxx)
    throw createCustomError(8040, `${tag}: OAuth error (code ${code})`, {
      permanent: true,
    });
  }

  // Retryable. Carry code/type into the message so a throttle is diagnosable
  // from the logs without re-reading the body.
  const detail = code !== undefined || type ? ` [code=${String(code)} type=${String(type)}]` : "";
  throw new Error(`${tag} HTTP ${res.status}${detail}: ${text.slice(0, 300)}`);
}
