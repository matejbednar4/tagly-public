-- CreateEnum
CREATE TYPE "app"."MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "app"."OtpPurpose" AS ENUM ('REGISTRATION', 'LOGIN', 'EMAIL_CHANGE_CURRENT', 'EMAIL_CHANGE_NEW', 'PASSWORD_RESET', 'ACCOUNT_DELETION');

-- CreateEnum
CREATE TYPE "app"."PendingMediaPurpose" AS ENUM ('LOCAL_BANNER', 'LOCAL_PHOTO', 'NON_LOCAL_BANNER', 'NON_LOCAL_PHOTO', 'CAMPAIGN_STORY');

-- CreateEnum
CREATE TYPE "app"."AccountType" AS ENUM ('CUSTOMER', 'ADVERTISER');

-- CreateEnum
CREATE TYPE "app"."AccountReferralStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "app"."Gender" AS ENUM ('MALE', 'FEMALE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "app"."AudienceLocationSource" AS ENUM ('FOLLOWER_AUDIENCE', 'REACHED_AUDIENCE_24H');

-- CreateEnum
CREATE TYPE "app"."AdvertiserEntity" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "app"."PendingEntityStatus" AS ENUM ('DRAFT', 'PROCESSING', 'FAILED', 'READY');

-- CreateEnum
CREATE TYPE "app"."SubaccountStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "app"."AdvertiserScope" AS ENUM ('LOCAL', 'NON_LOCAL', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "app"."ShareStatus" AS ENUM ('PRE_INSIGHTS', 'PRE_SNAPSHOT', 'POST_SNAPSHOT', 'PENDING_REVIEW', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "app"."IgPostType" AS ENUM ('STORY', 'POST', 'REEL');

-- CreateEnum
CREATE TYPE "app"."ShareType" AS ENUM ('AUTHENTIC', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "app"."Rating" AS ENUM ('EXCEPTIONAL', 'GOOD', 'BAD', 'UNRATED', 'REPORTED');

-- CreateEnum
CREATE TYPE "app"."ReportType" AS ENUM ('NOT_PROMOTION', 'MISLEADING_LOCATION', 'INAPPROPRIATE', 'DUPLICATE', 'VIOLATES_GUIDELINES', 'CUSTOMER_NOT_SPENT_MONEY');

-- CreateEnum
CREATE TYPE "app"."ReportStatus" AS ENUM ('PENDING', 'VALID', 'DISMISSED');

-- CreateEnum
CREATE TYPE "app"."CampaignStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "app"."PendingCampaignShareStatus" AS ENUM ('PENDING', 'VALID', 'FAILED');

-- CreateEnum
CREATE TYPE "app"."TransactionKind" AS ENUM ('CREDIT_PURCHASE', 'CREDIT_PURCHASE_REFUND', 'WITHDRAWAL_LOCK', 'WITHDRAWAL_UNLOCK', 'WITHDRAWAL', 'WITHDRAWAL_REVERSAL', 'SHARE_LOCK', 'SHARE_UNLOCK', 'SHARE_PAYMENT', 'STRIPE_PROCESSING_FEE', 'REFERRAL_PAYOUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "app"."WithdrawalStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELED', 'REVERSED');

-- CreateEnum
CREATE TYPE "app"."CreditPurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "app"."NotificationEventStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "app"."NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "jobs"."JobStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "app"."otp_sessions" (
    "id" SERIAL NOT NULL,
    "purpose" "app"."OtpPurpose" NOT NULL,
    "target_email" CITEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "otp_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resend_count" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "pending_customer_id" INTEGER,
    "pending_advertiser_id" INTEGER,
    "customer_id" INTEGER,
    "advertiser_id" INTEGER,

    CONSTRAINT "otp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."pending_media" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "expected_mime" TEXT NOT NULL,
    "expected_max_bytes" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "purpose" "app"."PendingMediaPurpose" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "pending_local_id" INTEGER,
    "pending_non_local_id" INTEGER,

    CONSTRAINT "pending_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."media" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "app"."MediaType" NOT NULL,
    "mime" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "aspect_ratio" DOUBLE PRECISION NOT NULL,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "local_subaccount_id" INTEGER,
    "non_local_subaccount_id" INTEGER,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."account_referrals" (
    "id" SERIAL NOT NULL,
    "code" CITEXT NOT NULL,
    "code_updated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "app"."AccountReferralStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "account_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."referral_events" (
    "id" SERIAL NOT NULL,
    "referrer_code_id" INTEGER NOT NULL,
    "referred_code_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."pending_customers" (
    "id" SERIAL NOT NULL,
    "email" CITEXT NOT NULL,
    "instagram_uid" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "wants_promo_emails" BOOLEAN NOT NULL,
    "cancel_token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer_code" TEXT,
    "agreed_to_terms_of_service_at" TIMESTAMPTZ(3) NOT NULL,
    "agreed_to_privacy_policy_at" TIMESTAMPTZ(3) NOT NULL,
    "gender" "app"."Gender" NOT NULL,

    CONSTRAINT "pending_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."customers" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "instagram_uid" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "agreed_to_terms_of_service_at" TIMESTAMPTZ(3) NOT NULL,
    "agreed_to_privacy_policy_at" TIMESTAMPTZ(3) NOT NULL,
    "jwt_version" INTEGER NOT NULL DEFAULT 0,
    "full_name" TEXT NOT NULL,
    "sensitive_data_id" INTEGER NOT NULL,
    "gender" "app"."Gender" NOT NULL,
    "notifications_backfilled_at" TIMESTAMPTZ(3),
    "promo_emails_opt_in_at" TIMESTAMPTZ(3),
    "gender_updated_at" TIMESTAMPTZ(3),
    "interests_updated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "referral_code_id" INTEGER NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."customer_sensitive_data" (
    "id" SERIAL NOT NULL,
    "balance_cents" BIGINT NOT NULL DEFAULT 0,
    "locked_balance_cents" BIGINT NOT NULL DEFAULT 0,
    "multiplier_bps" INTEGER NOT NULL DEFAULT 10000,
    "stripe_connect_id" TEXT,
    "payouts_enabled_at" TIMESTAMPTZ(3),

    CONSTRAINT "customer_sensitive_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."customer_push_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "deviceId" TEXT,
    "timezone" TEXT,
    "disabledAt" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "customer_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."customer_instagram_accounts" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "pendingCustomerId" INTEGER,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "pfp_url" TEXT,
    "follower_count" INTEGER NOT NULL,
    "account_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_instagram_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."instagram_feed_snapshots" (
    "id" SERIAL NOT NULL,
    "instagram_id" INTEGER NOT NULL,
    "latest_post_id" TEXT,
    "latest_post_at" TIMESTAMP(3),
    "latest_story_id" TEXT,
    "latest_story_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_feed_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."instagram_tokens" (
    "id" SERIAL NOT NULL,
    "instagram_id" INTEGER NOT NULL,
    "access_token_enc" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "instagram_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."instagram_audience_location" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "location" geography(Point,4326),
    "value" INTEGER NOT NULL,
    "source" "app"."AudienceLocationSource" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "snapshot_id" INTEGER NOT NULL,

    CONSTRAINT "instagram_audience_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."instagram_audience_gender_age" (
    "id" SERIAL NOT NULL,
    "gender" TEXT NOT NULL,
    "age" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "snapshot_id" INTEGER NOT NULL,

    CONSTRAINT "instagram_audience_gender_age_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."addresses" (
    "id" SERIAL NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "location" geography(Point,4326),
    "city_location" geography(Point,4326),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."pending_advertiser_accounts" (
    "id" SERIAL NOT NULL,
    "email" CITEXT NOT NULL,
    "wants_promo_emails" BOOLEAN NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer_code" TEXT,
    "entity" "app"."AdvertiserEntity",
    "agreed_to_terms_of_service_at" TIMESTAMPTZ(3) NOT NULL,
    "agreed_to_privacy_policy_at" TIMESTAMPTZ(3) NOT NULL,
    "cancel_token" TEXT NOT NULL,

    CONSTRAINT "pending_advertiser_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."advertisers" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "password_id" INTEGER NOT NULL,
    "sensitive_data_id" INTEGER NOT NULL,
    "agreed_to_terms_of_service_at" TIMESTAMPTZ(3) NOT NULL,
    "agreed_to_privacy_policy_at" TIMESTAMPTZ(3) NOT NULL,
    "jwt_version" INTEGER NOT NULL DEFAULT 0,
    "entity" "app"."AdvertiserEntity",
    "notifications_backfilled_at" TIMESTAMPTZ(3),
    "promo_emails_opt_in_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "referral_code_id" INTEGER NOT NULL,

    CONSTRAINT "advertisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."advertiser_passwords" (
    "id" SERIAL NOT NULL,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "advertiser_passwords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."advertiser_sensitive_data" (
    "id" SERIAL NOT NULL,
    "available_budget_cents" BIGINT NOT NULL DEFAULT 0,
    "locked_budget_cents" BIGINT NOT NULL DEFAULT 0,
    "total_credit_purchases_cents" BIGINT NOT NULL DEFAULT 0,
    "stripe_customer_id" TEXT,
    "default_payment_method_id" TEXT,

    CONSTRAINT "advertiser_sensitive_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."advertiser_push_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "deviceId" TEXT,
    "timezone" TEXT,
    "disabledAt" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "advertiser_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "advertiser_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."pending_local_subaccounts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "instagram_tag" TEXT,
    "tags" TEXT[],
    "banner_id" INTEGER,
    "advertiser_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "address_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "app"."PendingEntityStatus" NOT NULL,

    CONSTRAINT "pending_local_subaccounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."pending_non_local_subaccounts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "instagram_tag" TEXT,
    "banner_id" INTEGER,
    "advertiser_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "app"."PendingEntityStatus" NOT NULL,

    CONSTRAINT "pending_non_local_subaccounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."local_subaccounts" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instagram_tag" TEXT,
    "tags" TEXT[],
    "banner_id" INTEGER NOT NULL,
    "status" "app"."SubaccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "advertiser_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "address_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "local_subaccounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."non_local_subaccounts" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instagram_tag" TEXT,
    "banner_id" INTEGER NOT NULL,
    "status" "app"."SubaccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "advertiser_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "non_local_subaccounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."verticals" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "reward_multiplier_bps" INTEGER NOT NULL DEFAULT 10000,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verticals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."advertiser_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "scope" "app"."AdvertiserScope"[],
    "reward_multiplier_bps" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "advertiser_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."interests" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."shares" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "customer_id" INTEGER,
    "advertiser_id" INTEGER,
    "local_id" INTEGER,
    "campaign_id" INTEGER,
    "agreed_to_monetization_terms_at" TIMESTAMPTZ(3) NOT NULL,
    "media_id" INTEGER NOT NULL,
    "thumbnail_id" INTEGER,
    "share_type" "app"."ShareType" NOT NULL,
    "ig_post_id" TEXT,
    "ig_post_type" "app"."IgPostType",
    "posted_to_ig_at" TIMESTAMPTZ(3),
    "estimated_price_cents" BIGINT NOT NULL,
    "estimated_reward_cents" BIGINT NOT NULL,
    "rating" "app"."Rating",
    "rated_at" TIMESTAMPTZ(3),
    "force_created" BOOLEAN,
    "status" "app"."ShareStatus" NOT NULL DEFAULT 'PRE_INSIGHTS',
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."instagram_snapshots" (
    "id" SERIAL NOT NULL,
    "share_id" INTEGER,
    "instagram_id" INTEGER NOT NULL,
    "follower_count" INTEGER NOT NULL,
    "follower_location_total_value" INTEGER NOT NULL DEFAULT 0,
    "snapshot_taken_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "instagram_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."final_price" (
    "share_id" INTEGER NOT NULL,
    "algo_version" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "qualified_reach" INTEGER NOT NULL,
    "ecpm_cents" BIGINT NOT NULL,
    "base_value_cents" BIGINT NOT NULL,
    "action_bonuses_cents" BIGINT NOT NULL,
    "geo_multiplier_bps" INTEGER NOT NULL,
    "demo_multiplier_bps" INTEGER NOT NULL,
    "interest_multiplier_bps" INTEGER NOT NULL,
    "rating_multiplier_bps" INTEGER NOT NULL,
    "frequency_multiplier_bps" INTEGER NOT NULL,
    "audience_relevance_multiplier_bps" INTEGER NOT NULL,
    "final_price_cents" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "final_price_pkey" PRIMARY KEY ("share_id")
);

-- CreateTable
CREATE TABLE "app"."ig_story_insights" (
    "share_id" INTEGER NOT NULL,
    "follows" INTEGER,
    "profile_visits" INTEGER,
    "reach" INTEGER,
    "replies" INTEGER,
    "shares" INTEGER,
    "total_interactions" INTEGER,
    "views" INTEGER,
    "taps_forward" INTEGER,
    "taps_back" INTEGER,
    "exits" INTEGER,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ig_story_insights_pkey" PRIMARY KEY ("share_id")
);

-- CreateTable
CREATE TABLE "app"."ig_post_insights" (
    "share_id" INTEGER NOT NULL,
    "comments" INTEGER,
    "follows" INTEGER,
    "likes" INTEGER,
    "profile_visits" INTEGER,
    "reach" INTEGER,
    "saved" INTEGER,
    "shares" INTEGER,
    "total_interactions" INTEGER,
    "views" INTEGER,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ig_post_insights_pkey" PRIMARY KEY ("share_id")
);

-- CreateTable
CREATE TABLE "app"."ig_reel_insights" (
    "share_id" INTEGER NOT NULL,
    "comments" INTEGER,
    "ig_reels_avg_watch_time" INTEGER,
    "likes" INTEGER,
    "reach" INTEGER,
    "saved" INTEGER,
    "shares" INTEGER,
    "total_interactions" INTEGER,
    "views" INTEGER,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ig_reel_insights_pkey" PRIMARY KEY ("share_id")
);

-- CreateTable
CREATE TABLE "app"."share_reports" (
    "id" SERIAL NOT NULL,
    "shareId" INTEGER NOT NULL,
    "report_type" "app"."ReportType" NOT NULL,
    "report_message" TEXT,
    "status" "app"."ReportStatus" NOT NULL DEFAULT 'PENDING',
    "review_message" TEXT,
    "reviewed_by_id" INTEGER,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "share_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."pending_campaigns" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type_id" INTEGER NOT NULL,
    "story_media_id" INTEGER,
    "advertiser_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "app"."PendingEntityStatus" NOT NULL,

    CONSTRAINT "pending_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."campaigns" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type_id" INTEGER NOT NULL,
    "story_media_id" INTEGER NOT NULL,
    "status" "app"."CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "advertiser_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."pending_campaign_shares" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "status" "app"."PendingCampaignShareStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pending_campaign_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."transaction_ledger_events" (
    "id" SERIAL NOT NULL,
    "kind" "app"."TransactionKind" NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "advertiser_id" INTEGER,
    "delta_advertiser_cents" BIGINT NOT NULL DEFAULT 0,
    "delta_advertiser_locked_cents" BIGINT NOT NULL DEFAULT 0,
    "customer_id" INTEGER,
    "delta_customer_cents" BIGINT NOT NULL DEFAULT 0,
    "delta_customer_locked_cents" BIGINT NOT NULL DEFAULT 0,
    "share_id" INTEGER,
    "grossSharePriceCents" BIGINT,
    "delta_platform_revenue_cents" BIGINT NOT NULL DEFAULT 0,
    "external_ref" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripe_credit_purchase_id" INTEGER,
    "stripe_withdrawal_id" INTEGER,

    CONSTRAINT "transaction_ledger_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."stripe_withdrawals" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "customer_id" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "amount_cents" BIGINT NOT NULL,
    "stripeTransferId" TEXT,
    "stripe_payout_id" TEXT,
    "instant" BOOLEAN NOT NULL DEFAULT false,
    "status" "app"."WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "failure_code" TEXT,
    "failure_message" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."stripe_credit_purchases" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "advertiser_id" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "amount_cents" BIGINT NOT NULL,
    "fee_cents" BIGINT DEFAULT 0,
    "net_cents" BIGINT DEFAULT 0,
    "stripe_payment_intent_id" TEXT NOT NULL,
    "stripe_charge_id" TEXT,
    "status" "app"."CreditPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "failure_code" TEXT,
    "failure_message" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."stripe_events" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."notification_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "customer_description" TEXT,
    "advertiser_description" TEXT,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."notification_events" (
    "id" SERIAL NOT NULL,
    "target" "app"."AccountType" NOT NULL,
    "mandatory_channels" "app"."NotificationChannel"[],
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category_id" INTEGER NOT NULL,
    "available_channels" "app"."NotificationChannel"[],
    "status" "app"."NotificationEventStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "sort_order" INTEGER,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."advertiser_notification_event_preferences" (
    "advertiserId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "enabled_channels" "app"."NotificationChannel"[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "advertiser_notification_event_preferences_pkey" PRIMARY KEY ("advertiserId","eventId")
);

-- CreateTable
CREATE TABLE "app"."customer_notification_event_preferences" (
    "customerId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "enabled_channels" "app"."NotificationChannel"[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_notification_event_preferences_pkey" PRIMARY KEY ("customerId","eventId")
);

-- CreateTable
CREATE TABLE "jobs"."instagram_insights_queue" (
    "id" SERIAL NOT NULL,
    "share_id" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "valid_until" TIMESTAMPTZ(3),
    "status" "jobs"."JobStatus" NOT NULL DEFAULT 'SCHEDULED',
    "started_at" TIMESTAMPTZ(3),
    "processing_deadline" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "instagram_insights_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs"."instagram_snapshot_queue" (
    "id" SERIAL NOT NULL,
    "instagram_id" INTEGER NOT NULL,
    "share_id" INTEGER,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "jobs"."JobStatus" NOT NULL DEFAULT 'SCHEDULED',
    "started_at" TIMESTAMPTZ(3),
    "processing_deadline" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "instagram_snapshot_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs"."notification_queue" (
    "id" SERIAL NOT NULL,
    "target" "app"."AccountType" NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "overwrite_email" TEXT,
    "event_id" INTEGER NOT NULL,
    "channel" "app"."NotificationChannel" NOT NULL,
    "payload" JSONB,
    "dedupe_key" TEXT,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "jobs"."JobStatus" NOT NULL DEFAULT 'SCHEDULED',
    "started_at" TIMESTAMPTZ(3),
    "processing_deadline" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."_CustomerToInterest" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CustomerToInterest_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "app"."_LocalSubaccountToPendingCampaign" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_LocalSubaccountToPendingCampaign_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "app"."_NonLocalSubaccountToPendingCampaign" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_NonLocalSubaccountToPendingCampaign_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "app"."_AdvertiserTypeToVertical" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AdvertiserTypeToVertical_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "app"."_InterestToVertical" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_InterestToVertical_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "app"."_InterestToPendingCustomer" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_InterestToPendingCustomer_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "app"."_CampaignToLocalSubaccount" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CampaignToLocalSubaccount_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "app"."_CampaignToNonLocalSubaccount" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CampaignToNonLocalSubaccount_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "otp_sessions_pending_customer_id_key" ON "app"."otp_sessions"("pending_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "otp_sessions_pending_advertiser_id_key" ON "app"."otp_sessions"("pending_advertiser_id");

-- CreateIndex
CREATE INDEX "otp_sessions_target_email_purpose_idx" ON "app"."otp_sessions"("target_email", "purpose");

-- CreateIndex
CREATE INDEX "otp_sessions_otp_expires_at_idx" ON "app"."otp_sessions"("otp_expires_at");

-- CreateIndex
CREATE INDEX "otp_sessions_customer_id_purpose_idx" ON "app"."otp_sessions"("customer_id", "purpose");

-- CreateIndex
CREATE INDEX "otp_sessions_advertiser_id_purpose_idx" ON "app"."otp_sessions"("advertiser_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "otp_sessions_purpose_customer_id_key" ON "app"."otp_sessions"("purpose", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "otp_sessions_purpose_advertiser_id_key" ON "app"."otp_sessions"("purpose", "advertiser_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_media_uid_key" ON "app"."pending_media"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "pending_media_key_key" ON "app"."pending_media"("key");

-- CreateIndex
CREATE INDEX "pending_media_key_idx" ON "app"."pending_media"("key");

-- CreateIndex
CREATE INDEX "pending_media_created_at_idx" ON "app"."pending_media"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_uid_key" ON "app"."media"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "media_key_key" ON "app"."media"("key");

-- CreateIndex
CREATE INDEX "media_key_idx" ON "app"."media"("key");

-- CreateIndex
CREATE INDEX "media_type_idx" ON "app"."media"("type");

-- CreateIndex
CREATE UNIQUE INDEX "account_referrals_code_key" ON "app"."account_referrals"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_events_referred_code_id_key" ON "app"."referral_events"("referred_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_customers_email_key" ON "app"."pending_customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pending_customers_instagram_uid_key" ON "app"."pending_customers"("instagram_uid");

-- CreateIndex
CREATE UNIQUE INDEX "customers_uid_key" ON "app"."customers"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "customers_instagram_uid_key" ON "app"."customers"("instagram_uid");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "app"."customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_sensitive_data_id_key" ON "app"."customers"("sensitive_data_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_referral_code_id_key" ON "app"."customers"("referral_code_id");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "app"."customers"("email");

-- CreateIndex
CREATE INDEX "customers_created_at_idx" ON "app"."customers"("created_at");

-- CreateIndex
CREATE INDEX "customers_uid_idx" ON "app"."customers"("uid");

-- CreateIndex
CREATE INDEX "customers_sensitive_data_id_idx" ON "app"."customers"("sensitive_data_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_push_tokens_token_key" ON "app"."customer_push_tokens"("token");

-- CreateIndex
CREATE INDEX "customer_push_tokens_disabledAt_idx" ON "app"."customer_push_tokens"("disabledAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_instagram_accounts_customerId_key" ON "app"."customer_instagram_accounts"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_instagram_accounts_pendingCustomerId_key" ON "app"."customer_instagram_accounts"("pendingCustomerId");

-- CreateIndex
CREATE INDEX "customer_instagram_accounts_username_idx" ON "app"."customer_instagram_accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_feed_snapshots_instagram_id_key" ON "app"."instagram_feed_snapshots"("instagram_id");

-- CreateIndex
CREATE INDEX "instagram_feed_snapshots_latest_post_at_idx" ON "app"."instagram_feed_snapshots"("latest_post_at");

-- CreateIndex
CREATE INDEX "instagram_feed_snapshots_latest_story_at_idx" ON "app"."instagram_feed_snapshots"("latest_story_at");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_tokens_instagram_id_key" ON "app"."instagram_tokens"("instagram_id");

-- CreateIndex
CREATE INDEX "instagram_tokens_instagram_id_idx" ON "app"."instagram_tokens"("instagram_id");

-- CreateIndex
CREATE INDEX "instagram_tokens_expires_at_idx" ON "app"."instagram_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "instagram_audience_location_snapshot_id_source_idx" ON "app"."instagram_audience_location"("snapshot_id", "source");

-- CreateIndex
CREATE INDEX "instagram_audience_location_snapshot_id_idx" ON "app"."instagram_audience_location"("snapshot_id");

-- CreateIndex
CREATE INDEX "instagram_audience_location_location_idx" ON "app"."instagram_audience_location" USING GIST ("location");

-- CreateIndex
CREATE INDEX "instagram_audience_location_address_idx" ON "app"."instagram_audience_location"("address");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_audience_location_snapshot_id_source_address_key" ON "app"."instagram_audience_location"("snapshot_id", "source", "address");

-- CreateIndex
CREATE INDEX "instagram_audience_gender_age_snapshot_id_idx" ON "app"."instagram_audience_gender_age"("snapshot_id");

-- CreateIndex
CREATE INDEX "instagram_audience_gender_age_gender_age_idx" ON "app"."instagram_audience_gender_age"("gender", "age");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_audience_gender_age_snapshot_id_gender_age_key" ON "app"."instagram_audience_gender_age"("snapshot_id", "gender", "age");

-- CreateIndex
CREATE INDEX "addresses_location_idx" ON "app"."addresses" USING GIST ("location");

-- CreateIndex
CREATE INDEX "addresses_city_location_idx" ON "app"."addresses" USING GIST ("city_location");

-- CreateIndex
CREATE INDEX "addresses_city_idx" ON "app"."addresses"("city");

-- CreateIndex
CREATE INDEX "addresses_zip_idx" ON "app"."addresses"("zip");

-- CreateIndex
CREATE UNIQUE INDEX "pending_advertiser_accounts_email_key" ON "app"."pending_advertiser_accounts"("email");

-- CreateIndex
CREATE INDEX "pending_advertiser_accounts_created_at_idx" ON "app"."pending_advertiser_accounts"("created_at");

-- CreateIndex
CREATE INDEX "pending_advertiser_accounts_email_idx" ON "app"."pending_advertiser_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "advertisers_uid_key" ON "app"."advertisers"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "advertisers_email_key" ON "app"."advertisers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "advertisers_password_id_key" ON "app"."advertisers"("password_id");

-- CreateIndex
CREATE UNIQUE INDEX "advertisers_sensitive_data_id_key" ON "app"."advertisers"("sensitive_data_id");

-- CreateIndex
CREATE UNIQUE INDEX "advertisers_referral_code_id_key" ON "app"."advertisers"("referral_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "advertiser_sensitive_data_stripe_customer_id_key" ON "app"."advertiser_sensitive_data"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "advertiser_sensitive_data_stripe_customer_id_idx" ON "app"."advertiser_sensitive_data"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "advertiser_push_tokens_token_key" ON "app"."advertiser_push_tokens"("token");

-- CreateIndex
CREATE INDEX "advertiser_push_tokens_disabledAt_idx" ON "app"."advertiser_push_tokens"("disabledAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_local_subaccounts_banner_id_key" ON "app"."pending_local_subaccounts"("banner_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_local_subaccounts_address_id_key" ON "app"."pending_local_subaccounts"("address_id");

-- CreateIndex
CREATE INDEX "pending_local_subaccounts_type_id_idx" ON "app"."pending_local_subaccounts"("type_id");

-- CreateIndex
CREATE INDEX "pending_local_subaccounts_advertiser_id_idx" ON "app"."pending_local_subaccounts"("advertiser_id");

-- CreateIndex
CREATE INDEX "pending_local_subaccounts_created_at_idx" ON "app"."pending_local_subaccounts"("created_at");

-- CreateIndex
CREATE INDEX "pending_local_subaccounts_created_at_status_idx" ON "app"."pending_local_subaccounts"("created_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pending_non_local_subaccounts_banner_id_key" ON "app"."pending_non_local_subaccounts"("banner_id");

-- CreateIndex
CREATE INDEX "pending_non_local_subaccounts_type_id_idx" ON "app"."pending_non_local_subaccounts"("type_id");

-- CreateIndex
CREATE INDEX "pending_non_local_subaccounts_advertiser_id_idx" ON "app"."pending_non_local_subaccounts"("advertiser_id");

-- CreateIndex
CREATE INDEX "pending_non_local_subaccounts_created_at_idx" ON "app"."pending_non_local_subaccounts"("created_at");

-- CreateIndex
CREATE INDEX "pending_non_local_subaccounts_created_at_status_idx" ON "app"."pending_non_local_subaccounts"("created_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "local_subaccounts_uid_key" ON "app"."local_subaccounts"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "local_subaccounts_banner_id_key" ON "app"."local_subaccounts"("banner_id");

-- CreateIndex
CREATE UNIQUE INDEX "local_subaccounts_address_id_key" ON "app"."local_subaccounts"("address_id");

-- CreateIndex
CREATE INDEX "local_subaccounts_type_id_idx" ON "app"."local_subaccounts"("type_id");

-- CreateIndex
CREATE INDEX "local_subaccounts_advertiser_id_idx" ON "app"."local_subaccounts"("advertiser_id");

-- CreateIndex
CREATE INDEX "local_subaccounts_uid_idx" ON "app"."local_subaccounts"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "non_local_subaccounts_uid_key" ON "app"."non_local_subaccounts"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "non_local_subaccounts_banner_id_key" ON "app"."non_local_subaccounts"("banner_id");

-- CreateIndex
CREATE INDEX "non_local_subaccounts_type_id_idx" ON "app"."non_local_subaccounts"("type_id");

-- CreateIndex
CREATE INDEX "non_local_subaccounts_advertiser_id_idx" ON "app"."non_local_subaccounts"("advertiser_id");

-- CreateIndex
CREATE INDEX "non_local_subaccounts_uid_idx" ON "app"."non_local_subaccounts"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "verticals_name_key" ON "app"."verticals"("name");

-- CreateIndex
CREATE UNIQUE INDEX "verticals_slug_key" ON "app"."verticals"("slug");

-- CreateIndex
CREATE INDEX "verticals_name_idx" ON "app"."verticals"("name");

-- CreateIndex
CREATE INDEX "verticals_slug_idx" ON "app"."verticals"("slug");

-- CreateIndex
CREATE INDEX "verticals_sort_order_idx" ON "app"."verticals"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "advertiser_types_name_key" ON "app"."advertiser_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "advertiser_types_slug_key" ON "app"."advertiser_types"("slug");

-- CreateIndex
CREATE INDEX "advertiser_types_name_idx" ON "app"."advertiser_types"("name");

-- CreateIndex
CREATE INDEX "advertiser_types_slug_idx" ON "app"."advertiser_types"("slug");

-- CreateIndex
CREATE INDEX "advertiser_types_sort_order_idx" ON "app"."advertiser_types"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "interests_name_key" ON "app"."interests"("name");

-- CreateIndex
CREATE UNIQUE INDEX "interests_slug_key" ON "app"."interests"("slug");

-- CreateIndex
CREATE INDEX "interests_name_idx" ON "app"."interests"("name");

-- CreateIndex
CREATE INDEX "interests_slug_idx" ON "app"."interests"("slug");

-- CreateIndex
CREATE INDEX "interests_sort_order_idx" ON "app"."interests"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "shares_uid_key" ON "app"."shares"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "shares_media_id_key" ON "app"."shares"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "shares_thumbnail_id_key" ON "app"."shares"("thumbnail_id");

-- CreateIndex
CREATE UNIQUE INDEX "shares_ig_post_id_key" ON "app"."shares"("ig_post_id");

-- CreateIndex
CREATE INDEX "shares_advertiser_id_status_idx" ON "app"."shares"("advertiser_id", "status");

-- CreateIndex
CREATE INDEX "shares_local_id_status_idx" ON "app"."shares"("local_id", "status");

-- CreateIndex
CREATE INDEX "shares_status_created_at_idx" ON "app"."shares"("status", "created_at");

-- CreateIndex
CREATE INDEX "shares_media_id_idx" ON "app"."shares"("media_id");

-- CreateIndex
CREATE INDEX "shares_advertiser_id_created_at_idx" ON "app"."shares"("advertiser_id", "created_at");

-- CreateIndex
CREATE INDEX "shares_customer_id_created_at_idx" ON "app"."shares"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "shares_local_id_idx" ON "app"."shares"("local_id");

-- CreateIndex
CREATE INDEX "shares_ig_post_id_idx" ON "app"."shares"("ig_post_id");

-- CreateIndex
CREATE INDEX "shares_uid_idx" ON "app"."shares"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "shares_customer_id_campaign_id_key" ON "app"."shares"("customer_id", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_snapshots_share_id_key" ON "app"."instagram_snapshots"("share_id");

-- CreateIndex
CREATE INDEX "instagram_snapshots_share_id_idx" ON "app"."instagram_snapshots"("share_id");

-- CreateIndex
CREATE INDEX "instagram_snapshots_instagram_id_idx" ON "app"."instagram_snapshots"("instagram_id");

-- CreateIndex
CREATE INDEX "instagram_snapshots_instagram_id_snapshot_taken_at_idx" ON "app"."instagram_snapshots"("instagram_id", "snapshot_taken_at");

-- CreateIndex
CREATE INDEX "instagram_snapshots_created_at_idx" ON "app"."instagram_snapshots"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "share_reports_shareId_key" ON "app"."share_reports"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "pending_campaigns_story_media_id_key" ON "app"."pending_campaigns"("story_media_id");

-- CreateIndex
CREATE INDEX "pending_campaigns_advertiser_id_created_at_idx" ON "app"."pending_campaigns"("advertiser_id", "created_at");

-- CreateIndex
CREATE INDEX "pending_campaigns_advertiser_id_idx" ON "app"."pending_campaigns"("advertiser_id");

-- CreateIndex
CREATE INDEX "pending_campaigns_type_id_idx" ON "app"."pending_campaigns"("type_id");

-- CreateIndex
CREATE INDEX "pending_campaigns_created_at_idx" ON "app"."pending_campaigns"("created_at");

-- CreateIndex
CREATE INDEX "pending_campaigns_created_at_status_idx" ON "app"."pending_campaigns"("created_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_uid_key" ON "app"."campaigns"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_story_media_id_key" ON "app"."campaigns"("story_media_id");

-- CreateIndex
CREATE INDEX "campaigns_uid_idx" ON "app"."campaigns"("uid");

-- CreateIndex
CREATE INDEX "campaigns_advertiser_id_created_at_idx" ON "app"."campaigns"("advertiser_id", "created_at");

-- CreateIndex
CREATE INDEX "campaigns_advertiser_id_idx" ON "app"."campaigns"("advertiser_id");

-- CreateIndex
CREATE INDEX "campaigns_type_id_idx" ON "app"."campaigns"("type_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_campaign_shares_uid_key" ON "app"."pending_campaign_shares"("uid");

-- CreateIndex
CREATE INDEX "pending_campaign_shares_campaignId_idx" ON "app"."pending_campaign_shares"("campaignId");

-- CreateIndex
CREATE INDEX "pending_campaign_shares_customerId_idx" ON "app"."pending_campaign_shares"("customerId");

-- CreateIndex
CREATE INDEX "pending_campaign_shares_status_createdAt_idx" ON "app"."pending_campaign_shares"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_campaign_shares_campaignId_customerId_key" ON "app"."pending_campaign_shares"("campaignId", "customerId");

-- CreateIndex
CREATE INDEX "transaction_ledger_events_customer_id_created_at_idx" ON "app"."transaction_ledger_events"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "transaction_ledger_events_advertiser_id_created_at_idx" ON "app"."transaction_ledger_events"("advertiser_id", "created_at");

-- CreateIndex
CREATE INDEX "transaction_ledger_events_kind_created_at_idx" ON "app"."transaction_ledger_events"("kind", "created_at");

-- CreateIndex
CREATE INDEX "transaction_ledger_events_advertiser_id_idx" ON "app"."transaction_ledger_events"("advertiser_id");

-- CreateIndex
CREATE INDEX "transaction_ledger_events_customer_id_idx" ON "app"."transaction_ledger_events"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_ledger_events_external_ref_kind_key" ON "app"."transaction_ledger_events"("external_ref", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_withdrawals_uid_key" ON "app"."stripe_withdrawals"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_withdrawals_stripeTransferId_key" ON "app"."stripe_withdrawals"("stripeTransferId");

-- CreateIndex
CREATE INDEX "stripe_withdrawals_customer_id_created_at_idx" ON "app"."stripe_withdrawals"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "stripe_withdrawals_stripe_payout_id_idx" ON "app"."stripe_withdrawals"("stripe_payout_id");

-- CreateIndex
CREATE INDEX "stripe_withdrawals_stripeTransferId_idx" ON "app"."stripe_withdrawals"("stripeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_credit_purchases_uid_key" ON "app"."stripe_credit_purchases"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_credit_purchases_stripe_payment_intent_id_key" ON "app"."stripe_credit_purchases"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "stripe_credit_purchases_advertiser_id_created_at_idx" ON "app"."stripe_credit_purchases"("advertiser_id", "created_at");

-- CreateIndex
CREATE INDEX "stripe_credit_purchases_stripe_payment_intent_id_idx" ON "app"."stripe_credit_purchases"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "stripe_credit_purchases_stripe_charge_id_idx" ON "app"."stripe_credit_purchases"("stripe_charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_events_eventId_key" ON "app"."stripe_events"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_categories_slug_key" ON "app"."notification_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "notification_events_slug_key" ON "app"."notification_events"("slug");

-- CreateIndex
CREATE INDEX "notification_events_slug_idx" ON "app"."notification_events"("slug");

-- CreateIndex
CREATE INDEX "notification_events_target_idx" ON "app"."notification_events"("target");

-- CreateIndex
CREATE INDEX "notification_events_label_idx" ON "app"."notification_events"("label");

-- CreateIndex
CREATE INDEX "advertiser_notification_event_preferences_advertiserId_idx" ON "app"."advertiser_notification_event_preferences"("advertiserId");

-- CreateIndex
CREATE INDEX "advertiser_notification_event_preferences_eventId_idx" ON "app"."advertiser_notification_event_preferences"("eventId");

-- CreateIndex
CREATE INDEX "customer_notification_event_preferences_customerId_idx" ON "app"."customer_notification_event_preferences"("customerId");

-- CreateIndex
CREATE INDEX "customer_notification_event_preferences_eventId_idx" ON "app"."customer_notification_event_preferences"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_insights_queue_share_id_key" ON "jobs"."instagram_insights_queue"("share_id");

-- CreateIndex
CREATE INDEX "instagram_insights_queue_status_finished_at_idx" ON "jobs"."instagram_insights_queue"("status", "finished_at");

-- CreateIndex
CREATE INDEX "instagram_insights_queue_status_updated_at_idx" ON "jobs"."instagram_insights_queue"("status", "updated_at");

-- CreateIndex
CREATE INDEX "instagram_insights_queue_status_scheduled_at_idx" ON "jobs"."instagram_insights_queue"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "instagram_insights_queue_status_processing_deadline_idx" ON "jobs"."instagram_insights_queue"("status", "processing_deadline");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_snapshot_queue_share_id_key" ON "jobs"."instagram_snapshot_queue"("share_id");

-- CreateIndex
CREATE INDEX "instagram_snapshot_queue_status_finished_at_idx" ON "jobs"."instagram_snapshot_queue"("status", "finished_at");

-- CreateIndex
CREATE INDEX "instagram_snapshot_queue_status_updated_at_idx" ON "jobs"."instagram_snapshot_queue"("status", "updated_at");

-- CreateIndex
CREATE INDEX "instagram_snapshot_queue_status_scheduled_at_idx" ON "jobs"."instagram_snapshot_queue"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "instagram_snapshot_queue_status_scheduled_at_id_idx" ON "jobs"."instagram_snapshot_queue"("status", "scheduled_at", "id");

-- CreateIndex
CREATE INDEX "instagram_snapshot_queue_instagram_id_status_idx" ON "jobs"."instagram_snapshot_queue"("instagram_id", "status");

-- CreateIndex
CREATE INDEX "instagram_snapshot_queue_status_processing_deadline_idx" ON "jobs"."instagram_snapshot_queue"("status", "processing_deadline");

-- CreateIndex
CREATE INDEX "notification_queue_status_scheduled_at_idx" ON "jobs"."notification_queue"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "notification_queue_status_finished_at_idx" ON "jobs"."notification_queue"("status", "finished_at");

-- CreateIndex
CREATE INDEX "notification_queue_status_updated_at_idx" ON "jobs"."notification_queue"("status", "updated_at");

-- CreateIndex
CREATE INDEX "notification_queue_status_processing_deadline_idx" ON "jobs"."notification_queue"("status", "processing_deadline");

-- CreateIndex
CREATE INDEX "notification_queue_recipient_id_event_id_channel_idx" ON "jobs"."notification_queue"("recipient_id", "event_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_queue_target_recipient_id_event_id_channel_ded_key" ON "jobs"."notification_queue"("target", "recipient_id", "event_id", "channel", "dedupe_key");

-- CreateIndex
CREATE INDEX "_CustomerToInterest_B_index" ON "app"."_CustomerToInterest"("B");

-- CreateIndex
CREATE INDEX "_LocalSubaccountToPendingCampaign_B_index" ON "app"."_LocalSubaccountToPendingCampaign"("B");

-- CreateIndex
CREATE INDEX "_NonLocalSubaccountToPendingCampaign_B_index" ON "app"."_NonLocalSubaccountToPendingCampaign"("B");

-- CreateIndex
CREATE INDEX "_AdvertiserTypeToVertical_B_index" ON "app"."_AdvertiserTypeToVertical"("B");

-- CreateIndex
CREATE INDEX "_InterestToVertical_B_index" ON "app"."_InterestToVertical"("B");

-- CreateIndex
CREATE INDEX "_InterestToPendingCustomer_B_index" ON "app"."_InterestToPendingCustomer"("B");

-- CreateIndex
CREATE INDEX "_CampaignToLocalSubaccount_B_index" ON "app"."_CampaignToLocalSubaccount"("B");

-- CreateIndex
CREATE INDEX "_CampaignToNonLocalSubaccount_B_index" ON "app"."_CampaignToNonLocalSubaccount"("B");

-- AddForeignKey
ALTER TABLE "app"."otp_sessions" ADD CONSTRAINT "otp_sessions_pending_customer_id_fkey" FOREIGN KEY ("pending_customer_id") REFERENCES "app"."pending_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."otp_sessions" ADD CONSTRAINT "otp_sessions_pending_advertiser_id_fkey" FOREIGN KEY ("pending_advertiser_id") REFERENCES "app"."pending_advertiser_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."otp_sessions" ADD CONSTRAINT "otp_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."otp_sessions" ADD CONSTRAINT "otp_sessions_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_media" ADD CONSTRAINT "pending_media_pending_local_id_fkey" FOREIGN KEY ("pending_local_id") REFERENCES "app"."pending_local_subaccounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_media" ADD CONSTRAINT "pending_media_pending_non_local_id_fkey" FOREIGN KEY ("pending_non_local_id") REFERENCES "app"."pending_non_local_subaccounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."media" ADD CONSTRAINT "media_local_subaccount_id_fkey" FOREIGN KEY ("local_subaccount_id") REFERENCES "app"."local_subaccounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."media" ADD CONSTRAINT "media_non_local_subaccount_id_fkey" FOREIGN KEY ("non_local_subaccount_id") REFERENCES "app"."non_local_subaccounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."referral_events" ADD CONSTRAINT "referral_events_referrer_code_id_fkey" FOREIGN KEY ("referrer_code_id") REFERENCES "app"."account_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."referral_events" ADD CONSTRAINT "referral_events_referred_code_id_fkey" FOREIGN KEY ("referred_code_id") REFERENCES "app"."account_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."customers" ADD CONSTRAINT "customers_sensitive_data_id_fkey" FOREIGN KEY ("sensitive_data_id") REFERENCES "app"."customer_sensitive_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."customers" ADD CONSTRAINT "customers_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "app"."account_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."customer_push_tokens" ADD CONSTRAINT "customer_push_tokens_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."customer_instagram_accounts" ADD CONSTRAINT "customer_instagram_accounts_pendingCustomerId_fkey" FOREIGN KEY ("pendingCustomerId") REFERENCES "app"."pending_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."customer_instagram_accounts" ADD CONSTRAINT "customer_instagram_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "app"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."instagram_feed_snapshots" ADD CONSTRAINT "instagram_feed_snapshots_instagram_id_fkey" FOREIGN KEY ("instagram_id") REFERENCES "app"."customer_instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."instagram_tokens" ADD CONSTRAINT "instagram_tokens_instagram_id_fkey" FOREIGN KEY ("instagram_id") REFERENCES "app"."customer_instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."instagram_audience_location" ADD CONSTRAINT "instagram_audience_location_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "app"."instagram_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."instagram_audience_gender_age" ADD CONSTRAINT "instagram_audience_gender_age_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "app"."instagram_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."advertisers" ADD CONSTRAINT "advertisers_password_id_fkey" FOREIGN KEY ("password_id") REFERENCES "app"."advertiser_passwords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."advertisers" ADD CONSTRAINT "advertisers_sensitive_data_id_fkey" FOREIGN KEY ("sensitive_data_id") REFERENCES "app"."advertiser_sensitive_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."advertisers" ADD CONSTRAINT "advertisers_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "app"."account_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."advertiser_push_tokens" ADD CONSTRAINT "advertiser_push_tokens_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_local_subaccounts" ADD CONSTRAINT "pending_local_subaccounts_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "app"."pending_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_local_subaccounts" ADD CONSTRAINT "pending_local_subaccounts_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_local_subaccounts" ADD CONSTRAINT "pending_local_subaccounts_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "app"."advertiser_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_local_subaccounts" ADD CONSTRAINT "pending_local_subaccounts_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "app"."addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_non_local_subaccounts" ADD CONSTRAINT "pending_non_local_subaccounts_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "app"."pending_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_non_local_subaccounts" ADD CONSTRAINT "pending_non_local_subaccounts_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_non_local_subaccounts" ADD CONSTRAINT "pending_non_local_subaccounts_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "app"."advertiser_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."local_subaccounts" ADD CONSTRAINT "local_subaccounts_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "app"."media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."local_subaccounts" ADD CONSTRAINT "local_subaccounts_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."local_subaccounts" ADD CONSTRAINT "local_subaccounts_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "app"."advertiser_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."local_subaccounts" ADD CONSTRAINT "local_subaccounts_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "app"."addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."non_local_subaccounts" ADD CONSTRAINT "non_local_subaccounts_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "app"."media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."non_local_subaccounts" ADD CONSTRAINT "non_local_subaccounts_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."non_local_subaccounts" ADD CONSTRAINT "non_local_subaccounts_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "app"."advertiser_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."shares" ADD CONSTRAINT "shares_thumbnail_id_fkey" FOREIGN KEY ("thumbnail_id") REFERENCES "app"."media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."shares" ADD CONSTRAINT "shares_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "app"."media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."shares" ADD CONSTRAINT "shares_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."shares" ADD CONSTRAINT "shares_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."shares" ADD CONSTRAINT "shares_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "app"."campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."shares" ADD CONSTRAINT "shares_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "app"."local_subaccounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."instagram_snapshots" ADD CONSTRAINT "instagram_snapshots_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "app"."shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."instagram_snapshots" ADD CONSTRAINT "instagram_snapshots_instagram_id_fkey" FOREIGN KEY ("instagram_id") REFERENCES "app"."customer_instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."final_price" ADD CONSTRAINT "final_price_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "app"."shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ig_story_insights" ADD CONSTRAINT "ig_story_insights_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "app"."shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ig_post_insights" ADD CONSTRAINT "ig_post_insights_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "app"."shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ig_reel_insights" ADD CONSTRAINT "ig_reel_insights_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "app"."shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."share_reports" ADD CONSTRAINT "share_reports_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "app"."shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_campaigns" ADD CONSTRAINT "pending_campaigns_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "app"."advertiser_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_campaigns" ADD CONSTRAINT "pending_campaigns_story_media_id_fkey" FOREIGN KEY ("story_media_id") REFERENCES "app"."pending_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_campaigns" ADD CONSTRAINT "pending_campaigns_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."campaigns" ADD CONSTRAINT "campaigns_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "app"."advertiser_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."campaigns" ADD CONSTRAINT "campaigns_story_media_id_fkey" FOREIGN KEY ("story_media_id") REFERENCES "app"."media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."campaigns" ADD CONSTRAINT "campaigns_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_campaign_shares" ADD CONSTRAINT "pending_campaign_shares_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "app"."campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."pending_campaign_shares" ADD CONSTRAINT "pending_campaign_shares_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "app"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."transaction_ledger_events" ADD CONSTRAINT "transaction_ledger_events_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."transaction_ledger_events" ADD CONSTRAINT "transaction_ledger_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."transaction_ledger_events" ADD CONSTRAINT "transaction_ledger_events_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "app"."shares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."transaction_ledger_events" ADD CONSTRAINT "transaction_ledger_events_stripe_credit_purchase_id_fkey" FOREIGN KEY ("stripe_credit_purchase_id") REFERENCES "app"."stripe_credit_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."transaction_ledger_events" ADD CONSTRAINT "transaction_ledger_events_stripe_withdrawal_id_fkey" FOREIGN KEY ("stripe_withdrawal_id") REFERENCES "app"."stripe_withdrawals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."stripe_withdrawals" ADD CONSTRAINT "stripe_withdrawals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."stripe_credit_purchases" ADD CONSTRAINT "stripe_credit_purchases_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."notification_events" ADD CONSTRAINT "notification_events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "app"."notification_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."advertiser_notification_event_preferences" ADD CONSTRAINT "advertiser_notification_event_preferences_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."advertiser_notification_event_preferences" ADD CONSTRAINT "advertiser_notification_event_preferences_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "app"."notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."customer_notification_event_preferences" ADD CONSTRAINT "customer_notification_event_preferences_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "app"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."customer_notification_event_preferences" ADD CONSTRAINT "customer_notification_event_preferences_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "app"."notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs"."instagram_insights_queue" ADD CONSTRAINT "instagram_insights_queue_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "app"."shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs"."instagram_snapshot_queue" ADD CONSTRAINT "instagram_snapshot_queue_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "app"."shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs"."instagram_snapshot_queue" ADD CONSTRAINT "instagram_snapshot_queue_instagram_id_fkey" FOREIGN KEY ("instagram_id") REFERENCES "app"."customer_instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs"."notification_queue" ADD CONSTRAINT "notification_queue_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "app"."notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_CustomerToInterest" ADD CONSTRAINT "_CustomerToInterest_A_fkey" FOREIGN KEY ("A") REFERENCES "app"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_CustomerToInterest" ADD CONSTRAINT "_CustomerToInterest_B_fkey" FOREIGN KEY ("B") REFERENCES "app"."interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_LocalSubaccountToPendingCampaign" ADD CONSTRAINT "_LocalSubaccountToPendingCampaign_A_fkey" FOREIGN KEY ("A") REFERENCES "app"."local_subaccounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_LocalSubaccountToPendingCampaign" ADD CONSTRAINT "_LocalSubaccountToPendingCampaign_B_fkey" FOREIGN KEY ("B") REFERENCES "app"."pending_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_NonLocalSubaccountToPendingCampaign" ADD CONSTRAINT "_NonLocalSubaccountToPendingCampaign_A_fkey" FOREIGN KEY ("A") REFERENCES "app"."non_local_subaccounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_NonLocalSubaccountToPendingCampaign" ADD CONSTRAINT "_NonLocalSubaccountToPendingCampaign_B_fkey" FOREIGN KEY ("B") REFERENCES "app"."pending_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_AdvertiserTypeToVertical" ADD CONSTRAINT "_AdvertiserTypeToVertical_A_fkey" FOREIGN KEY ("A") REFERENCES "app"."advertiser_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_AdvertiserTypeToVertical" ADD CONSTRAINT "_AdvertiserTypeToVertical_B_fkey" FOREIGN KEY ("B") REFERENCES "app"."verticals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_InterestToVertical" ADD CONSTRAINT "_InterestToVertical_A_fkey" FOREIGN KEY ("A") REFERENCES "app"."interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_InterestToVertical" ADD CONSTRAINT "_InterestToVertical_B_fkey" FOREIGN KEY ("B") REFERENCES "app"."verticals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_InterestToPendingCustomer" ADD CONSTRAINT "_InterestToPendingCustomer_A_fkey" FOREIGN KEY ("A") REFERENCES "app"."interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_InterestToPendingCustomer" ADD CONSTRAINT "_InterestToPendingCustomer_B_fkey" FOREIGN KEY ("B") REFERENCES "app"."pending_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_CampaignToLocalSubaccount" ADD CONSTRAINT "_CampaignToLocalSubaccount_A_fkey" FOREIGN KEY ("A") REFERENCES "app"."campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_CampaignToLocalSubaccount" ADD CONSTRAINT "_CampaignToLocalSubaccount_B_fkey" FOREIGN KEY ("B") REFERENCES "app"."local_subaccounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_CampaignToNonLocalSubaccount" ADD CONSTRAINT "_CampaignToNonLocalSubaccount_A_fkey" FOREIGN KEY ("A") REFERENCES "app"."campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."_CampaignToNonLocalSubaccount" ADD CONSTRAINT "_CampaignToNonLocalSubaccount_B_fkey" FOREIGN KEY ("B") REFERENCES "app"."non_local_subaccounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
