#!/usr/bin/env bash
# Queue an EAS build WITHOUT waiting for it, and export its build id to
# GITHUB_ENV so a later step can wait on / download exactly this build.
# With "auto_submit", EAS submits the finished build server-side using the
# submit profile with the same name as the build profile — the runner never
# runs `eas submit` for it.
#
# For Android builds this script first pulls the EAS GOOGLE_SERVICES_JSON file
# env var (sensitive visibility) via `eas env:pull` and EXPORTS it for the
# `eas build` invocation — the app config has no filesystem fallback outside
# dev, so the env var is the only source. The fingerprint runtime version
# policy hashes that file's CONTENT on both the runner and the EAS builder —
# if the runner can't resolve it (or resolves different bytes), the build
# fails in CONFIGURE_EXPO_UPDATES with "Runtime version calculated on local
# machine not equal ...".
#
# Usage: eas-start-build.sh <project-dir> <platform> <profile> <env-var-name> [auto_submit]
set -euo pipefail

PROJECT_DIR="$1"
PLATFORM="$2"
PROFILE="$3"
ENV_VAR_NAME="$4"
AUTO_SUBMIT="${5:-}"

cd "$PROJECT_DIR"

# Resolve a key from the eas.json build profile, following "extends"
# (staging-android extends staging).
resolve_profile_key() {
  local p="$1" jq_path="$2" v
  for _ in 1 2 3; do
    v=$(jq -r --arg p "$p" ".build[\$p]${jq_path} // empty" eas.json)
    if [ -n "$v" ]; then echo "$v"; return 0; fi
    p=$(jq -r --arg p "$p" '.build[$p].extends // empty' eas.json)
    if [ -z "$p" ]; then return 0; fi
  done
}

if [ "$PLATFORM" = "android" ]; then
  EAS_ENVIRONMENT=$(resolve_profile_key "$PROFILE" ".environment")
  if [ -z "$EAS_ENVIRONMENT" ]; then
    echo "eas-start-build: cannot resolve environment for profile $PROFILE" >&2
    exit 1
  fi

  # env:pull writes name=path pairs to .env.local and file-type variables to
  # .eas/.env/<NAME>. It prints variable names only, never values.
  rm -f .env.local
  npx eas-cli env:pull "$EAS_ENVIRONMENT" --non-interactive
  rm -f .env.local

  if [ ! -f .eas/.env/GOOGLE_SERVICES_JSON ]; then
    echo "eas-start-build: no GOOGLE_SERVICES_JSON file variable in the '$EAS_ENVIRONMENT' environment — an Android fingerprint build would mismatch, refusing to queue" >&2
    exit 1
  fi

  SIZE=$(wc -c < .eas/.env/GOOGLE_SERVICES_JSON | tr -d ' ')
  if [ "$SIZE" -lt 1000 ]; then
    echo "eas-start-build: pulled GOOGLE_SERVICES_JSON is only $SIZE bytes — not a real google-services file" >&2
    exit 1
  fi
  export GOOGLE_SERVICES_JSON="$PWD/.eas/.env/GOOGLE_SERVICES_JSON"
  echo "Pulled GOOGLE_SERVICES_JSON ($SIZE bytes) and exported it for the build"
fi

ARGS=(build -p "$PLATFORM" --profile "$PROFILE" --non-interactive --no-wait --json)
if [ "$AUTO_SUBMIT" = "auto_submit" ]; then
  ARGS+=(--auto-submit)
fi

OUTPUT=$(npx eas-cli "${ARGS[@]}")
rm -rf .eas/.env

BUILD_ID=$(echo "$OUTPUT" | jq -r 'if type == "array" then .[0].id else .id end')
if [ -z "$BUILD_ID" ] || [ "$BUILD_ID" = "null" ]; then
  echo "eas-start-build: could not extract a build id from eas-cli output:" >&2
  echo "$OUTPUT" >&2
  exit 1
fi

echo "Queued $PLATFORM build $BUILD_ID ($PROJECT_DIR, profile $PROFILE${AUTO_SUBMIT:+, auto-submit})"
echo "$ENV_VAR_NAME=$BUILD_ID" >> "$GITHUB_ENV"
