import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ role: "finance_admin", used: false }));
const update = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/session", () => ({
  getSession: async () => ({ userId: "U1", role: state.role }),
}));
vi.mock("@/lib/audit", () => ({ logAudit: async () => undefined }));
vi.mock("@/db/sheets", async (original) => ({
  ...(await original<typeof import("@/db/sheets")>()),
  findRow: async () => ({
    rowNumber: 2,
    row: { category_id: "C1", category_name: "Old", status: "active" },
  }),
  readTab: async (tab: string) =>
    tab === "fin_expense" && state.used ? [{ expense_category: "Old" }] : [],
  updateRow: update,
}));
beforeEach(() => {
  state.role = "finance_admin";
  state.used = false;
  update.mockClear();
});
describe("expense master category rename", () => {
  it("permits unreferenced spelling correction with audit", async () => {
    const r = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ category_id: "C1", category_name: "New" }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(r.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.any(String),
      2,
      expect.objectContaining({ category_name: "New" }),
    );
  });
  it("refuses renaming a category stored by name in existing transactions", async () => {
    state.used = true;
    const r = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ category_id: "C1", category_name: "New" }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(r.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });
});
