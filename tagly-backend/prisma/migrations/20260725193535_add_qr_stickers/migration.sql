-- CreateTable
CREATE TABLE "app"."qr_stickers" (
    "id" SERIAL NOT NULL,
    "sticker_id" TEXT NOT NULL,
    "local_id" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "qr_stickers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qr_stickers_sticker_id_key" ON "app"."qr_stickers"("sticker_id");

-- CreateIndex
CREATE INDEX "qr_stickers_local_id_idx" ON "app"."qr_stickers"("local_id");

-- AddForeignKey
ALTER TABLE "app"."qr_stickers" ADD CONSTRAINT "qr_stickers_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "app"."local_subaccounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
