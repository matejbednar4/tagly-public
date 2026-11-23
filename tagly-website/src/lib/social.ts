// One official set of handles for both locales (the flaer.app / flaer.cz
// accounts were replaced by the tagly accounts, 2026-08-13).
const social = {
  instagram: "https://www.instagram.com/tagly_cz",
  tiktok: "https://www.tiktok.com/@tagly.cz",
  linkedin: "https://www.linkedin.com/company/taglyapp",
};

export function getSocialLinks(_lng: string) {
  return social;
}

// Every official account, for the Organization JSON-LD sameAs list.
export const allSocialProfiles = [
  social.instagram,
  social.linkedin,
  social.tiktok,
];
