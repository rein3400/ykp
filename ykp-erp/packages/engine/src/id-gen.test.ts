import { describe, it, expect } from "vitest";
import { receiptId } from "./id-gen";

describe("receiptId", () => {
  it("formats stable receipt id", () => {
    expect(receiptId("2026-07-18", "OL-001", 1)).toBe("RCP-20260718-OL-001-0001");
  });
});
