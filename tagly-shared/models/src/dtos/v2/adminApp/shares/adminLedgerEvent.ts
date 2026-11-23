import { z } from "zod";
import { ISODateSchema } from "../../../../core/time";
import { TransactionKindSchema } from "../../../../core/enums";
import { CentsSchema } from "../../../../core/money";
import { ShareUidSchema } from "../../../../core/uids";

/**
 * One transaction-ledger event, admin view: the six signed balance deltas
 * (advertiser / customer / platform, each available + locked), its kind, the
 * share it belongs to (if any), and the raw `meta` bag. The ledger is the source
 * of truth for how money moved, so this powers every admin money trail
 * (share, withdrawal, credit-purchase, and the raw ledger feed).
 */
export const AdminLedgerEventSchema = z.object({
  kind: TransactionKindSchema,
  currency: z.string(),
  deltaAdvertiserCents: CentsSchema,
  deltaAdvertiserLockedCents: CentsSchema,
  deltaCustomerCents: CentsSchema,
  deltaCustomerLockedCents: CentsSchema,
  deltaPlatformCents: CentsSchema,
  deltaPlatformLockedCents: CentsSchema,
  shareUid: ShareUidSchema.nullable(),
  meta: z.record(z.string(), z.unknown()).nullable(),
  createdAt: ISODateSchema,
});
export type AdminLedgerEvent = z.infer<typeof AdminLedgerEventSchema>;
export type AdminLedgerEventInput = z.input<typeof AdminLedgerEventSchema>;
