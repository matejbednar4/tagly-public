#!/usr/bin/env bash
# Wait for an EAS build to reach a terminal state; fail unless it FINISHED.
# When an artifact output path is given, also download the build artifact and
# assert it is a real binary (non-trivial size), never just a 200 status.
#
# Usage: eas-wait-build.sh <project-dir> <build-id> [artifact-output-path]
set -euo pipefail

PROJECT_DIR="$1"
BUILD_ID="${2:-}"
ARTIFACT_OUT="${3:-}"

if [ -z "$BUILD_ID" ] || [ "$BUILD_ID" = "null" ]; then
  echo "eas-wait-build: missing build id (was the matching start step skipped?)" >&2
  exit 1
fi

ROOT_DIR="$(pwd)"
cd "$PROJECT_DIR"

# Generous ceiling: covers EAS queue time on top of the build itself.
DEADLINE=$(( $(date +%s) + 120 * 60 ))

while true; do
  # build:view supports only --json; non-JSON noise goes to stderr.
  BUILD_JSON=$(npx eas-cli build:view "$BUILD_ID" --json)
  STATUS=$(echo "$BUILD_JSON" | jq -r '.status')
  case "$STATUS" in
    FINISHED)
      break
      ;;
    ERRORED|CANCELED|PENDING_CANCEL)
      echo "Build $BUILD_ID ended with status $STATUS" >&2
      exit 1
      ;;
    NEW|IN_QUEUE|IN_PROGRESS)
      if [ "$(date +%s)" -ge "$DEADLINE" ]; then
        echo "Build $BUILD_ID still $STATUS after 120 minutes, giving up" >&2
        exit 1
      fi
      echo "Build $BUILD_ID: $STATUS"
      sleep 60
      ;;
    *)
      echo "Build $BUILD_ID: unexpected status '$STATUS'" >&2
      exit 1
      ;;
  esac
done

echo "Build $BUILD_ID finished"

if [ -n "$ARTIFACT_OUT" ]; then
  BUILD_URL=$(echo "$BUILD_JSON" | jq -r '.artifacts.buildUrl')
  if [ -z "$BUILD_URL" ] || [ "$BUILD_URL" = "null" ]; then
    echo "Build $BUILD_ID finished but exposes no artifacts.buildUrl" >&2
    exit 1
  fi
  curl -fsSL "$BUILD_URL" -o "$ROOT_DIR/$ARTIFACT_OUT"
  SIZE=$(wc -c < "$ROOT_DIR/$ARTIFACT_OUT" | tr -d ' ')
  if [ "$SIZE" -lt 5000000 ]; then
    echo "Downloaded artifact is only $SIZE bytes — not a real app binary" >&2
    exit 1
  fi
  echo "Downloaded $ARTIFACT_OUT ($SIZE bytes)"
fi
