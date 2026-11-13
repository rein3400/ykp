import { describe, expect, it } from "vitest";
import { expenseQuantity } from "./expense-quantity";
describe("informational expense qty", () => {
  it("retains fractional quantity independently of expense total", () => {
    expect(expenseQuantity("2.5")).toBe("2.5");
    expect(expenseQuantity(undefined)).toBe("");
  });
  it.each([0, -1, "NaN", "Infinity", null, {}])("rejects invalid qty %s", (v) =>
    expect(() => expenseQuantity(v)).toThrow(),
  );
});
