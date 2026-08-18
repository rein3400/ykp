"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export interface QueryProviderProps {
  children: React.ReactNode;
  /** Override default staleTime (default 30s) if your app needs fresher data. */
  staleTime?: number;
}

/**
 * TanStack Query provider with sensible defaults for ERP dashboards.
 * One client is created per browser session; refetch on window focus is
 * disabled so background polling doesn't interrupt data entry forms.
 */
export function QueryProvider({ children, staleTime = 30_000 }: QueryProviderProps) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}