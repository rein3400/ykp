/**
 * @ykp/ui — public entry point.
 * Re-exports components, lib helpers, and providers so consuming apps
 * can `import { Button, KpiCard, formatIdr } from "@ykp/ui"`.
 */

// primitives
export * from "./components/button.js";
export * from "./components/card.js";
export * from "./components/input.js";
export * from "./components/table.js";
export * from "./components/badge.js";
export * from "./components/dialog.js";
export * from "./components/select.js";
export * from "./components/tabs.js";
export * from "./components/toast.js";
export * from "./components/dropdown-menu.js";
export * from "./components/form.js";

// composite
export * from "./components/kpi-card.js";
export * from "./components/data-table.js";
export * from "./components/filter-bar.js";
export * from "./components/export-button.js";

// lib
export * from "./lib/utils.js";
export * from "./lib/format.js";

// providers
export * from "./providers/theme-provider.js";
export * from "./providers/query-provider.js";

export const UI_VERSION = "0.1.0";