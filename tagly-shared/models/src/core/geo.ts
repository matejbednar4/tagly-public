import { z } from "zod";

/** Minimal normalized geolocation shape (WGS84). */
export const LocationSchema = z.object({
  lon: z.number().gte(-180).lte(180),
  lat: z.number().gte(-90).lte(90),
});
export type Location = z.infer<typeof LocationSchema>;

export const AddressSchema = z.object({
  country: z.string().min(2),
  city: z.string().min(1),
  region: z.string().nullable(),
  zip: z.string().min(1),
  street: z.string().min(1),
});
export type Address = z.infer<typeof AddressSchema>;

/** Some rows may have both address + exact coordinates */
export const GeoAddressSchema = AddressSchema.extend({
  location: LocationSchema,
});
export type GeoAddress = z.infer<typeof GeoAddressSchema>;

/** Preview = only city, street, and location */
export const GeoAddressPreviewSchema = z.object({
  city: z.string().min(1),
  street: z.string().min(1),
  location: LocationSchema,
});
export type GeoAddressPreview = z.infer<typeof GeoAddressPreviewSchema>;
