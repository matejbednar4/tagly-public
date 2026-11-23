import { z } from "zod";

export const PasswordSchema = z
  .string()
  .min(8)
  .regex(
    /^[^\s<>"'`]+$/,
    "Password cannot contain spaces or the characters < > \" ' `"
  );
