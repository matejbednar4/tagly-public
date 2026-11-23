import "dotenv/config";
import { ConfigContext, ExpoConfig } from "expo/config";
import pkg from "./package.json";

type AppEnv = "development" | "staging" | "production";

function resolveAppEnv(): AppEnv {
  const allowed: AppEnv[] = ["development", "staging", "production"];

  const explicit = process.env.APP_ENV as AppEnv | undefined;
  const profile = process.env.EAS_BUILD_PROFILE;
  const buildEnv = process.env.EAS_BUILD_ENVIRONMENT;

  if (explicit) {
    if (allowed.includes(explicit)) return explicit;
    throw new Error("APP_ENV must be one of development, staging, production");
  }

  if (profile === "production") return "production";
  if (profile && profile.startsWith("staging")) return "staging";
  if (buildEnv === "production") return "production";

  return "development";
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (val) return val;

  const isGitHub = process.env.GITHUB_ACTIONS === "true";
  const isEasBuildMachine =
    !!process.env.EAS_BUILD_PLATFORM ||
    !!process.env.EAS_BUILD_PROFILE ||
    !!process.env.EAS_BUILD_ENVIRONMENT;

  if (isGitHub && !isEasBuildMachine) return `__MISSING_${name}__`;

  throw new Error(`Missing required environment variable: ${name}`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const env: AppEnv = resolveAppEnv();

  const easProjectId = "51b9b99e-1e28-4810-87ce-1d7c651717d7";

  const bundleIds = {
    development: "com.flaer.admin.dev",
    staging: "com.flaer.admin.staging",
    production: "com.flaer.admin",
  } as const;

  const schemes = {
    development: "tagly-admin-dev",
    staging: "tagly-admin-staging",
    production: "tagly-admin",
  } as const;

  const displayNames = {
    development: "(dev) Admin",
    staging: "(stg) Admin",
    production: "Tagly Admin",
  } as const;

  // CFBundleName — the full ASC/TestFlight-facing binary name; displayNames
  // is the home-screen label. Production must never be a bare generic word
  // ("Admin") — that trips Apple's delivery check ITMS-90129 ("bundle name or
  // display name already taken"), as the advertiser app's "Business" did.
  const bundleNames = {
    development: "(dev) Tagly Admin",
    staging: "(stg) Tagly Admin",
    production: "Tagly Admin",
  } as const;

  const appIcons = {
    development: "./assets/app-icon-dev.png",
    staging: "./assets/app-icon-staging.png",
    production: "./assets/app-icon.png",
  } as const;

  const cdnBaseURLs = {
    development: "https://dev.cdn.tagly.dev",
    staging: "https://staging.cdn.tagly.dev",
    production: "https://cdn.taglyapp.com",
  } as const;

  return {
    ...config,
    owner: "flaer-inc",
    name: displayNames[env],
    // KEEP-LIST: EAS slug is validated against the Expo project ID — never rename.
    slug: "flaer-admin",
    scheme: schemes[env],
    version: pkg.version,
    orientation: "portrait",
    icon: appIcons[env],
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    ios: {
      bundleIdentifier: bundleIds[env],
      appleTeamId: "S9BP8HQZ93",
      infoPlist: {
        CFBundleName: bundleNames[env],
        CFBundleDisplayName: displayNames[env],
        // Business-page create/edit picks banner + photos from the gallery
        // (shared pickMedia over react-native-image-crop-picker).
        NSPhotoLibraryUsageDescription:
          "Allow $(PRODUCT_NAME) to select and upload photos for business pages.",
        // Required by ITMS-90683 even though no flow opens the camera today:
        // react-native-image-crop-picker references camera APIs in its native
        // code, and Apple demands a purpose string for referenced APIs.
        NSCameraUsageDescription:
          "Allow $(PRODUCT_NAME) to take photos for business pages.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      // Gallery access for the business-page media picker (READ_MEDIA_IMAGES
      // is the Android 13+ scoped permission; the two legacy ones cover ≤12).
      permissions: [
        "READ_MEDIA_IMAGES",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
      ],
      package: bundleIds[env],
    },

    plugins: [
      // Compiles the PhotoLibrary permission handler pod — without this the
      // permission request reports "unavailable" and iOS never shows the
      // gallery toggle in Settings.
      [
        "react-native-permissions",
        {
          iosPermissions: ["PhotoLibrary"],
        },
      ],
      "expo-router",
      "expo-secure-store",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-logo.png",
          imageWidth: 175,
          resizeMode: "contain",
          // Accent (soft blue) from the design system — admin's counterpart to
          // the brand-butter splash on the customer/advertiser apps.
          backgroundColor: "#C1DBE8",
        },
      ],
      "expo-web-browser",
    ],

    experiments: { typedRoutes: true },

    extra: {
      eas: { projectId: easProjectId },
      APP_ENV: env,
      EXPO_PUBLIC_API_BASE_URL: requireEnv("EXPO_PUBLIC_API_BASE_URL"),
      CLOUDFORMATION_API_URL: requireEnv("CLOUDFORMATION_API_URL"),
      S3_BUCKET: requireEnv("S3_BUCKET"),
      CDN_BASE_URL: cdnBaseURLs[env],
    },
  };
};
