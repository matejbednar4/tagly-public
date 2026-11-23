import { createCustomError } from "../../../core/errors/createCustomError.js";

export function ensureMimeMatches(
  actualMime: string,
  expectedMime: string,
  allowFamilyMatch: boolean
) {
  if (!allowFamilyMatch) {
    if (actualMime !== expectedMime) {
      throw createCustomError(5203, "MIME mismatch", 422);
    }
  } else {
    const [expTop] = expectedMime.split("/");
    const [actTop] = actualMime.split("/");
    if (expTop !== actTop) {
      throw createCustomError(5203, "MIME family mismatch", 422);
    }
  }
}
