import { UID_PREFIX, UidEntity } from "@tagly/models/shared";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
);

export function generateUid(kind: UidEntity) {
  return `${UID_PREFIX[kind]}-${nanoid(9)}`;
}
