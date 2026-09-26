// Inline public/peers.json into report/peers-template.html → report/memecoin-holders.html.
import { readFileSync, writeFileSync } from "node:fs";
const P = JSON.parse(readFileSync(new URL("../public/peers.json", import.meta.url)));
const tpl = readFileSync(new URL("../report/peers-template.html", import.meta.url), "utf8");
writeFileSync(new URL("../report/memecoin-holders.html", import.meta.url), tpl.replace("/*PEERS*/null", JSON.stringify(P)));
console.log("✓ report/memecoin-holders.html");
