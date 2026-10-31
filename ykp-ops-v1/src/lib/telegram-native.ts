import { createHash } from "node:crypto";
import {
  appendRows,
  findRow,
  readTab,
  updateRow,
  TABS,
  type TabName,
} from "@/db/sheets";
import { can, type Role } from "./rbac";
import { todayWib, nowTimestampWib } from "./format";
import { selectChecklistTemplates } from "./checklist";
import {
  escapeTelegram as escape,
  menuKeyboard,
  parseField,
  reportFields,
  reportKind,
  type ReportKind,
} from "./telegram-forms";

interface Draft {
  kind: ReportKind;
  stage:
    "outlet" | "shift" | "field" | "item" | "photo" | "confirm" | "completed";
  id: string;
  date: string;
  userId: string;
  startedAt: number;
  outletId?: string;
  brandId?: string;
  shiftId?: string;
  fields: Record<string, string>;
  index: number;
  templates?: Record<string, string>[];
  items: Record<string, string>[];
}
export interface BotReply {
  text: string;
  keyboard?: ReturnType<typeof menuKeyboard>;
}
class InputError extends Error {}
const resource: Record<ReportKind, string> = {
  opening: "opening",
  closing: "closing",
  checklist: "opening",
  incident: "incident",
  complaint: "incident",
  waste: "waste",
  stock: "waste",
  qc: "qc",
  kds: "kds",
  briefing: "briefing",
};
function permitted(user: Record<string, string>, kind: ReportKind) {
  return can(
    user.role as Role,
    kind === "briefing" ? "view" : "create",
    resource[kind] as Parameters<typeof can>[2],
  );
}
function allowedOutlet(o: Record<string, string>, u: Record<string, string>) {
  return (
    ["active", "1"].includes((o.status ?? "").trim().toLowerCase()) &&
    (!u.outlet_id || o.outlet_id === u.outlet_id) &&
    (!u.brand_id || o.brand_id === u.brand_id)
  );
}

async function appendMissing(
  tab: TabName,
  key: string,
  rows: Record<string, string>[],
) {
  const ids = new Set((await readTab(tab)).map((r) => r[key]));
  const missing = rows.filter((r) => !ids.has(r[key]));
  if (missing.length) await appendRows(tab, missing);
}
async function persist(d: Draft, user: Record<string, string>): Promise<void> {
  if (!permitted(user, d.kind))
    throw new InputError("Izin akun tidak mengizinkan laporan ini");
  const outlets = await readTab(TABS.outlets);
  const outlet = outlets.find(
    (o) => o.outlet_id === d.outletId && allowedOutlet(o, user),
  );
  if (!outlet) throw new InputError("Outlet tidak aktif/di luar cakupan");
  const shifts = await readTab(TABS.shifts);
  if (
    !shifts.some(
      (s) =>
        s.shift_id === d.shiftId &&
        ["active", "1"].includes((s.status ?? "").toLowerCase()),
    )
  )
    throw new InputError("Shift tidak aktif");
  const now = nowTimestampWib();
  const common = {
    date: d.date,
    brand_id: outlet.brand_id,
    outlet_id: outlet.outlet_id,
    shift_id: d.shiftId ?? "",
    created_at: now,
  };
  if (d.kind === "opening" || d.kind === "closing" || d.kind === "checklist") {
    const type = d.kind === "checklist" ? "GENERAL" : d.kind.toUpperCase();
    const templates = selectChecklistTemplates(
      await readTab(TABS.checklistTemplates),
      type,
      outlet.outlet_id,
      outlet.brand_id,
    );
    if (
      !d.templates ||
      templates.length !== d.items.length ||
      JSON.stringify(
        templates.map((t) => [
          t.checklist_template_id,
          t.checklist_item,
          t.required_photo,
          t.critical_flag,
        ]),
      ) !==
        JSON.stringify(
          d.templates.map((t) => [
            t.checklist_template_id,
            t.checklist_item,
            t.required_photo,
            t.critical_flag,
          ]),
        )
    )
      throw new InputError("SOP berubah; mulai laporan baru");
    for (let index = 0; index < templates.length; index++) {
      const item = d.items[index];
      if (item.status === 'DONE' && templates[index].required_photo === 'true') {
        let photo: URL;
        try { photo = new URL(item.photo_url); } catch { throw new InputError('Bukti foto wajib belum valid'); }
        if (photo.protocol !== 'https:' || /api\.telegram\.org\/file\/bot/i.test(item.photo_url)) throw new InputError('URL bukti foto tidak aman');
      }
    }
    if (d.items.some((i) => !["DONE", "NOT_DONE"].includes(i.status)))
      throw new InputError("Status item tidak valid");
    await appendMissing(
      TABS.checklistSubmissions,
      "submission_id",
      d.items.map((item, i) => ({
        ...common,
        ...item,
        submission_id: `${d.id}-${i + 1}`,
        checklist_type: type,
        submitted_by: user.user_id,
        submitted_at: now,
      })),
    );
    if (d.kind === "opening")
      await appendMissing(
        TABS.opening,
        "opening_id",
        d.items.map((item, i) => ({
          ...common,
          ...item,
          opening_id: `${d.id}-${i + 1}`,
          completed_by: user.user_id,
          completed_at: now,
        })),
      );
    if (d.kind === "closing")
      await appendMissing(TABS.closing, "closing_id", [
        {
          ...common,
          closing_id: d.id,
          closed_by: user.user_id,
          checklist_status: d.items.every((i) => i.status === "DONE")
            ? "DONE"
            : "NOT_DONE",
          issues: d.items
            .filter((i) => i.status !== "DONE")
            .map((i) => i.checklist_item)
            .join("; "),
          status: d.items.every((i) => i.status === "DONE")
            ? "CLOSED"
            : "NEEDS_REVIEW",
        },
      ]);
  } else if (d.kind === "incident" || d.kind === "complaint") {
    await appendMissing(TABS.incidents, "incident_id", [
      {
        ...common,
        incident_id: d.id,
        ...d.fields,
        incident_type: d.kind === "complaint" ? "COMPLAINT" : "OPERATIONAL",
        channel: "TELEGRAM",
        status: "OPEN",
        created_by: user.user_id,
      },
    ]);
    if (["HIGH", "CRITICAL"].includes(d.fields.severity))
      await appendMissing(TABS.hermezAlerts, "alert_id", [
        {
          alert_id: `${d.id}-alert`,
          date: d.date,
          severity: d.fields.severity,
          alert_type: "OPS_INCIDENT",
          title: d.fields.title,
          message: d.fields.description,
          outlet_id: outlet.outlet_id,
          status: "OPEN",
          created_at: now,
        },
      ]);
  } else if (d.kind === "waste") {
    await appendMissing(TABS.waste, "waste_id", [
      {
        ...common,
        waste_id: d.id,
        ...d.fields,
        waste_type: "SPOILED",
        reported_by: user.user_id,
        approval_status: "PENDING",
        estimated_unit_cost: "",
        estimated_total_value: "",
      },
    ]);
  } else if (d.kind === "stock") {
    await appendMissing(TABS.stockIssues, "stock_issue_id", [
      {
        ...common,
        stock_issue_id: d.id,
        ...d.fields,
        issue_type: "DISCREPANCY",
        difference_qty: String(
          Number(d.fields.actual_qty) - Number(d.fields.expected_qty),
        ),
        status: "OPEN",
      },
    ]);
  } else if (d.kind === "qc") {
    const score = Number(d.fields.score);
    await appendMissing(TABS.qc, "qc_id", [
      {
        ...common,
        qc_id: d.id,
        ...d.fields,
        max_score: "5",
        qc_category: "APPEARANCE",
        status: score < 3 ? "FAIL" : score < 4 ? "NEEDS_REVIEW" : "PASS",
        reviewed_by: user.user_id,
        second_opinion_status: "NOT_REQUESTED",
      },
    ]);
  } else if (d.kind === "kds") {
    const seconds = Number(d.fields.serving_seconds),
      target = Number(d.fields.target_seconds);
    await appendMissing(TABS.kds, "order_id", [
      {
        ...common,
        order_id: d.id,
        ...d.fields,
        channel: "TELEGRAM",
        station: "Outlet",
        status: "COMPLETED",
        completed_at: now,
        sla_status:
          seconds > target * 2
            ? "CRITICAL_DELAY"
            : seconds > target
              ? "OVER_SLA"
              : "OK",
      },
    ]);
  }
  await appendMissing(TABS.auditLog, "audit_id", [
    {
      audit_id: `${d.id}-audit`,
      timestamp: now,
      actor_user_id: user.user_id,
      actor_role: user.role,
      action: "telegram_create",
      entity: d.kind,
      entity_id: d.id,
      after_value: JSON.stringify({
        outlet_id: d.outletId,
        shift_id: d.shiftId,
        source: "OPS_BOT",
      }),
    },
  ]);
}

export async function nativeOpsMessage(input: {
  chatId: string;
  senderId: string;
  updateId: number;
  text: string;
}): Promise<BotReply> {
  if (input.chatId !== input.senderId || !/^\d+$/.test(input.senderId))
    return { text: "Gunakan percakapan pribadi dengan bot, bukan grup." };
  const session = await findRow(TABS.telegramSessions, "chat_id", input.chatId);

  const users = (await readTab(TABS.users)).filter(
    (u) =>
      u.telegram_id?.trim() === input.senderId &&
      ["active", "1"].includes((u.active_status ?? "").toLowerCase()),
  );
  if (users.length !== 1)
    return {
      text: "Akun belum terhubung atau identitas ganda. Buka Ops → Telegram, buat kode, lalu /link KODE. Hubungi admin bila sudah linked.",
    };
  const user = users[0];
  if (
    ["staff", "supervisor", "outlet_manager"].includes(user.role) &&
    !user.outlet_id
  )
    return {
      text: "Cakupan outlet akun belum ditentukan. Hubungi HR/admin untuk menetapkan cakupan sebelum melapor.".toLowerCase(),
    };
  if (user.role === "brand_manager" && !user.brand_id)
    return { text: "Cakupan brand akun belum ditentukan; hubungi admin." };
  let draft: Draft | null = null;
  if (session?.row.state_json) {
    try {
      draft = JSON.parse(session.row.state_json);
    } catch {
      draft = null;
    }
  }
  if (draft && !permitted(user, draft.kind)) return { text: 'Izin laporan ini sudah berubah. Hubungi admin atau gunakan /menu.' };
  if (draft?.outletId && !(await readTab(TABS.outlets)).some((outlet) => outlet.outlet_id === draft?.outletId && allowedOutlet(outlet, user))) return { text: 'Cakupan outlet laporan ini sudah berubah; hubungi admin.' };
  const identityMatches = session?.row.user_id === user.user_id;
  if (
    session &&
    Number(session.row.last_update_id) >= input.updateId &&
    identityMatches
  )
    return {
      text:
        Number(session.row.last_update_id) === input.updateId
          ? session.row.last_reply || "Update sudah diproses."
          : "Pesan lama sudah diproses; gunakan /menu.",
      keyboard: menuKeyboard(),
    };
  if (
    draft &&
    (draft.userId !== user.user_id ||
      Date.now() - draft.startedAt > 2 * 60 * 60 * 1000 ||
      draft.date !== todayWib())
  )
    draft = null;
  const text = input.text.trim();
  let reply = "";
  const remember = async (): Promise<BotReply> => {
    const row = {
      chat_id: input.chatId,
      user_id: user.user_id,
      state_json: draft ? JSON.stringify(draft) : "",
      last_update_id: String(input.updateId),
      last_reply: reply,
      updated_at: nowTimestampWib(),
    };
    if (session) await updateRow(TABS.telegramSessions, session.rowIndex, row);
    else await appendRows(TABS.telegramSessions, [row]);
    return { text: reply, keyboard: menuKeyboard() };
  };
  if (["/menu", "/help", "/start", "/batal"].includes(text.toLowerCase())) {
    draft = null;
    reply =
      "Menu Operasional. Pilih tombol di bawah. Gunakan /batal untuk membatalkan. Laporan hanya disimpan setelah ketik KIRIM. Waste menunggu persetujuan; Stock Issue di sini adalah laporan selisih, bukan pemotongan ledger gudang.";
    return remember();
  }
  const kind = reportKind(text);
  if (kind) {
    if (!permitted(user, kind)) {
      reply = "Role akun tidak memiliki izin menu ini.";
      return remember();
    }
    draft = {
      kind,
      stage: "outlet",
      id: `TG-${createHash("sha256").update(`${input.senderId}:${input.updateId}`).digest("hex").slice(0, 24)}`,
      date: todayWib(),
      userId: user.user_id,
      startedAt: Date.now(),
      fields: {},
      index: 0,
      items: [],
    };
    const outlets = (await readTab(TABS.outlets)).filter((o) =>
      allowedOutlet(o, user),
    );
    reply = `Pilih kode outlet untuk ${kind}:\n${outlets.map((o) => `${o.outlet_id} — ${o.outlet_name}`).join("\n")}\nKetik kode outlet persis. /batal untuk kembali.`;
    return remember();
  }
  if (!draft) {
    reply =
      "Pilih menu atau ketik /menu. Jika sesi kedaluwarsa, mulai kembali; laporan lama tidak diubah.";
    return remember();
  }
  try {
    if (draft.stage === "outlet") {
      const outlet = (await readTab(TABS.outlets)).find(
        (o) => o.outlet_id === text && allowedOutlet(o, user),
      );
      if (!outlet)
        throw new InputError("Kode outlet tidak valid/di luar cakupan");
      draft.outletId = outlet.outlet_id;
      draft.brandId = outlet.brand_id;
      if (draft.kind === "briefing") {
        const rows = (await readTab(TABS.briefing)).filter(
          (b) =>
            b.date === todayWib() &&
            b.outlet_id === outlet.outlet_id &&
            b.published_status === "PUBLISHED",
        );
        reply = rows.length
          ? rows
              .map(
                (b) =>
                  `Briefing ${escape(b.date)} · ${escape(b.shift_name || b.shift_id)}\n${escape(b.briefing_text)}`,
              )
              .join("\n\n")
              .slice(0, 3800)
          : "Belum ada briefing terpublikasi hari ini untuk outlet ini.";
        draft = null;
        return remember();
      }
      draft.stage = "shift";
      const shifts = (await readTab(TABS.shifts)).filter((s) =>
        ["active", "1"].includes((s.status ?? "").toLowerCase()),
      );
      reply = `Pilih kode shift:\n${shifts.map((s) => `${s.shift_id} — ${s.shift_name}`).join("\n")}`;
    } else if (draft.stage === "shift") {
      if (
        !(await readTab(TABS.shifts)).some(
          (s) =>
            s.shift_id === text &&
            ["active", "1"].includes((s.status ?? "").toLowerCase()),
        )
      )
        throw new InputError("Kode shift tidak valid");
      draft.shiftId = text;
      if (["opening", "closing", "checklist"].includes(draft.kind)) {
        draft.templates = selectChecklistTemplates(
          await readTab(TABS.checklistTemplates),
          draft.kind === "checklist" ? "GENERAL" : draft.kind.toUpperCase(),
          draft.outletId!,
          draft.brandId!,
        );
        if (!draft.templates.length)
          throw new InputError(
            "Template SOP belum tersedia. Hubungi supervisor; jangan memakai outlet lain.",
          );
        draft.stage = "item";
        reply = itemPrompt(draft);
      } else {
        draft.stage = "field";
        reply = reportFields(draft.kind)[0].label;
      }
    } else if (draft.stage === "field") {
      const fields = reportFields(draft.kind),
        field = fields[draft.index];
      try {
        draft.fields[field.key] = parseField(field, text);
      } catch (error) {
        throw new InputError(
          error instanceof Error ? error.message : "Input tidak valid",
        );
      }
      draft.index++;
      if (draft.index < fields.length) reply = fields[draft.index].label;
      else {
        draft.stage = "confirm";
        reply = confirmation(draft);
      }
    } else if (draft.stage === "item") {
      if (!/^(DONE|NOT_DONE)(?:\s|$)/i.test(text))
        throw new InputError(
          "Balas DONE atau NOT_DONE diikuti catatan bila perlu",
        );
      const template = draft.templates![draft.index];
      const status = text.split(/\s/)[0].toUpperCase();
      const notes = text.slice(status.length).trim();
      draft.items.push({
        checklist_item: template.checklist_item,
        department: template.department || "Umum",
        critical_flag: template.critical_flag || "false",
        status,
        notes,
        photo_url: "",
      });
      if (status === "DONE" && template.required_photo === "true") {
        draft.stage = "photo";
        reply =
          "Kirim URL foto HTTPS (bukan token/link download bot). Jika belum ada bukti, ketik ULANG lalu NOT_DONE dengan catatan.";
      } else {
        draft.index++;
        if (draft.index < draft.templates!.length) reply = itemPrompt(draft);
        else {
          draft.stage = "confirm";
          reply = confirmation(draft);
        }
      }
    } else if (draft.stage === "photo") {
      if (text.toUpperCase() === "ULANG") {
        draft.items.pop();
        draft.stage = "item";
        reply = itemPrompt(draft);
      } else {
        let url: URL;
        try {
          url = new URL(text);
        } catch {
          throw new InputError("URL foto tidak valid");
        }
        if (
          url.protocol !== "https:" ||
          text.length > 500 ||
          /api\.telegram\.org\/file\/bot/i.test(text)
        )
          throw new InputError("Gunakan URL bukti HTTPS tanpa token");
        draft.items[draft.items.length - 1].photo_url = text;
        draft.index++;
        draft.stage = "item";
        if (draft.index < draft.templates!.length) reply = itemPrompt(draft);
        else {
          draft.stage = "confirm";
          reply = confirmation(draft);
        }
      }
    } else if (draft.stage === "confirm") {
      if (text.toUpperCase() !== "KIRIM")
        throw new InputError("Ketik KIRIM untuk menyimpan, atau /batal");
      await persist(draft, user);
      draft.stage = "completed";
      reply = `Laporan tersimpan: ${draft.id}\nOutlet ${draft.outletId} · Shift ${draft.shiftId}\nPeriksa riwayat di dashboard. Waste menunggu persetujuan; masalah stok tidak mengubah saldo gudang.\n/menu untuk laporan berikutnya.`;
    } else
      reply = `Laporan ${draft.id} sudah tersimpan. Ketik /menu untuk laporan berikutnya.`;
  } catch (error) {
    if (!(error instanceof InputError)) throw error;
    reply = `Belum disimpan: ${escape(error instanceof Error ? error.message : "Input tidak valid")}\nPerbaiki jawaban atau /batal.`;
  }
  return remember();
}
function itemPrompt(d: Draft) {
  const t = d.templates![d.index];
  return `Item ${d.index + 1}/${d.templates!.length} · ${escape(t.department || "Umum")}\n${escape(t.checklist_item)}${t.critical_flag === "true" ? "\nKRITIKAL" : ""}\nBalas DONE atau NOT_DONE, boleh diikuti catatan.`;
}
function confirmation(d: Draft) {
  return `Periksa laporan ${d.kind}\nTanggal ${d.date} WIB\nOutlet ${d.outletId} · Shift ${d.shiftId}\n${
    d.items.length
      ? `${d.items.filter((i) => i.status === "DONE").length}/${d.items.length} tugas DONE`
      : Object.entries(d.fields)
          .map(([k, v]) => `${k}: ${escape(v)}`)
          .join("\n")
  }\nKetik KIRIM untuk menyimpan atau /batal.`;
}
