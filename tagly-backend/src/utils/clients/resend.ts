import { Resend } from "resend";
import { envVariables } from "../../environment/envVariables.js";

export const resendClient = new Resend(envVariables.RESEND_API_KEY);
