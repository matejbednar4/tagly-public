import { UID_PREFIX } from "@tagly/models/shared";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789");

export function generateReferralCode(kind: "ADVERTISER" | "CUSTOMER") {
  return `${UID_PREFIX[kind]}-${nanoid(9)}`;
}
