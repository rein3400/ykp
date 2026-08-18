/**
 * TanStack Query options + key factories for Hermez client data.
 */
import { queryOptions } from "@tanstack/react-query";
import { fetchBrief, fetchAlerts, fetchConfig, type AlertFilters } from "./service";

export const hermezKeys = {
  all: ["hermez"] as const,
  brief: (date?: string) => [...hermezKeys.all, "brief", date ?? "latest"] as const,
  alerts: (filters: AlertFilters) => [...hermezKeys.all, "alerts", filters] as const,
  config: () => [...hermezKeys.all, "config"] as const,
};

export const briefQueryOptions = (date?: string) =>
  queryOptions({
    queryKey: hermezKeys.brief(date),
    queryFn: () => fetchBrief(date),
  });

export const alertsQueryOptions = (filters: AlertFilters = {}) =>
  queryOptions({
    queryKey: hermezKeys.alerts(filters),
    queryFn: () => fetchAlerts(filters),
  });

export const configQueryOptions = () =>
  queryOptions({
    queryKey: hermezKeys.config(),
    queryFn: fetchConfig,
  });