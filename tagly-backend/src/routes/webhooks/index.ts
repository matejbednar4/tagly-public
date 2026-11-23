import { Router } from "express";
import instagramRouter from "./instagram.js";
import stripeRouter from "./stripe.js";

const r = Router();

r.use("/instagram", instagramRouter);
r.use("/stripe", stripeRouter);

export default r;
