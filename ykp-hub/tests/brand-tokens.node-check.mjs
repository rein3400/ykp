import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const tw = fs.readFileSync(new URL("../tailwind.config.js", import.meta.url), "utf8");

test("brand token values are exact", () => {
  assert.match(css, /--brand:\s*355 85% 47%/);
  assert.match(css, /--ink:\s*0 0% 6%/);
  assert.match(css, /--brand-fg:/);
  assert.match(css, /--brand-strong:/);
  assert.match(css, /--brand-soft:/);
});

test("tailwind exposes brand + ink", () => {
  assert.match(tw, /brand/);
  assert.match(tw, /ink/);
});

test("apps.ts has no legacy accent gradients", () => {
  const apps = fs.readFileSync(new URL("../app/components/apps.ts", import.meta.url), "utf8");
  assert.doesNotMatch(
    apps,
    /from-blue-500|to-indigo-600|from-emerald-5|to-emerald-7|from-amber-|from-purple-|from-orange-/
  );
  assert.match(apps, /E01020|brand/i);
});

test("login-form keeps reference copy", () => {
  const f = fs.readFileSync(new URL("../app/components/login-form.tsx", import.meta.url), "utf8");
  assert.match(f, /SATU AKUN UNTUK RUANG KERJA YKP/);
  assert.match(f, /Simulasikan login Google/);
  assert.match(f, /onLogin\(/);
  assert.match(f, /isGoogleAuthEnabledClient/);
});

const legacyAccent = /blue-|indigo-|emerald-|purple-|orange-|amber-|fuchsia-|sky-|teal-|cyan-/;
for (const file of ["hub-guide.tsx", "command-palette.tsx", "module-view.tsx", "theme-toggle.tsx", "avatar.tsx"]) {
  test(`dashboard-visible component has no legacy accents: ${file}`, () => {
    const src = fs.readFileSync(new URL(`../app/components/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, legacyAccent);
  });
}
