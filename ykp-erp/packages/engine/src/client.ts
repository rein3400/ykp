/**
 * @ykp/engine/client — client-safe utilities.
 *
 * Pure functions with no Node-only dependencies. Safe to import from
 * client components without dragging in postgres/bullmq/ioredis.
 */

export { todayWib, nowWibIso } from './wib';
export { formatIdr } from '@ykp/format';