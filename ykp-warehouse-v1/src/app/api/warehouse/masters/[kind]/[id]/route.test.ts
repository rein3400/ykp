import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT, DELETE } from "./route";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({
  role: "warehouse_admin",
  referenced: false,
}));
const save = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/session", () => ({
  getSession: async () => ({ userId: "U1", role: state.role }),
}));
vi.mock("@/lib/master-store", () => ({
  saveMasterRow: save,
  masterReferences: async () => [
    {
      tab: "warehouse_stock_movement",
      rows: state.referenced ? [{ item_id: "I1" }] : [],
    },
  ],
}));
vi.mock("@/lib/audit", () => ({ logAudit: async () => undefined }));
vi.mock("@/db/sheets", async (original) => ({
  ...(await original<typeof import("@/db/sheets")>()),
  readTab: async (tab: string) =>
    tab === "master_item"
      ? [
          {
            item_id: "I1",
            item_name: "Old",
            base_unit: "g",
            active_status: "active",
          },
        ]
      : tab === "warehouse_stock_movement" && state.referenced
        ? [{ item_id: "I1" }]
        : [],
}));
const context = { params: Promise.resolve({ kind: "items", id: "I1" }) };
const request = (body: unknown) =>
  new NextRequest("http://localhost", {
    method: "PUT",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  state.role = "warehouse_admin";
  state.referenced = false;
  save.mockClear();
});
describe("master mutation permissions and history", () => {
  it("edits permitted fields and retains item identity and units", async () => {
    expect((await PUT(request({ item_name: "New" }), context)).status).toBe(
      200,
    );
    expect(save).toHaveBeenCalledWith(
      "master_item",
      "item_id",
      "I1",
      expect.anything(),
      expect.objectContaining({
        item_name: "New",
        base_unit: "g",
        item_id: "I1",
      }),
    );
  });
  it("rejects locked fields and read-only role", async () => {
    expect((await PUT(request({ base_unit: "kg" }), context)).status).toBe(400);
    state.role = "staff";
    expect((await DELETE(request({}), context)).status).toBe(403);
    expect(save).not.toHaveBeenCalled();
  });
  it("archives unused masters without deleting and blocks ledger references", async () => {
    expect((await DELETE(request({}), context)).status).toBe(200);
    expect(save).toHaveBeenCalledWith(
      "master_item",
      "item_id",
      "I1",
      expect.anything(),
      expect.objectContaining({ active_status: "inactive" }),
    );
    save.mockClear();
    state.referenced = true;
    expect((await DELETE(request({}), context)).status).toBe(409);
    expect(save).not.toHaveBeenCalled();
  });
});
