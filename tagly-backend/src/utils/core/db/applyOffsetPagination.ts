/**
 * Offset-pagination helpers shared by every paginated controller. The wire
 * contract (`PaginationReqBase`/`PaginationResBase` in `@tagly/models`) treats
 * `offset` as a **page index** — the client increments it by 1 per page — so the
 * DB skip is `offset * limit`.
 */

/** Apply `skip = offset * limit` + `take = limit` to a Kysely select query. */
export function applyOffsetPagination<T>(
  query: T,
  { offset, limit }: { offset: number; limit: number },
): T {
  return (query as any).offset(offset * limit).limit(limit) as T;
}

/**
 * `hasMore` for an offset page: a full page came back, so assume there's another.
 * (One extra empty fetch at the exact boundary is the accepted trade-off — same
 * as the other lists.)
 */
export function hasMoreFromPage(rowCount: number, limit: number): boolean {
  return rowCount === limit;
}
