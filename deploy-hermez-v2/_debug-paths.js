const p = require("path");
const from = p.resolve("src/app/(dashboard)/page.tsx");
const tgt = p.resolve("src/features/finance/components/finance-dashboard-cards");
console.log("FROM:", from);
console.log("TGT:", tgt);
console.log("REL:", p.relative(p.dirname(from), tgt).replace(/\\/g, "/"));
