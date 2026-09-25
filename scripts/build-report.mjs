// Inline public/report.json into report/template.html → report/keycat-report.html (one self-contained page).
import { readFileSync, writeFileSync } from "node:fs";
const R = JSON.parse(readFileSync(new URL("../public/report.json", import.meta.url)));
const tpl = readFileSync(new URL("../report/template.html", import.meta.url), "utf8");
const RC = JSON.parse(readFileSync(new URL("../public/recent.json", import.meta.url)));
const RS = JSON.parse(readFileSync(new URL("../public/recent-spx.json", import.meta.url)));
for (const x of [RC, RS]) x.series = x === RC ? x.series : [];          // the SPX daily series isn't drawn; keep the page small
const { exclude, token, ...data } = R;
writeFileSync(new URL("../report/keycat-report.html", import.meta.url), tpl.replace("/*DATA*/null", JSON.stringify(data)).replace("/*RECENT*/null", JSON.stringify(RC)).replace("/*RECENTSPX*/null", JSON.stringify(RS)));
console.log("✓ report/keycat-report.html");
