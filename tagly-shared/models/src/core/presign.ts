import { z } from "zod";

const PresignedPostFieldsSchema = z.record(z.string(), z.string());

export const PresignedUploadSchema = z.object({
  pendingMediaId: z.number(),
  key: z.string(),
  url: z.url(),
  fields: PresignedPostFieldsSchema,
  maxBytes: z.number().int().positive(),
  slot: z.string().optional(),
});

export type PresignedUpload = z.infer<typeof PresignedUploadSchema>;
