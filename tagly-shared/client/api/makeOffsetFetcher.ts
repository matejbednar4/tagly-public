import type { ApiError } from "@tagly/models/shared";
import { callAuthed } from "./caller";
import type { FetchPage } from "../hooks/usePagedList";

/**
 * Structural mirror of the SDK's `ApiResponse<T>` — kept local so `@tagly/client`
 * doesn't take a dependency on `@tagly/sdk`. The SDK's response is assignable to
 * this, which is all `callAuthed` needs.
 */
type SdkResponse<T> = Promise<{
  status: number;
  json: T | ApiError;
}>;

/**
 * Adapts a paginated SDK endpoint into a `usePagedList`/`PaginatedList`
 * `FetchPage` — wraps `callAuthed`, then normalizes the endpoint's response into
 * the shared `{ items, offset, hasMore }` envelope. `selectItems` picks the
 * entity array off the response (which keeps its natural name, e.g. `businesses`,
 * `shares`), so no endpoint needs a generic `items` field.
 *
 *   fetchPage={makeOffsetFetcher(getAllBusinesses, (r) => r.businesses)}
 *
 * Assumes the codebase's paginated convention: a POST taking `{ jwt, body }`
 * whose response extends `PaginationResBase` (`offset` + `hasMore`). On any
 * non-ok result it returns an empty page; fetch errors (network, timeout,
 * rate-limit, …) surface via `callAuthed`'s standard alerts so the user sees why
 * the list is empty. Pass `{ suppressAlerts: true }` to silence them.
 */
export function makeOffsetFetcher<
  T,
  Q extends { offset: number; limit?: number },
  R extends { offset: number; hasMore: boolean },
>(
  sdkFn: (args: { jwt: string; body: Q }) => SdkResponse<R>,
  selectItems: (data: R) => T[],
  opts?: { suppressAlerts?: boolean },
): FetchPage<T, Q> {
  return async ({ query, router }) => {
    const result = await callAuthed<R>(
      router,
      (jwt) => sdkFn({ jwt, body: query }),
      { suppressAlerts: opts?.suppressAlerts ?? false },
    );
    if (result.ok && result.data) {
      return {
        items: selectItems(result.data),
        offset: result.data.offset,
        hasMore: result.data.hasMore,
      };
    }
    return { items: [], offset: query.offset, hasMore: false };
  };
}
