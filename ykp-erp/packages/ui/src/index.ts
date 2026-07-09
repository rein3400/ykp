/**
 * @ykp/ui — public entry point.
 * Re-exports components, lib helpers, and providers so consuming apps
 * can `import { Button, KpiCard, formatIdr } from "@ykp/ui"`.
 */

// primitives
export * from './components/button';
export * from './components/card';
export * from './components/input';
export * from './components/table';
export * from './components/badge';
export * from './components/dialog';
export * from './components/select';
export * from './components/tabs';
export * from './components/toast';
export * from './components/dropdown-menu';
export * from './components/form';

// composite
export * from './components/kpi-card';
export * from './components/data-table';
export * from './components/filter-bar';
export * from './components/export-button';

// lib
export * from './lib/utils';
export * from './lib/format';

// providers
export * from './providers/theme-provider';
export * from './providers/query-provider';

export const UI_VERSION = "0.1.0";