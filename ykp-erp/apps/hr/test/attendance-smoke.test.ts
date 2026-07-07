import { describe, it, expect } from "vitest";
import {
  computeLate,
  computeOvertime,
  computeEarlyLeave,
  generateHrDailySummary,
} from "@ykp/engine";

/**
 * Vitest smoke test for the attendance -> summary rebuild flow.
 * Mocks @ykp/schema so the route handlers can run without real Postgres.
 * We exercise the pure engine helpers directly because the route handlers
 * depend on Drizzle which is heavy to mock for a smoke test.
 */

describe("HR attendance engine", () => {
  it("flags late check-in correctly", () => {
    const late = computeLate(new Date("2026-07-07T09:30:00"), "09:00", 15);
    expect(late.is_late).toBe(true);
    expect(late.late_minutes).toBe(30);
  });

  it("respects tolerance window", () => {
    const onTime = computeLate(new Date("2026-07-07T09:10:00"), "09:00", 15);
    expect(onTime.is_late).toBe(false);
    expect(onTime.late_minutes).toBe(0);
  });

  it("computes overtime when checkout > shift end", () => {
    const ot = computeOvertime(new Date("2026-07-07T18:30:00"), "17:00");
    expect(ot.overtime_hours).toBe(1.5);
  });

  it("flags early leave when checkout < shift end", () => {
    const early = computeEarlyLeave(new Date("2026-07-07T16:30:00"), "17:00");
    expect(early.is_early_leave).toBe(true);
  });
});

describe("HR summary generator (mocked)", () => {
  it("throws when outlet is missing in master", async () => {
    const hrDb = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      insert: () => ({ values: () => ({ onConflictDoUpdate: async () => null }) }),
    } as never;
    const masterDb = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    } as never;
    await expect(
      generateHrDailySummary({ hrDb, masterDb, date: "2026-07-07", outlet_id: "OL-001" }),
    ).rejects.toThrow(/not found/);
  });

  it("returns ok when outlet + brand exist", async () => {
    const hrDb = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ brandId: "BR-001" }] }) }) }),
      insert: () => ({ values: () => ({ onConflictDoUpdate: async () => null }) }),
    } as never;
    const masterDb = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ name: "Café ABC" }, { name: "Brand X" }] }) }) }),
    } as never;
    // Should not throw — happy path smoke.
    await expect(
      generateHrDailySummary({ hrDb, masterDb, date: "2026-07-07", outlet_id: "OL-001" }),
    ).resolves.toBeDefined();
  });
});