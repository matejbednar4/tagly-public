import type { ErrorCode } from "../constants/system/ERROR_CODES";

export type ApiZodIssue = { path: string; message: string };

export type ApiError = {
  error: {
    code: ErrorCode;
    message: string;
    errors?: ApiZodIssue[]; // present for validation errors
  };
};

// Optional common helpers you’ll likely reuse:
export type Empty = null;
export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};
