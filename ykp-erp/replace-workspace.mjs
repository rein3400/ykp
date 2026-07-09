// Replace workspace:* with file: paths in all package.json
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const replacements = {
  "packages/engine/package.json": ["@ykp/config", "@ykp/auth", "@ykp/format", "@ykp/ui", "@ykp/schema"],
  "packages/auth/package.json": ["@ykp/config", "@ykp/format", "@ykp/ui"],
  "packages/format/package.json": ["@ykp/config", "@ykp/ui"],
  "packages/ui/package.json": ["@ykp/format"],
  "apps/finance/package.json": ["@ykp/auth", "@ykp/config", "@ykp/engine", "@ykp/schema", "@ykp/ui"],
  "apps/hermez/package.json": ["@ykp/auth", "@ykp/config", "@ykp/engine", "@ykp/schema", "@ykp/ui"],
  "apps/hr/package.json": ["@ykp/auth", "@ykp/config", "@ykp/engine", "@ykp/schema", "@ykp/ui"],
};

for (const [rel, deps] of Object.entries(replacements)) {
  const fp = path.join(root, rel);
  const pkg = JSON.parse(fs.readFileSync(fp, "utf-8"));
  // Determine relative path from this package to packages/
  const isApp = rel.startsWith("apps/");
  const prefix = isApp ? "../../packages/" : "../";
  let changed = false;
  for (const section of ["dependencies", "devDependencies"]) {
    if (!pkg[section]) continue;
    for (const dep of deps) {
      if (pkg[section][dep] === "workspace:*") {
        // Map dep name to package dir
        const dir = dep.replace("@ykp/", "");
        pkg[section][dep] = `file:${prefix}${dir}`;
        changed = true;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(fp, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`updated ${rel}`);
  } else {
    console.log(`no change ${rel}`);
  }
}