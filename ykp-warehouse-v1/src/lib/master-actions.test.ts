import { describe, expect, it } from "vitest";
import { validateMasterPatch } from "./master-actions";
describe("safe master editing", () => {
  it("allows descriptive fields and rejects identity/unit changes", () => {
    expect(
      validateMasterPatch(
        "items",
        { item_name: " Tepung " },
        { item_name: "Old" },
      ),
    ).toEqual({ item_name: "Tepung" });
    expect(() =>
      validateMasterPatch("items", { base_unit: "kg" }, { base_unit: "g" }),
    ).toThrow();
    expect(() =>
      validateMasterPatch("items", { item_id: "OTHER" }, {}),
    ).toThrow();
  });
  it("rejects malformed numbers, objects and unknown fields", () => {
    expect(() =>
      validateMasterPatch("items", { minimum_stock: "NaN" }, {}),
    ).toThrow();
    expect(() =>
      validateMasterPatch("suppliers", { supplier_name: {} }, {}),
    ).toThrow();
    expect(() =>
      validateMasterPatch("locations", { brand_id: "B2" }, { brand_id: "B1" }),
    ).toThrow();
  });
  it("protects conversion semantics and allows lifecycle separately", () => {
    expect(() =>
      validateMasterPatch(
        "unit-conversion",
        { conversion_factor: "20" },
        { conversion_factor: "10" },
      ),
    ).toThrow();
    expect(() =>
      validateMasterPatch("items", { active_status: "inactive" }, {}),
    ).toThrow();
  });
});
