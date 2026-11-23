import React from "react";

/** One provider in the stack: the component, plus any props it needs. */
type ProviderEntry = {
  provider: React.ComponentType<any>;
  props?: Record<string, unknown>;
};

/**
 * Compose many context providers into a single wrapper, flattening the deeply
 * nested "provider pyramid" in app root layouts into a flat, reorderable list.
 *
 * Entries are outermost-first — the first entry wraps everything below it.
 *
 *   const AppProviders = composeProviders([
 *     { provider: PostHogProvider, props: { apiKey } },
 *     { provider: SafeAreaProvider, props: { initialMetrics } },
 *     { provider: ThemeProvider },
 *     { provider: QueryClientProvider, props: { client } },
 *   ]);
 *
 *   <AppProviders>{appContent}</AppProviders>
 */
export function composeProviders(providers: ProviderEntry[]) {
  return function ComposedProviders({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return providers.reduceRight<React.ReactNode>(
      (acc, { provider: Provider, props }) => (
        <Provider {...(props ?? {})}>{acc}</Provider>
      ),
      children,
    );
  };
}
