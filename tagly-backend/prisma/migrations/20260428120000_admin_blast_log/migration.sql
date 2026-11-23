CREATE TABLE "app"."admin_blast_logs" (
    "id"              SERIAL PRIMARY KEY,
    "uid"             TEXT NOT NULL,
    "admin_id"        INTEGER NOT NULL,
    "targets"         TEXT[] NOT NULL,
    "channels"        TEXT[] NOT NULL,
    "push_title"      TEXT,
    "push_body"       TEXT,
    "email_subject"   TEXT,
    "email_body"      TEXT,
    "email_title"     TEXT,
    "email_preheader" TEXT,
    "cta_label"       TEXT,
    "cta_url"         TEXT,
    "queued_count"    INTEGER NOT NULL,
    "dedupe_key"      TEXT NOT NULL,
    "sent_at"         TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_blast_logs_uid_key"       UNIQUE ("uid"),
    CONSTRAINT "admin_blast_logs_dedupe_key_key" UNIQUE ("dedupe_key"),
    CONSTRAINT "admin_blast_logs_admin_id_fkey"  FOREIGN KEY ("admin_id")
        REFERENCES "app"."admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
