import { z } from "zod";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { createCustomError } from "../../utils/core/errors/createCustomError.js";
import { ERROR_CODES, ApiZodIssue } from "@tagly/models/shared";
import { envVariables } from "../../environment/envVariables.js";

type Part = "body" | "query" | "params";

const TARGET_PROP: Record<
  Part,
  "validatedBody" | "validatedQuery" | "validatedParams"
> = {
  body: "validatedBody",
  query: "validatedQuery",
  params: "validatedParams",
};

const HTML_TAG_RE = /<\s*\/?\s*[a-zA-Z][^>]*>/; // avoids false positives like "<3"

function findHtmlTags(
  value: unknown,
  path: string[] = [],
  hits: { path: string; sample: string }[] = []
) {
  if (typeof value === "string") {
    if (HTML_TAG_RE.test(value)) {
      hits.push({
        path: path.join("."),
        sample: value.slice(0, 80),
      });
    }
    return hits;
  }

  if (!value || typeof value !== "object") return hits;

  if (Array.isArray(value)) {
    value.forEach((v, i) => findHtmlTags(v, [...path, String(i)], hits));
    return hits;
  }

  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    findHtmlTags(v, [...path, k], hits);
  }
  return hits;
}

function zodIssues(e: z.ZodError): ApiZodIssue[] {
  return e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

export function validateReq<T extends z.ZodTypeAny>(
  where: Part,
  schema: T
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const source =
      where === "body" ? req.body : where === "query" ? req.query : req.params;

    const parsed = schema.safeParse(source);
    if (!parsed.success) {
      return next(
        // expected: request validation failure — high-volume transport noise
        // (malformed requests, bots), muted from the error tracker.
        createCustomError(ERROR_CODES.SERVER.ZOD, "ZodValidationError", {
          status: 400,
          errors: zodIssues(parsed.error),
          expected: true,
        })
      );
    }

    const hits = findHtmlTags(parsed.data);

    if (hits.length > 0) {
      return next(
        // expected: input sanitization rejection — transport noise, muted.
        createCustomError(ERROR_CODES.SERVER.HTML_NOT_ALLOWED, "HTML is not allowed in input", {
          status: 400,
          errors: hits.map((h) => ({
            path: h.path,
            message: "HTML tags are not allowed",
          })),
          expected: true,
        })
      );
    }

    const prop = TARGET_PROP[where];
    (req as any)[prop] = parsed.data;
    (res.locals as any)[prop] = parsed.data;

    // DEV/STAGING: forbid reading raw part downstream (controller layer)
    if (
      envVariables.APP_STAGE === "development" ||
      envVariables.APP_STAGE === "staging"
    ) {
      const msg = `Use req.${prop} instead of req.${where}`;

      // Defer until the next macrotask so Express has finished its own param assignment.
      setImmediate(() => {
        try {
          Object.defineProperty(req, where, {
            configurable: true,
            enumerable: true,
            // Throw when a controller tries to read raw body/query/params
            get() {
              throw new Error(msg);
            },
            // Still allow writers (including any libs) to replace it later if needed
            set(v) {
              Object.defineProperty(req, where, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: v,
              });
            },
          });
        } catch {
          // If anything about the descriptor is weird, fail open (don't crash)
        }
      });
    }

    next();
  };
}
