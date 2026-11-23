export {};

declare global {
  namespace Express {
    interface Request {
      user: { id: number; uid: string };

      // discourage direct use
      query: never;
      params: never;
      body: never;

      // validated by your middleware
      validatedQuery?: unknown;
      validatedParams?: unknown;
      validatedBody?: unknown;
    }
  }
}
