import { Prisma } from "../../../../generated/prisma/client.js";

export const addressWithIdSelect = {
  id: true,
  city: true,
  country: true,
  region: true,
  street: true,
  zip: true,
} satisfies Prisma.AddressSelect;
