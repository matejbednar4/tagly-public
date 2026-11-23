/**
 * `fetch` with a hard timeout via `AbortController`. Returns the raw `Response`
 * — the caller decides how to handle a non-2xx (use this when you need the
 * status or body, e.g. to classify a failure). For the common "fetch JSON or
 * throw a CustomError" case, use `fetchJSONWithAbort`, which builds on this.
 *
 * On timeout the underlying `fetch` rejects with an `AbortError`; callers that
 * care should branch on `err?.name === "AbortError"`.
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit
): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    // `init` carries method/headers/body; our abort signal always wins over any
    // signal passed in `init`.
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}
