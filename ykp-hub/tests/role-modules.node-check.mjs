import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleApps } from "../app/components/role-modules.ts";

const apps = [{ id: "owner" }, { id: "hr" }, { id: "finance" }];

test("default (empty map) shows all and does not mutate", () => {
  const out = visibleApps(apps, "EMPLOYEE");
  assert.deepEqual(out.map((a) => a.id), ["owner", "hr", "finance"]);
  assert.notEqual(out, apps);
});

test("unknown role shows all", () => {
  assert.deepEqual(visibleApps(apps, "WHATEVER").map((a) => a.id), ["owner", "hr", "finance"]);
});

test("explicit allowlist filters", () => {
  assert.deepEqual(visibleApps(apps, "hr", { hr: ["hr"] }).map((a) => a.id), ["hr"]);
});
