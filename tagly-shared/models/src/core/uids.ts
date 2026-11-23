import { z } from "zod";

export const UID_PREFIX = {
  ADMIN: "admin",
  ADVERTISER: "a",
  CUSTOMER: "c",
  LOCAL_SUBACCOUNT: "l",
  SHARE: "sh",
  TRANSACTION: "t",
  MEDIA: "m",
  WITHDRAWAL: "wd",
  CREDIT_PURCHASE: "cp",
  BLAST: "blast",
} as const;

export type UidEntity = keyof typeof UID_PREFIX;

/**
 * Build a Zod schema for any UID with the given prefix.
 */
function uidSchema(prefix: string) {
  return z
    .string()
    .regex(
      new RegExp(`^${prefix}-[a-zA-Z0-9]{9}$`),
      `${prefix} UID is invalid`
    );
}

/**
 * Generic UID schema (matches any known prefix).
 */
export const UidSchema = z
  .string()
  .regex(
    new RegExp(`^(${Object.values(UID_PREFIX).join("|")})-[a-zA-Z0-9]{9}$`),
    "Invalid UID"
  );
export type Uid = z.infer<typeof UidSchema>;

/**
 * Entity-specific UID schemas & types.
 */
export const WithdrawalUidSchema = uidSchema(UID_PREFIX.WITHDRAWAL);
export type WithdrawalUid = z.infer<typeof WithdrawalUidSchema>;

export const CreditPurchaseUidSchema = uidSchema(UID_PREFIX.CREDIT_PURCHASE);
export type CreditPurchaseUid = z.infer<typeof CreditPurchaseUidSchema>;

export const AdminUidSchema = uidSchema(UID_PREFIX.ADMIN);
export type AdminUid = z.infer<typeof AdminUidSchema>;

export const BlastUidSchema = uidSchema(UID_PREFIX.BLAST);
export type BlastUid = z.infer<typeof BlastUidSchema>;

export const AdvertiserUidSchema = uidSchema(UID_PREFIX.ADVERTISER);
export type AdvertiserUid = z.infer<typeof AdvertiserUidSchema>;

export const CustomerUidSchema = uidSchema(UID_PREFIX.CUSTOMER);
export type CustomerUid = z.infer<typeof CustomerUidSchema>;

export const LocalSubaccountUidSchema = uidSchema(UID_PREFIX.LOCAL_SUBACCOUNT);
export type LocalSubaccountUid = z.infer<typeof LocalSubaccountUidSchema>;

export const ShareUidSchema = uidSchema(UID_PREFIX.SHARE);
export type ShareUid = z.infer<typeof ShareUidSchema>;

export const TransactionUidSchema = uidSchema(UID_PREFIX.TRANSACTION);
export type TransactionUid = z.infer<typeof TransactionUidSchema>;

export const MediaUidSchema = uidSchema(UID_PREFIX.MEDIA);
export type MediaUid = z.infer<typeof MediaUidSchema>;
