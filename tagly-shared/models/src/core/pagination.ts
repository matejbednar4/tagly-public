import { z } from "zod";
import { PAGINATION } from "../constants/system/PAGINATION";

// Shared request base; extend per endpoint with its filters
export const PaginationReqBase = z.object({
  offset: z.coerce.number().int().min(0),
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION.MIN_LIMIT)
    .max(PAGINATION.MAX_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT),
});

// Shared response base (Zod can't type items generically)
export const PaginationResBase = z.object({
  offset: z.number().int().min(0),
  hasMore: z.boolean(),
});

// TS helper for responses
export type PaginatedResponse<T> = {
  items: T[];
  offset: number;
  hasMore: boolean;
};
