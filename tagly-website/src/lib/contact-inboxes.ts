// The /contact form's category → inbox map, shared by the client form (to
// display the matching direct email) and /api/support (to pick the delivery
// inbox SERVER-SIDE — the client never supplies a target address).
export const CONTACT_INBOXES = {
  support: "support@taglyapp.com",
  feedback: "feedback@taglyapp.com",
  other: "hello@taglyapp.com",
} as const;

// The `From` identity on both website forms (/api/contact + /api/support).
//
// It MUST stay on the `mail.taglyapp.com` sending subdomain, not the apex.
// Resend only sends from domains verified in its dashboard, and the apex
// `taglyapp.com` carries Zoho's records only (no Resend DKIM, no
// `send.taglyapp.com` return-path), so an apex sender makes Resend reject the
// send and both forms 500. `mail.taglyapp.com` is verified and registered as an
// Apple private-relay email source. See tagly-website/COPY-AUDIT.md #60.
export const WEBSITE_FROM_EMAIL = "Tagly Website <noreply@mail.taglyapp.com>";

export type ContactCategory = keyof typeof CONTACT_INBOXES;

export const CONTACT_CATEGORIES = Object.keys(
  CONTACT_INBOXES,
) as ContactCategory[];
