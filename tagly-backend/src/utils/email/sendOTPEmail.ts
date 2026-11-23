import { sendEmail } from "./sendEmail.js";
import type { EmailTemplate } from "../../constants/catalogs/notifications/notificationTypes.js";
import type { SupportedLanguage } from "@tagly/models/shared";

// Bilingual OTP email template. Inlined here because this is its only consumer
// (the OTP email is sent synchronously from the auth controllers, not via the
// notification queue). If more synchronously-sent one-off emails appear later,
// extract a shared `{ en, cs }` catalog keyed by identifier.
const OTP_EMAIL: Record<SupportedLanguage, EmailTemplate> = {
  en: {
    subject: (otp: string) => `${otp} is your new Tagly verification code`,
    preheader: () => "Enter this code in the app to finish verification.",
    title: (otp: string) => `Your new verification code is ${otp}`,
    html: (otp: string) =>
      [
        "<p>Hi, this is your new verification code:</p>",
        `<p><strong>${otp}</strong></p>`,
        "<p>This code will expire soon. If you didn't request it, you can safely ignore this email.</p>",
      ].join(""),
  },
  cs: {
    subject: (otp: string) => `${otp} je tvůj nový ověřovací kód Tagly`,
    preheader: () => "Zadej tento kód v aplikaci pro dokončení ověření.",
    title: (otp: string) => `Tvůj nový ověřovací kód je ${otp}`,
    html: (otp: string) =>
      [
        "<p>Ahoj, toto je tvůj nový ověřovací kód:</p>",
        `<p><strong>${otp}</strong></p>`,
        "<p>Tento kód brzy vyprší. Pokud jsi o něj nepožádal/a, můžeš tento e-mail klidně ignorovat.</p>",
      ].join(""),
  },
};

export const sendOTPEmail = async (
  email: string,
  otp: string,
  lang: SupportedLanguage,
) => {
  const tpl = OTP_EMAIL[lang] ?? OTP_EMAIL.en;

  const subject =
    typeof tpl.subject === "function" ? tpl.subject(otp) : tpl.subject;
  const preheader = tpl.preheader?.(otp);
  const title = tpl.title?.(otp);
  const bodyHtml = tpl.html(otp);

  await sendEmail({ target: email, subject, bodyHtml, preheader, title, lang });
};
