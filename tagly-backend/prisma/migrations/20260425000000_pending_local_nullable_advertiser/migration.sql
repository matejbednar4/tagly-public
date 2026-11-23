-- Allow admin-created subsidized locals to have no advertiser on the pending record
ALTER TABLE "app"."pending_local_subaccounts" ALTER COLUMN "advertiser_id" DROP NOT NULL;
