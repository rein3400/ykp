import { describe, expect, it } from "vitest";
import {
  menuKeyboard,
  reportKind,
  reportFields,
  parseField,
} from "./telegram-forms";
describe("native Ops forms", () => {
  it("offers every reporting capability without requiring web navigation", () => {
    const text = JSON.stringify(menuKeyboard());
    for (const label of [
      "Opening",
      "Closing",
      "Checklist",
      "Complaint",
      "Waste",
      "Stock",
      "QC",
      "KDS",
      "Briefing",
    ])
      expect(text).toContain(label);
    expect(reportKind("/complaint")).toBe("complaint");
    expect(reportKind("Opening Checklist")).toBe("opening");
  });
  it("collects explicit values and rejects invalid numeric or enum input", () => {
    expect(reportFields("waste").map((f) => f.key)).toEqual([
      "ingredient_name",
      "qty",
      "unit",
      "reason",
    ]);
    expect(
      parseField({ key: "qty", label: "Qty", type: "number" }, "1,5"),
    ).toBe("1.5");
    expect(() =>
      parseField({ key: "qty", label: "Qty", type: "number" }, "NaN"),
    ).toThrow();
    expect(() =>
      parseField({ key: "score", label: "Score", type: "score" }, "6"),
    ).toThrow();
    expect(
      parseField({ key: "severity", label: "Level", type: "severity" }, "high"),
    ).toBe("HIGH");
    expect(() =>
      parseField(
        { key: "severity", label: "Level", type: "severity" },
        "urgent",
      ),
    ).toThrow();
  });
});
