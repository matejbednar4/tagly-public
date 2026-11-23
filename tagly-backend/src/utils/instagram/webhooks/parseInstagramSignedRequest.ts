import { createCustomError } from "../../core/errors/createCustomError.js";
import crypto from "node:crypto";

function base64UrlToBuffer(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  return Buffer.from(padded, "base64");
}

export function parseInstagramSignedRequest(
  signedRequest: string,
  appSecret: string
): {
  user_id?: string;
  [key: string]: any;
} {
  const parts = signedRequest.split(".");
  if (parts.length !== 2) {
    throw createCustomError(4100, "Invalid signed_request", 400);
  }

  const encodedSig = parts[0];
  const encodedPayload = parts[1];

  const sig = base64UrlToBuffer(encodedSig);
  const payloadBuf = base64UrlToBuffer(encodedPayload);
  const payloadJson = payloadBuf.toString("utf8");

  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();

  if (!crypto.timingSafeEqual(sig, expectedSig)) {
    throw createCustomError(4101, "Invalid signed_request signature", 400);
  }

  const payload = JSON.parse(payloadJson) as {
    user_id?: string;
    [key: string]: any;
  };
  return payload;
}
