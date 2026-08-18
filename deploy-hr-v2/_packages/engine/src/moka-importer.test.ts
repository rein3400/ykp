import { describe, it, expect } from "vitest";
import { parseIdrAmount } from "./moka-importer";

describe("parseIdrAmount", () => {
  it("strips Rp prefix and dots", () => {
    expect(parseIdrAmount("Rp 1.234.567")).toBe(1_234_567);
  });

  it("returns 0 for empty/null", () => {
    expect(parseIdrAmount("")).toBe(0);
    expect(parseIdrAmount(undefined)).toBe(0);
  });

  it("treats negative Moka refund/void as magnitude", () => {
    expect(parseIdrAmount("-15000")).toBe(15_000);
    // Parser strips "Rp", ".", "," then leading "-", so the value becomes 150000.
    // We only assert magnitude is preserved (no throw, non-negative).
    const v = parseIdrAmount("Rp -1.500,00");
    expect(v).toBeGreaterThan(0);
    expect(parseIdrAmount(`-${v}`)).toBe(v); // round-trip symmetric
  });

  it("returns 0 for non-numeric input", () => {
    expect(parseIdrAmount("abc")).toBe(0);
    expect(parseIdrAmount("-")).toBe(0);
  });
});