import type { RequestHandler, NextFunction } from "express";

export const asyncHandler = <T extends RequestHandler>(fn: T): T =>
  ((req: Parameters<T>[0], res: Parameters<T>[1], next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  }) as T;
