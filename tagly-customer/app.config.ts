import "dotenv/config";
import { ConfigContext, ExpoConfig } from "expo/config";
import {
  withAndroidManifest,
  withProjectBuildGradle,
  withAppBuildGradle,
  withGradleProperties,
  withDangerousMod,
} from "@expo/config-plugins";
import fs from "node:fs";
import path from "node:path";
import pkg from "./package.json";
import easConfig from "./eas.json";

function isGitHubActionsPreflight(): boolean {
  const isGitHub = process.env.GITHUB_ACTIONS === "true";

  // EAS build workers set EAS-specific env vars. We only want to relax on GitHub runner,
  // not on the actual EAS build machines.
  const isEasBuildMachine =
    !!process.env.EAS_BUILD_PLATFORM ||
    !!process.env.EAS_BUILD_PROFILE ||
    !!process.env.EAS_BUILD_ENVIRONMENT;

  if (isGitHub && !isEasBuildMachine) return true;
  return false;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (val) return val;

  if (isGitHubActionsPreflight()) {
    // Just enough to let `expo config` succeed on the GitHub runner.
    // The real values will be read on the EAS build machines from the EAS Environment.
    return `__MISSING_${name}__`;
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

type AppEnv = "development" | "staging" | "production";

function resolveAppEnv(): AppEnv {
  const allowed: AppEnv[] = ["development", "staging", "production"];

  const explicit = process.env.APP_ENV as AppEnv | undefined;
  const profile = process.env.EAS_BUILD_PROFILE; // e.g. "staging", "production"
  const buildEnv = process.env.EAS_BUILD_ENVIRONMENT; // "preview" | "production" | undefined

  // 1) Explicit override (useful for local dev: APP_ENV=staging expo start)
  if (explicit) {
    if (allowed.includes(explicit)) {
      return explicit;
    }
    throw new Error("APP_ENV must be one of development, staging, production");
  }

  // 2) Derive from EAS build profile
  if (profile === "production") {
    return "production";
  }

  if (profile && profile.startsWith("staging")) {
    // "staging", etc.
    return "staging";
  }

  // 3) Fallback from EAS_BUILD_ENVIRONMENT
  if (buildEnv === "production") {
    return "production";
  }

  // 4) Default for everything else (expo start / expo run locally)
  return "development";
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const env: AppEnv = resolveAppEnv();

  const googleMapsApiKey = requireEnv("GOOGLE_MAPS_API_KEY");
  const appsflyerDevKey = requireEnv("APPSFLYER_DEV_KEY");
  const posthogApiKey = requireEnv("POSTHOG_API_KEY");
  const posthogHost = requireEnv("POSTHOG_HOST");
  // Google OAuth client IDs (per env, from the EAS environment). The web client
  // ID is the ID token's audience (must match the backend GOOGLE_OAUTH_CLIENT_IDS);
  // the iOS client ID drives the native flow + its reversed-client-id URL scheme.
  const googleIosClientId = requireEnv("GOOGLE_IOS_CLIENT_ID");
  const googleWebClientId = requireEnv("GOOGLE_WEB_CLIENT_ID");
  const googleIosUrlScheme =
    "com.googleusercontent.apps." +
    googleIosClientId.replace(/\.apps\.googleusercontent\.com$/, "");

  const easProjectId = "78900840-4d40-41fd-8fca-d00d529dcd67";

  const bundleIds = {
    development: "com.flaer.customer.dev",
    staging: "com.flaer.customer.staging",
    production: "com.flaer.customer",
  } as const;

  // tagly:// only — v2 never registers the legacy flaer:// scheme. The
  // redirect page bounces every host (tagly + legacy flaer.app) into these
  // tagly-* schemes (see tagly-redirect/index.html).
  const schemes = {
    development: "tagly-dev",
    staging: "tagly-staging",
    production: "tagly",
  } as const;

  const displayNames = {
    development: "(dev) Tagly",
    staging: "(stg) Tagly",
    production: "Tagly",
  } as const;

  // CFBundleName — the full ASC/TestFlight-facing binary name (matches the
  // ASC listing name); displayNames is the home-screen label. Production must
  // never be a bare generic word — that trips Apple's delivery check
  // ITMS-90129 ("bundle name or display name already taken"), as the
  // advertiser app's "Business" did.
  const bundleNames = {
    development: "(dev) Tagly: Share and Earn",
    staging: "(stg) Tagly: Share and Earn",
    production: "Tagly: Share and Earn",
  } as const;

  const appIcons = {
    development: "./assets/app-icon-dev.png",
    staging: "./assets/app-icon-staging.png",
    production: "./assets/app-icon.png",
  } as const;

  // Tagly hosts (prod on taglyapp.com, non-prod on tagly.dev). The flaer.app
  // twins stay live and serve the same distributions, so old builds keep
  // working; new builds use tagly as primary.
  const cdnBaseURLs = {
    development: "https://dev.cdn.tagly.dev",
    staging: "https://staging.cdn.tagly.dev",
    production: "https://cdn.taglyapp.com",
  } as const;

  // Instagram OAuth. ⚠️ These URIs must be registered in the Meta app
  // dashboard (alongside the legacy flaer.app URIs — Meta allows multiple)
  // BEFORE a build using them ships. Must match the backend's
  // CUSTOMER_APP_INSTAGRAM_OAUTH_REDIRECT_URI stage values.
  const instagramRedirectURIs = {
    development: `https://dev.redirect.tagly.dev/customer/instagram/oauth`,
    staging: `https://staging.redirect.tagly.dev/customer/instagram/oauth`,
    production: `https://redirect.taglyapp.com/customer/instagram/oauth`,
  } as const;

  // Stripe Connect onboarding return target — must match the backend v2's
  // CUSTOMER_APP_WITHDRAW_RETURN_URI. The `/customer/withdraw` path makes the
  // redirect page bounce to `tagly://withdraw`, landing back on the withdraw
  // screen; also passed as the returnUrl to WebBrowser.openAuthSessionAsync so
  // the in-app browser dismisses when Stripe redirects back after onboarding.
  const stripeConnectReturnURIs = {
    development: `https://dev.redirect.tagly.dev/customer/withdraw`,
    staging: `https://staging.redirect.tagly.dev/customer/withdraw`,
    production: `https://redirect.taglyapp.com/customer/withdraw`,
  } as const;

  const appleAppIds: Record<AppEnv, string | undefined> = {
    development: easConfig.submit.staging.ios.ascAppId, // reuse the staging app id so it's not empty
    staging: easConfig.submit.staging.ios.ascAppId,
    production: easConfig.submit.production.ios.ascAppId,
  };

  const iosAppIdWithPrefix = appleAppIds[env]
    ? `id${appleAppIds[env]}`
    : undefined;

  // IMPORTANT:
  // Each build should ONLY claim the Universal Link domains that belong to that env.
  // If both apps claim staging + prod domains, iOS can open the "wrong" app.
  // `webcredentials:` is required for ASWebAuthenticationSession HTTPS callbacks
  // (Instagram OAuth) — without it iOS 17.4+ can refuse to open the auth sheet.
  // The redirect host's AASA must list the app under "webcredentials" too.
  // Tagly hosts only — v2 associates no flaer.app domains. Universal links
  // never worked on the flaer hosts (their AASA was never deployed), so old
  // flaer links keep resolving exactly as they always did: in the browser
  // (join page / AppsFlyer bounce). The join domains are associated
  // (production: join.taglyapp.com + join.tagly.cz — the printed
  // table-sticker domain) so a sticker scan opens the app directly when
  // installed, with the sticker id delivered as a universal link.
  const iosAssociatedDomainsByEnv: Record<AppEnv, string[]> = {
    development: [
      "applinks:dev.redirect.tagly.dev",
      "webcredentials:dev.redirect.tagly.dev",
    ],
    staging: [
      "applinks:staging.redirect.tagly.dev",
      "applinks:staging.join.tagly.dev",
      "applinks:staging-tagly.onelink.me",
      "webcredentials:staging.redirect.tagly.dev",
    ],
    production: [
      "applinks:redirect.taglyapp.com",
      "applinks:join.taglyapp.com",
      "applinks:join.tagly.cz",
      "applinks:tagly.onelink.me",
      "webcredentials:redirect.taglyapp.com",
    ],
  };

  const redirectHostByEnv: Record<AppEnv, string> = {
    development: "dev.redirect.tagly.dev",
    staging: "staging.redirect.tagly.dev",
    production: "redirect.taglyapp.com",
  };

  // Join-page hosts a sticker/referral link may use (Android App Links).
  const joinHostsByEnv: Record<AppEnv, string[]> = {
    development: [],
    staging: ["staging.join.tagly.dev"],
    production: ["join.taglyapp.com", "join.tagly.cz"],
  };

  const oneLinkHostsByEnv: Record<AppEnv, string[]> = {
    development: [],
    staging: ["staging-tagly.onelink.me"],
    production: ["tagly.onelink.me"],
  };

  const androidIntentFilters = (() => {
    const oneLinkHosts = oneLinkHostsByEnv[env];

    const filters: any[] = [
      {
        action: "VIEW",
        data: [
          {
            scheme: "https",
            host: redirectHostByEnv[env],
            pathPrefix: "/customer/",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ];

    // Join-page hosts (sticker QR scans + referral links) open the app
    // directly when installed; assetlinks.json on those hosts verifies it.
    for (const joinHost of joinHostsByEnv[env]) {
      filters.push({
        action: "VIEW",
        autoVerify: true,
        category: ["BROWSABLE", "DEFAULT"],
        data: [{ scheme: "https", host: joinHost }],
      });
    }

    for (const oneLinkHost of oneLinkHosts) {
      filters.push({
        action: "VIEW",
        autoVerify: true,
        category: ["BROWSABLE", "DEFAULT"],
        data: [{ scheme: "https", host: oneLinkHost }],
      });
    }

    return filters;
  })();

  const appConfig: ExpoConfig = {
    ...config,
    owner: "flaer-inc",
    name: displayNames[env],
    // KEEP-LIST: EAS slug is validated against the Expo project ID — never rename.
    slug: "flaer-customer",
    scheme: schemes[env],
    version: pkg.version,
    orientation: "portrait",
    icon: appIcons[env],
    // Force light mode everywhere — dark mode is not supported, so native
    // surfaces must not follow the system theme.
    userInterfaceStyle: "light",
    newArchEnabled: true,

    ios: {
      bundleIdentifier: bundleIds[env],
      appleTeamId: "S9BP8HQZ93",
      usesAppleSignIn: true,
      associatedDomains: iosAssociatedDomainsByEnv[env],
      infoPlist: {
        CFBundleName: bundleNames[env],
        CFBundleDisplayName: displayNames[env],
        CFBundleLocalizations: ["en", "cs"],
        NSUserNotificationsUsageDescription:
          "Allow $(PRODUCT_NAME) to send you notifications about rewards and shares",
        // Required by ITMS-90683: react-native-image-crop-picker is linked via
        // the shared @tagly/client barrel (pickMedia) even though no customer
        // flow opens the camera — Apple's binary scan rejects builds whose
        // native code references camera APIs without this string.
        NSCameraUsageDescription:
          "Allow $(PRODUCT_NAME) to use the camera to add photos.",
        NSPhotoLibraryUsageDescription:
          "Allow $(PRODUCT_NAME) to select and upload photos for your account.",
        NSLocationWhenInUseUsageDescription:
          "$(PRODUCT_NAME) needs your location to recommend nearby businesses.",
        UIBackgroundModes: ["remote-notification"],
        // `instagram*` for the IG hand-off; the map schemes let
        // Linking.canOpenURL detect which navigation apps are installed (the
        // business-detail "Get directions" chooser only offers installed ones).
        LSApplicationQueriesSchemes: [
          "instagram",
          "instagram-stories",
          "maps",
          "comgooglemaps",
          "waze",
        ],
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      // Staging/production: the EAS GOOGLE_SERVICES_JSON file env var is the
      // ONLY source — no filesystem fallback, so the config can never silently
      // pick up a stray local file. On EAS builders the var is always set; when
      // invoking `eas build` yourself, CI (eas-start-build.sh) pulls the var
      // and exports it first — do the same for a laptop Android build, or the
      // fingerprint runtime version check fails in CONFIGURE_EXPO_UPDATES
      // (the file's bytes are part of the Android fingerprint).
      // Dev keeps the local multi-client ./google-services.json (gitignored).
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ??
        (env === "development" ? "./google-services.json" : undefined),
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "VIBRATE",
        "RECEIVE_BOOT_COMPLETED",
        "POST_NOTIFICATIONS",
      ],
      // expo-audio declares FOREGROUND_SERVICE_MEDIA_PLAYBACK in its own
      // manifest, but its AudioControlsService/AudioRecordingService are
      // stripped below (tools:node="remove") because we only ever call
      // setAudioModeAsync — no background playback, no recording. That left a
      // permission with no service that could use it, which trips Play
      // Console's overdue "Foreground service permissions" declaration (the
      // only honest answer there is "remove it", since we perform none of the
      // listed tasks). Block the permission so it never reaches the merged
      // manifest. Verify after a build:
      //   grep -o 'FOREGROUND_SERVICE[A-Z_]*' <merged AndroidManifest.xml>
      //
      // READ_MEDIA_IMAGES/VIDEO are blocked per Google Play's photo/video
      // permissions policy (advertiser rejection 2026-08-11; the customer app
      // carried the same permission and would be next): picking goes through
      // the system Photo Picker (expo-image-picker, permissionless) — see
      // tagly-shared/client/services/media/pickMedia.ts. The block strips
      // whatever react-native-image-crop-picker's manifest merges in. Do not
      // re-add these permissions; Play rejects them for one-time media access.
      blockedPermissions: [
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
      ],
      package: bundleIds[env],
      intentFilters: androidIntentFilters,
    },

    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-localization",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-logo.png",
          imageWidth: 175,
          resizeMode: "contain",
          backgroundColor: "#FFF3B0",
        },
      ],
      "expo-web-browser",
      [
        "@react-native-google-signin/google-signin",
        { iosUrlScheme: googleIosUrlScheme },
      ],
      [
        "expo-notifications",
        {
          icon: appIcons[env],
          color: "#ffffff",
          androidMode: "default",
        },
      ],
      [
        "react-native-appsflyer",
        {
          devKey: appsflyerDevKey,
          appId: iosAppIdWithPrefix,
          isDebug: env !== "production",
          onInstallConversionDataListener: true,
          onDeepLinkListener: true,
        },
      ],
    ],

    experiments: { typedRoutes: true },

    extra: {
      eas: { projectId: easProjectId },
      APPSFLYER_DEV_KEY: appsflyerDevKey,
      POSTHOG_API_KEY: posthogApiKey,
      POSTHOG_HOST: posthogHost,
      APPLE_APP_ID: appleAppIds[env],
      APP_ENV: env,
      CDN_BASE_URL: cdnBaseURLs[env],
      EXPO_PUBLIC_API_BASE_URL: requireEnv("EXPO_PUBLIC_API_BASE_URL"),
      IG_CLIENT_ID: requireEnv("IG_CLIENT_ID"),
      GOOGLE_IOS_CLIENT_ID: googleIosClientId,
      GOOGLE_WEB_CLIENT_ID: googleWebClientId,
      CLOUDFORMATION_API_URL: requireEnv("CLOUDFORMATION_API_URL"),
      S3_BUCKET: requireEnv("S3_BUCKET"),
      AUTH_REDIRECT_URI: instagramRedirectURIs[env],
      STRIPE_CONNECT_RETURN_URI: stripeConnectReturnURIs[env],
      APP_STORE_URL: `itms-apps://apps.apple.com/app/id${appleAppIds[env]}`,
      PLAY_STORE_URL: `market://details?id=${bundleIds[env]}`,
    },

    updates: { url: `https://u.expo.dev/${easProjectId}` },
    // Fingerprint policy: EAS hashes the whole native project (deps, plugins,
    // entitlements, schemes, icons, Info.plist) and derives runtimeVersion from
    // it. Any native change therefore mints a NEW runtime version automatically,
    // so an OTA update can only ever land on a binary that can actually run it.
    //
    // Replaced `pkg.version`, which was pinned at "2.0.0" from the v2 namespace
    // commit onward — every binary built anywhere in that long window kept
    // accepting new JS, so a device could run current JS on a weeks-old native
    // shell with no visible signal (2026-08-04: chasing a stale notification
    // icon, "which build is this?" was genuinely unanswerable from the app).
    //
    // Consequence to know: a native change now splits the update channel. Old
    // binaries stop receiving updates and must be rebuilt — that is the point,
    // but it means "push an OTA fix" is not available for native-affecting work.
    runtimeVersion: { policy: "fingerprint" },
  };

  // AppsFlyer's SDK declares its own fullBackupContent and dataExtractionRules
  // which conflict with expo-secure-store's. This tells the manifest merger
  // to use our values instead.
  //
  // Also adds <queries> so Linking.canOpenURL works on Android 11+ (without this
  // it always returns false): Instagram for the IG hand-off, and the navigation
  // apps for the business-detail "Get directions" chooser (only installed ones
  // are offered).
  let cfg = withAndroidManifest(appConfig, (c) => {
    c.modResults.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    // Ensure these packages can be queried via Linking.canOpenURL on Android 11+
    const queries = c.modResults.manifest.queries ?? [];
    for (const pkg of [
      "com.instagram.android",
      "com.google.android.apps.maps",
      "com.waze",
    ]) {
      const present = queries.some((q: any) =>
        q.package?.some((p: any) => p.$?.["android:name"] === pkg),
      );
      if (!present) {
        queries.push({ package: [{ $: { "android:name": pkg } }] });
      }
    }
    c.modResults.manifest.queries = queries;

    const app = c.modResults.manifest.application?.[0];
    if (app?.$) {
      app.$["tools:replace"] =
        "android:fullBackupContent,android:dataExtractionRules";
    }

    // Make keyboard push content up instead of overlapping it
    const activity = app?.activity?.find(
      (a: any) => a.$?.["android:name"] === ".MainActivity",
    );
    if (activity?.$) {
      activity.$["android:windowSoftInputMode"] = "adjustResize";
    }

    // Android 15+ (API 35) forbids BOOT_COMPLETED receivers from starting restricted
    // foreground service types. expo-audio ships two such services —
    // AudioControlsService (mediaPlayback) and AudioRecordingService (microphone) —
    // wired to a media3 boot-resumption path. We only use setAudioModeAsync (no
    // background playback, no recording), so these services are dead weight and trip
    // Play Console's "restricted foreground service types" check. Strip them from the
    // merged manifest via tools:node="remove".
    if (app) {
      const services = app.service ?? [];
      for (const name of [
        "expo.modules.audio.service.AudioControlsService",
        "expo.modules.audio.service.AudioRecordingService",
      ]) {
        if (!services.some((s: any) => s.$?.["android:name"] === name)) {
          services.push({
            $: { "android:name": name, "tools:node": "remove" },
          });
        }
      }
      app.service = services;
    }

    return c;
  });

  // Add the Google Services Gradle plugin required by expo-notifications / Firebase.
  // expo-notifications adds this on a fresh prebuild, but if android/ already existed
  // when the plugin was added it gets skipped — this ensures it's always present.
  cfg = withProjectBuildGradle(cfg, (c) => {
    if (!c.modResults.contents.includes("com.google.gms:google-services")) {
      c.modResults.contents = c.modResults.contents.replace(
        "classpath('com.facebook.react:react-native-gradle-plugin')",
        "classpath('com.facebook.react:react-native-gradle-plugin')\n    classpath('com.google.gms:google-services:4.4.2')",
      );
    }
    return c;
  });

  cfg = withAppBuildGradle(cfg, (c) => {
    if (!c.modResults.contents.includes("com.google.gms.google-services")) {
      c.modResults.contents +=
        '\napply plugin: "com.google.gms.google-services"\n';
    }
    return c;
  });

  // Persist Gradle JVM memory and architecture settings so they survive prebuild.
  // arm64-v8a only for local dev (faster builds); EAS builds need all architectures.
  cfg = withGradleProperties(cfg, (c) => {
    const isEasBuild = !!process.env.EAS_BUILD_PLATFORM;

    const set = (key: string, value: string) => {
      const existing = c.modResults.find(
        (p) => p.type === "property" && p.key === key,
      );
      if (existing && existing.type === "property") {
        existing.value = value;
      } else {
        c.modResults.push({ type: "property", key, value });
      }
    };

    set("org.gradle.jvmargs", "-Xmx4096m -XX:MaxMetaspaceSize=1024m");
    if (!isEasBuild) {
      set("reactNativeArchitectures", "arm64-v8a");
    }

    return c;
  });

  // react-native-google-signin pulls GoogleSignIn → AppCheckCore (a Swift pod),
  // which can't integrate as a static library unless its deps GoogleUtilities +
  // RecaptchaInterop expose module maps. Declare those two with modular headers
  // so `pod install` succeeds. (Targeted rather than a global use_modular_headers!
  // to avoid disturbing the rest of the pods.)
  cfg = withDangerousMod(cfg, [
    "ios",
    (c) => {
      const podfile = path.join(c.modRequest.platformProjectRoot, "Podfile");
      const contents = fs.readFileSync(podfile, "utf8");
      if (!contents.includes("RecaptchaInterop', :modular_headers")) {
        fs.writeFileSync(
          podfile,
          contents.replace(
            /(target ['"][^'"]+['"] do\n)/,
            "$1  pod 'GoogleUtilities', :modular_headers => true\n  pod 'RecaptchaInterop', :modular_headers => true\n",
          ),
        );
      }
      return c;
    },
  ]);

  return cfg;
};
