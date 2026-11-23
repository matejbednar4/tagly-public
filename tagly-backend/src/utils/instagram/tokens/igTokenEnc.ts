import crypto from "crypto";
import { envVariables } from "../../../environment/envVariables.js";
import { createCustomError } from "../../core/errors/createCustomError.js";

const KEY = Buffer.from(envVariables.IG_TOKEN_ENC_KEY, "base64");

export function encryptIgToken(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]).toString("base64");
}

export function decryptIgToken(packedB64: string): string {
  try {
    const buf = Buffer.from(packedB64, "base64");
    if (buf.length < 12 + 16 + 1) throw new Error("ciphertext too short");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const ciphertext = buf.subarray(12, buf.length - 16);

    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    // map to your error shape; DO NOT log the token
    throw createCustomError(5012, "Failed to decrypt Instagram token", 500);
  }
}
