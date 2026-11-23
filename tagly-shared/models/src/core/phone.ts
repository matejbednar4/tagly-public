import z from "zod";

/**
 * E.164 phone number: a leading "+" then 1–15 digits (first digit non-zero), no
 * spaces or separators (e.g. "+14155552671"). The canonical phone primitive —
 * reuse everywhere a phone is validated (write boundaries) or typed (DTOs),
 * mirroring `EmailSchema`.
 */
export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{1,14}$/, "Must be an E.164 phone number, e.g. +14155552671");
