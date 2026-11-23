import { CUSTOMER_ONELINK, ADVERTISER_ONELINK } from "./constants/links";

type LinkEnv = "production" | "staging";

function getLinkEnv(): LinkEnv {
  // APP_ENV is validated at build time in next.config.ts
  return process.env.APP_ENV === "staging" ? "staging" : "production";
}

function buildOneLinkUrl(
  base: string,
  code: string | null,
  stickerId: string | null,
): string {
  let url: string;
  if (!code) {
    url = `${base}?af_force_deeplink=true`;
  } else {
    const encoded = encodeURIComponent(code);
    url = `${base}?deep_link_value=${encoded}&code=${encoded}&af_force_deeplink=true`;
  }
  if (stickerId) {
    // QR-sticker attribution: deep_link_sub1 rides the OneLink deep-link
    // payload into the app; sticker_id is readable by AppsFlyer reporting.
    const encodedId = encodeURIComponent(stickerId);
    url += `&deep_link_sub1=${encodedId}&sticker_id=${encodedId}`;
  }
  return url;
}

export function buildJoinUrls(
  referralCode: string | null,
  stickerId: string | null = null,
) {
  const env = getLinkEnv();

  return {
    customer: buildOneLinkUrl(CUSTOMER_ONELINK[env], referralCode, stickerId),
    advertiser: buildOneLinkUrl(
      ADVERTISER_ONELINK[env],
      referralCode,
      stickerId,
    ),
  };
}
