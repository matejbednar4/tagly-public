const normalize = (url: string) => url.replace(/\/+$/, "");

function getBackendUrl(): string {
  const value =
    (process.env.NEXT_PUBLIC_API_BASE_URL as string | undefined) ??
    (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined);

  if (!value) {
    throw new Error(
      "API base URL not configured. Set NEXT_PUBLIC_API_BASE_URL (web) or EXPO_PUBLIC_API_BASE_URL (expo)."
    );
  }

  return normalize(value);
}

export const backendUrl = getBackendUrl();
