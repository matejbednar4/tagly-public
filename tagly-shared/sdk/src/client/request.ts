import { ApiError } from "@tagly/models/shared";
import { z } from "zod";
import { backendUrl } from "../env";
import { ERROR_CODES } from "@tagly/models/shared";
import { getAppHeaders } from "../config";

const DEFAULT_TIMEOUT_MS = 15_000;

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  path: string;
  jwt?: string;
  headers?: Record<string, string>;
  body?: unknown; // JSON-able or FormData
  rawBody?: BodyInit; // send as-is
  timeoutMs?: number;
  baseUrl?: string;
  retry?: number; // idempotent only (GET/HEAD)
  retryBackoffMs?: number;
  params?: Record<string, string | number>;
  query?: Record<
    string,
    string | number | boolean | (string | number | boolean)[] | undefined
  >;
  signal?: AbortSignal;

  credentials?: RequestCredentials;

  cache?: RequestCache;

  schemas?: {
    body?: z.ZodTypeAny;
    params?: z.ZodTypeAny;
    query?: z.ZodTypeAny;
    response?: z.ZodTypeAny;
    responseByStatus?: Record<number, z.ZodTypeAny>;
  };
};

type ApiHeaders = Record<string, string>;

export type ApiResponse<TSuccess> = Promise<{
  status: number;
  json: TSuccess | ApiError;
  headers?: ApiHeaders;
}>;

/** ---- helpers ---- */

function zodIssues(e: z.ZodError) {
  return e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

function validationError(message: string, e: z.ZodError): ApiError {
  return {
    error: {
      code: ERROR_CODES.SDK.REQ_PREVALIDATION, // 60
      message,
      errors: zodIssues(e),
    },
  };
}

/** invalid server payload/shape (SDK detected) */
function invalidServerPayloadError(
  message: string,
  e?: z.ZodError,
  raw?: unknown
): ApiError & { raw?: unknown } {
  return {
    error: {
      code: ERROR_CODES.SDK.INVALID_RES_PAYLOAD, // 2
      message,
      ...(e ? { errors: zodIssues(e) } : {}),
    },
    ...(raw !== undefined ? { raw } : {}),
  };
}

function applyParams(path: string, params: Record<string, string | number>) {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    const v = params[key];
    if (v === undefined || v === null)
      throw new Error(`Missing path param "${key}"`);
    return encodeURIComponent(String(v));
  });
}

function buildQueryString(query: NonNullable<RequestOptions["query"]>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) for (const item of v) usp.append(k, String(item));
    else usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function parseBody(res: Response) {
  if (res.status === 204) return null;

  const ct = res.headers.get("content-type") || "";
  const txt = await res.text();
  if (!txt) return null;

  if (ct.includes("application/json")) {
    try {
      return JSON.parse(txt);
    } catch {
      return {
        error: {
          code: ERROR_CODES.SDK.INVALID_JSON, // 3
          message: "Invalid JSON from server",
        },
        raw: txt,
      };
    }
  }

  return {
    error: {
      code: ERROR_CODES.SDK.INVALID_RES_PAYLOAD, // 2
      message: `Unexpected content-type "${ct}" from server`,
    },
    raw: txt,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function mergeSignals(signals: (AbortSignal | undefined)[]) {
  const list = signals.filter(Boolean) as AbortSignal[];
  if (list.length === 0) return undefined;

  const any = (AbortSignal as any).any;
  if (typeof any === "function") return any(list);

  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  for (const s of list) {
    if (s.aborted) return (ctrl.abort(), ctrl.signal);
    s.addEventListener("abort", onAbort, { once: true });
  }
  (ctrl.signal as any).__cleanup = () => {
    for (const s of list) s.removeEventListener("abort", onAbort);
  };
  return ctrl.signal;
}

function collectHeaders(res: Response): ApiHeaders {
  const headersObj: ApiHeaders = {};

  try {
    if (typeof (res.headers as any)?.forEach === "function") {
      res.headers.forEach((v, k) => (headersObj[k] = v));
      return headersObj;
    }
  } catch {
    // fall through
  }

  try {
    for (const [k, v] of (res.headers as any).entries()) {
      headersObj[k] = v;
    }
  } catch {
    // ignore
  }

  return headersObj;
}

/** ---- main request with optional validation ---- */
export async function request<TSuccess = unknown>(
  opts: RequestOptions
): ApiResponse<TSuccess> {
  const {
    method = "GET",
    path,
    jwt,
    headers = {},
    body,
    rawBody,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    baseUrl,
    retry = 0,
    retryBackoffMs = 250,
    params,
    query,
    schemas,
    signal: externalSignal,
    credentials,
    cache,
  } = opts;

  // 1) Pre-validate params/query/body
  try {
    if (schemas?.params && params) {
      const parsed = schemas.params.safeParse(params);
      if (!parsed.success)
        return {
          status: 400,
          json: validationError("Invalid path params", parsed.error),
        };
    }
    if (schemas?.query && query) {
      const parsed = schemas.query.safeParse(query);
      if (!parsed.success)
        return {
          status: 400,
          json: validationError("Invalid query", parsed.error),
        };
    }
    if (schemas?.body && body !== undefined && !(body instanceof FormData)) {
      const parsed = schemas.body.safeParse(body);
      if (!parsed.success)
        return {
          status: 400,
          json: validationError("Invalid request body", parsed.error),
        };
    }
  } catch (e) {
    return {
      status: 400,
      json: {
        error: {
          code: ERROR_CODES.SDK.ASSEMBLY, // 70
          message: e instanceof Error ? e.message : "Invalid request",
        },
      },
    };
  }

  // 2) Build URL
  const pathWithParams = params ? applyParams(path, params) : path;
  const qs = query ? buildQueryString(query) : "";
  const url = (baseUrl ?? backendUrl) + pathWithParams + qs;

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  const sendingJson = body !== undefined && !rawBody && !isFormData;

  const finalHeaders: Record<string, string> = {
    ...(sendingJson ? { "Content-Type": "application/json" } : {}),
    Accept: "application/json",
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...getAppHeaders(),
    ...headers,
  };

  const timeoutCtrl = new AbortController();
  const to =
    typeof timeoutMs === "number" && timeoutMs > 0
      ? setTimeout(() => timeoutCtrl.abort(), timeoutMs)
      : null;

  const mergedSignal = mergeSignals([externalSignal, timeoutCtrl.signal]);

  const fetchBody =
    rawBody !== undefined
      ? rawBody
      : body === undefined || isFormData
        ? (body as any)
        : JSON.stringify(body);

  let attempts = 0;
  const maxAttempts =
    (method === "GET" || method === "HEAD") && retry > 0 ? retry + 1 : 1;

  const isBrowser =
    typeof window !== "undefined" && typeof document !== "undefined";

  // Default: include cookies in browser, required for dashboard↔api cookie auth
  const finalCredentials: RequestCredentials | undefined =
    credentials ?? (isBrowser ? "include" : undefined);

  // Default: bypass fetch's built-in HTTP cache for all API calls.
  // React Query handles caching instead (staleTime/gcTime in the app hooks).
  // Without this, React Native's fetch can automatically cache and send If-None-Match,
  // causing unexpected 304 responses that break non-ETag-aware code paths.
  const finalCache: RequestCache | undefined = cache ?? "no-store";

  try {
    while (true) {
      try {
        const res = await fetch(url, {
          method,
          headers: finalHeaders,
          body: fetchBody,
          signal: mergedSignal,
          credentials: finalCredentials,
          cache: finalCache,
        });

        const parsed = (await parseBody(res)) as
          | TSuccess
          | (ApiError & { raw?: string });

        if (parsed && typeof parsed === "object" && "error" in parsed) {
          return {
            status: res.status,
            json: parsed,
            headers: collectHeaders(res),
          };
        }

        let json: TSuccess | ApiError = parsed;
        if (
          parsed &&
          typeof parsed === "object" &&
          !("error" in (parsed as any))
        ) {
          const specific = schemas?.responseByStatus?.[res.status];
          const schema = specific ?? schemas?.response;
          if (schema) {
            const check = schema.safeParse(parsed);
            if (check.success) {
              json = check.data as TSuccess;
            } else {
              // Log validation errors but don't block the response
              // This allows the app to continue working even with schema mismatches
              console.warn("[SDK] Response validation failed (non-blocking):");
              check.error.issues.forEach((issue) => {
                console.warn(`  - ${issue.path.join(".")}: ${issue.message}`);
              });
              // Return the raw parsed data instead of an error
              json = parsed as TSuccess;
            }
          }
        }

        return { status: res.status, json, headers: collectHeaders(res) };
      } catch (err: any) {
        attempts += 1;

        if (err?.name === "AbortError") {
          if (externalSignal?.aborted) {
            return {
              status: 499,
              json: {
                error: {
                  code: ERROR_CODES.SDK.CANCELED,
                  message: "Request canceled",
                },
              },
            };
          }
          if (timeoutCtrl.signal.aborted) {
            return {
              status: 408,
              json: {
                error: {
                  code: ERROR_CODES.SDK.TIMEOUT,
                  message: "Request timed out",
                },
              },
            };
          }
          if (attempts >= maxAttempts) {
            return {
              status: 500,
              json: {
                error: {
                  code: ERROR_CODES.SDK.NETWORK,
                  message: "Network error or server not reachable",
                },
              },
            };
          }
          await sleep(retryBackoffMs * attempts);
          continue;
        }

        if (attempts >= maxAttempts) {
          return {
            status: 500,
            json: {
              error: {
                code: ERROR_CODES.SDK.NETWORK,
                message: "Network error or server not reachable",
              },
            },
          };
        }
        await sleep(retryBackoffMs * attempts);
      }
    }
  } finally {
    if (to) clearTimeout(to);
    (mergedSignal as any)?.__cleanup?.();
  }
}
