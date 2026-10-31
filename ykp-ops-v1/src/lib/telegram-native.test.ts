import { beforeEach, describe, expect, it, vi } from "vitest";
import { nativeOpsMessage } from "./telegram-native";
const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, string>[]>,
}));
vi.mock("@/db/sheets", async (original) => ({
  ...(await original<typeof import("@/db/sheets")>()),
  readTab: async (t: string) => db.rows[t] ?? [],
  findRow: async (t: string, k: string, v: string) => {
    const i = (db.rows[t] ?? []).findIndex((r) => r[k] === v);
    return i < 0 ? null : { rowIndex: i + 2, row: db.rows[t][i] };
  },
  appendRows: async (t: string, r: Record<string, string>[]) => {
    (db.rows[t] ??= []).push(...r);
  },
  updateRow: async (t: string, i: number, r: Record<string, string>) => {
    db.rows[t][i - 2] = r;
  },
}));
beforeEach(() => {
  db.rows = {
    ops_users: [
      {
        user_id: "U1",
        role: "staff",
        active_status: "active",
        telegram_id: "123456",
        outlet_id: "O1",
        brand_id: "B1",
      },
    ],
    master_outlet: [
      {
        outlet_id: "O1",
        outlet_name: "Outlet",
        brand_id: "B1",
        status: "active",
      },
      { outlet_id: "O2", brand_id: "B2", status: "active" },
    ],
    master_shift: [{ shift_id: "S1", shift_name: "Pagi", status: "active" }],
    master_checklist_template: [
      {
        checklist_template_id: "T1",
        outlet_id: "O1",
        brand_id: "B1",
        checklist_type: "OPENING",
        active_status: "active",
        checklist_item: "Cek POS",
        department: "FOH",
      },
    ],
  };
});
const send = (id: number, text: string) =>
  nativeOpsMessage({
    chatId: "123456",
    senderId: "123456",
    updateId: id,
    text,
  });
describe("native reporting", () => {
  it("saves checklist only after confirmation and does not duplicate repeated update", async () => {
    await send(1, "/opening");
    await send(2, "O1");
    await send(3, "S1");
    await send(4, "DONE");
    expect(db.rows.ops_opening_checklist).toBeUndefined();
    expect((await send(5, "KIRIM")).text).toContain("Laporan tersimpan");
    await send(5, "KIRIM");
    await send(6, "KIRIM");
    expect(db.rows.ops_opening_checklist).toHaveLength(1);
    expect(db.rows.ops_checklist_submission).toHaveLength(1);
  });
  it("enforces outlet scope and preserves draft for correction", async () => {
    await send(1, "/waste");
    expect((await send(2, "O2")).text).toContain("di luar cakupan");
    await send(3, "O1");
    await send(4, "S1");
    await send(5, "Ayam");
    await send(6, "2");
    await send(7, "kg");
    await send(8, "Rusak");
    await send(9, "KIRIM");
    expect(db.rows.ops_waste[0].approval_status).toBe("PENDING");
  });
  it.each([
    ["incident", ["Kompor rusak", "Api tidak stabil", "HIGH"], "ops_incident"],
    [
      "complaint",
      ["Pesanan keliru", "Customer menerima pesanan berbeda", "MEDIUM"],
      "ops_incident",
    ],
    ["stock", ["AYAM", "10", "8", "Selisih dua kg"], "ops_stock_issue"],
    ["qc", ["Pizza", "4", "Warna sesuai SOP"], "ops_qc_score"],
    ["kds", ["Order 123 pizza", "120", "180", "Normal"], "ops_kds_order"],
  ] as const)(
    "saves %s from native answers with actor and stable report ID",
    async (kind, answers, tab) => {
      await send(1, "/" + kind);
      await send(2, "O1");
      await send(3, "S1");
      for (let i = 0; i < answers.length; i++) await send(4 + i, answers[i]);
      expect(db.rows[tab]).toBeUndefined();
      const id = 4 + answers.length;
      expect((await send(id, "KIRIM")).text).toContain("Laporan tersimpan");
      await send(id, "KIRIM");
      expect(db.rows[tab]).toHaveLength(1);
      expect(db.rows[tab][0].outlet_id).toBe("O1");
      expect(db.rows.ops_audit_log[0].actor_user_id).toBe("U1");
    },
  );
  it("requires photo evidence and records incomplete closing for review", async () => {
    db.rows.master_checklist_template[0].checklist_type = "CLOSING";
    db.rows.master_checklist_template[0].required_photo = "true";
    await send(1, "/closing");
    await send(2, "O1");
    await send(3, "S1");
    expect((await send(4, "DONE")).text).toContain("URL foto");
    await send(5, "ULANG");
    await send(6, "NOT_DONE Bukti belum ada");
    await send(7, "KIRIM");
    expect(db.rows.ops_closing[0].status).toBe("NEEDS_REVIEW");
  });
  it("does not allow an unscoped staff account to choose arbitrary outlets", async () => {
    db.rows.ops_users[0].outlet_id = "";
    db.rows.ops_users[0].brand_id = "";
    expect((await send(1, "/opening")).text).toContain("cakupan");
    expect(db.rows.ops_opening_checklist).toBeUndefined();
  });
  it('does not disclose cached replies to an inactive linked account', async () => {
    await send(1, '/menu');
    db.rows.ops_users[0].active_status = 'inactive';
    expect((await send(1, '/menu')).text).toContain('belum terhubung');
  });
  it("rejects group identity and read-only writes", async () => {
    expect(
      (
        await nativeOpsMessage({
          chatId: "-1",
          senderId: "123456",
          updateId: 1,
          text: "/menu",
        })
      ).text,
    ).toContain("pribadi");
    db.rows.ops_users[0].role = "viewer";
    await send(1, "/opening");
    expect(db.rows.ops_telegram_session[0].last_reply).toContain(
      "tidak memiliki izin",
    );
  });
});
