#!/usr/bin/env node
// Rewrite @ykp/* imports to relative paths targeting _packages/*/src/index
// and @fin/* (or @<app>/*) to relative paths targeting src/.
// Also handles deep re-exports like @ykp/engine/src/foo.
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.resolve(process.argv[2] || "./src");
const APP_ALIAS = process.argv[3] || "@fin"; // @fin/, @hr/, @hermez/

const PKG_RE = /@ykp\/(schema|engine|auth|ui|config|format)(\/[^"'`]+)?/g;
const APP_ALIAS_ESC = APP_ALIAS.replace(/[.@/]/g, c => "\\" + c);
const APP_RE = new RegExp(APP_ALIAS_ESC + "(\\/[^\"'`]+)?", "g");

function relativize(fromFile, targetAbs) {
  const fromAbs = path.resolve(fromFile);
  const tgtAbs = path.resolve(targetAbs);
  let rel = path.relative(path.dirname(fromAbs), tgtAbs).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function processFile(file) {
  const orig = fs.readFileSync(file, "utf8");
  let updated = orig;

  // 1) @ykp/<pkg>(/sub)?  → relative to _packages/<pkg>/src/sub
  updated = updated.replace(PKG_RE, (_m, pkg, sub) => {
    const target = path.join(SRC_DIR, "..", "_packages", pkg, "src") + (sub || "");
    return relativize(file, target);
  });

  // 2) @<app-alias>/<sub>  → relative to src/<sub>
  updated = updated.replace(APP_RE, (_m, sub) => {
    const target = path.join(SRC_DIR) + (sub || "");
    return relativize(file, target);
  });

  if (updated !== orig) {
    fs.writeFileSync(file, updated, "utf8");
    return true;
  }
  return false;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let touched = 0;
for (const f of walk(SRC_DIR)) {
  if (processFile(f)) touched++;
}
console.log(`Touched ${touched} files.`);
