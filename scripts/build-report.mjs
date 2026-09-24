// Inline public/report.json into report/template.html → report/keycat-report.html (one self-contained page).
import { readFileSync, writeFileSync } from "node:fs";
const R = JSON.parse(readFileSync(new URL("../public/report.json", import.meta.url)));
const tpl = readFileSync(new URL("../report/template.html", import.meta.url), "utf8");
const { exclude, token, ...data } = R;
writeFileSync(new URL("../report/keycat-report.html", import.meta.url), tpl.replace("/*DATA*/null", JSON.stringify(data)));
console.log("✓ report/keycat-report.html");
