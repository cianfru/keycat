// "Signs of life?" — the last 90 days against the 90 days before, day by day.
//
// Same replay, rules and exclusions as analyze.mjs (FIFO lots, behavioural exchange/router
// classification). Daily metrics are recorded for the last 270 days so three 90-day windows can
// be compared: last 90 (A), the 90 before (B), and the 90 before that (C).
//
// Per day:
//  • net buying / net selling — each wallet's market trades netted over the DAY (arbitrage bots
//    cancel), |net| ≥ $5 to count as a buyer or seller
//  • first-time buyers — a wallet's FIRST ever KEYCAT arriving from a pool, router or exchange-like
//    wallet, worth ≥ $20 (spam dust never qualifies)
//  • returners — a wallet that had emptied out and buys back in (≥ $20)
//  • exchange flow — coins withdrawn from exchange-like wallets to holders minus coins deposited
//  • old coins moving — coins held 180+ days that were sold into pools or sent to exchanges
//  • realized profit / loss on pool sales
//  • wallets holding ≥10k / ≥100k / ≥1M / ≥10M at day end
//
// Also: of wallets that were net buyers during the June–July low, how much do they still hold?
//
//   node --max-old-space-size=7000 scripts/recent.mjs
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { TOKEN, EXCLUDE_LABELS } from "../config.mjs";
import { makePriceAt, makeBook, classifyRows } from "./analyze.mjs";

const DAY = 86400000, EPS = 1e-6;
const iso = ts => new Date(ts).toISOString().slice(0, 10);
const LP = new Set(Object.entries(EXCLUDE_LABELS).filter(([, v]) => v.kind === "lp").map(([a]) => a));
const BARS = [1e4, 1e5, 1e6, 1e7];
const MIN_USD = 5, NEW_USD = 20, OLD_DAYS = 180;
const BOT_TRADES = Number(process.env.BOT_TRADES || 300);   // lifetime pool trades that make a wallet market infrastructure

const prices = JSON.parse(readFileSync(new URL("../data/price_onchain.json", import.meta.url)));
const priceAt = makePriceAt(prices.map(([d, p]) => [d, p]));
const END = Date.parse(prices.at(-1)[0]) + DAY;          // exclusive end (day after the last price day)
const START = END - 270 * DAY;
const LOW = [Date.parse("2026-06-01"), Date.parse("2026-08-01")];   // the June–July low

const scale = 10 ** TOKEN.decimals;
const csv = new URL("../data/transfers.csv", import.meta.url);
async function* rows() {
  const rl = createInterface({ input: createReadStream(csv), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line.startsWith("block")) continue;
    const [, , from, to, time, raw] = line.split(",");
    const amt = Number(raw) / scale;
    if (amt > EPS) yield [from, to, amt, Date.parse(time)];
  }
}

const pre = [];
for await (const r of rows()) pre.push([r[0], r[1], r[2]]);
const { exchange, router } = classifyRows(pre);
// Second pass over the same rows: lifetime pool trades per wallet (BOTS = 300+ trades: arbitrage and
// DEX→exchange relays that buy on a pool and forward the coins), and the share of each wallet's
// inflow that came from exchange-like wallets (EXCHANGE-FED: ≥90% and ≥10M held — custody or a
// withdrawal to self-custody, the chain can't tell; kept separate so it can't drive the read).
const M0 = new Set([...LP, ...router]);
const trades = new Map(), rin = new Map(), rinEx = new Map(), bal0 = new Map();
for (const [f, t, a] of pre) {
  if (M0.has(t)) trades.set(f, (trades.get(f) || 0) + 1);
  if (M0.has(f)) trades.set(t, (trades.get(t) || 0) + 1);
  rin.set(t, (rin.get(t) || 0) + a); if (exchange.has(f)) rinEx.set(t, (rinEx.get(t) || 0) + a);
  bal0.set(f, (bal0.get(f) || 0) - a); bal0.set(t, (bal0.get(t) || 0) + a);
}
pre.length = 0;
const bots = new Set([...trades].filter(([a, n]) => n >= BOT_TRADES && !exchange.has(a) && !router.has(a) && !LP.has(a) && !(a in EXCLUDE_LABELS)).map(([a]) => a));
const exFed = new Set([...rin].filter(([a, v]) => (rinEx.get(a) || 0) / v >= 0.9 && (bal0.get(a) || 0) >= 1e7 && !exchange.has(a)).map(([a]) => a));
const MARKET = new Set([...LP, ...router, ...bots]);
const EXCL = new Set([...Object.keys(EXCLUDE_LABELS), ...exchange.keys(), ...router, ...bots]);
const cls = a => (LP.has(a) ? "lp" : exchange.has(a) ? "ex" : router.has(a) || bots.has(a) ? "bot" : a in EXCLUDE_LABELS ? "out" : exFed.has(a) ? "fed" : "holder");
const supply = { lp: 0, ex: 0, bot: 0, out: 0, fed: 0, holder: 0 };
console.log(`infrastructure: ${exchange.size} exchange-like · ${router.size} routers · ${bots.size} bots · ${exFed.size} exchange-fed (${[...exFed].map(a => a.slice(0, 8)).join(", ")})`);

const book = makeBook();
const everHeld = new Set();
const days = new Map();
const D = d => { let o = days.get(d); if (!o) { o = { d, price: priceAt(Date.parse(d) + DAY / 2), netBuyUsd: 0, netSellUsd: 0, buyers: 0, sellers: 0, grossUsd: 0,
  newBuyers: 0, newUsd: 0, returners: 0, retUsd: 0, exOutTok: 0, exInTok: 0, oldSoldTok: 0, rProfit: 0, rLoss: 0, bars: null }; days.set(d, o); } return o; };
let dayNet = new Map(), curDay = null;
const lowNet = new Map();                                  // wallet → net tokens bought during the low
const flushDay = () => {
  if (!curDay) return;
  const o = D(curDay);
  for (const [, v] of dayNet) {
    if (Math.abs(v) * o.price < MIN_USD) continue;
    if (v > 0) { o.netBuyUsd += v * o.price; o.buyers++; } else { o.netSellUsd += -v * o.price; o.sellers++; }
  }
  const bars = BARS.map(() => 0);
  for (const [a, w] of book.W) if (w.bal >= BARS[0] && !exFed.has(a)) for (let i = 0; i < BARS.length; i++) if (w.bal >= BARS[i]) bars[i]++;
  o.bars = bars;
  o.supply = Object.fromEntries(Object.entries(supply).map(([k, v]) => [k, Math.round(v)]));
  dayNet = new Map();
};

// FIFO consume that also reports how much of the spend came from lots older than OLD_DAYS.
function sendAged(a, qty, price, ts) {
  const w = book.get(a); let old = 0, need = qty;
  for (let i = w.h; i < w.q.length && need > EPS; i++) {
    const l = w.q[i]; if (!l || l.qty <= EPS) continue;
    const take = Math.min(l.qty, need); need -= take;
    if (ts - l.ts >= OLD_DAYS * DAY) old += take;
  }
  const r = book.send(a, qty, price);
  return { ...r, old };
}

const newA = new Map();                                     // first-time buyers in the last 90 days → tokens received
const A0 = END - 90 * DAY;
for await (const [from, to, amt, ts] of rows()) {
  supply[cls(from)] -= amt; supply[cls(to)] += amt;
  const rec = ts >= START;
  const d = iso(ts);
  if (rec && d !== curDay) { flushDay(); curDay = d; }
  const p = priceAt(ts);
  const o = rec ? D(d) : null;
  const fromM = MARKET.has(from), toM = MARKET.has(to), fromX = exchange.has(from), toX = exchange.has(to);

  if (!EXCL.has(from)) {
    const r = sendAged(from, amt, p, ts);
    if (rec) {
      if (toM) {
        dayNet.set(from, (dayNet.get(from) || 0) - amt); o.grossUsd += amt * p;
        const pl = r.value - r.cost; if (pl >= 0) o.rProfit += pl; else o.rLoss += -pl;
      }
      if (toX) o.exInTok += amt;
      if ((toM || toX) && !exFed.has(from)) o.oldSoldTok += r.old;
    }
    if (ts >= LOW[0] && ts < LOW[1] && toM) lowNet.set(from, (lowNet.get(from) || 0) - amt);
  }
  if (!EXCL.has(to)) {
    const w = book.get(to), was = w.bal, seen = everHeld.has(to);
    book.receive(to, amt, ts, p);
    everHeld.add(to);
    if (rec) {
      if (fromM) { dayNet.set(to, (dayNet.get(to) || 0) + amt); o.grossUsd += amt * p; }
      if (fromX) o.exOutTok += amt;
      if ((fromM || fromX) && amt * p >= NEW_USD) {
        if (!seen) { o.newBuyers++; o.newUsd += amt * p; if (ts >= A0) newA.set(to, amt); }
        else if (was <= EPS) { o.returners++; o.retUsd += amt * p; }
      }
    }
    if (ts >= LOW[0] && ts < LOW[1] && fromM) lowNet.set(to, (lowNet.get(to) || 0) + amt);
  }
}
flushDay();

const series = [...days.values()].sort((a, b) => (a.d < b.d ? -1 : 1)).map(o => ({
  ...o, price: +o.price.toPrecision(5), netBuyUsd: Math.round(o.netBuyUsd), netSellUsd: Math.round(o.netSellUsd), grossUsd: Math.round(o.grossUsd),
  newUsd: Math.round(o.newUsd), retUsd: Math.round(o.retUsd), exOutTok: Math.round(o.exOutTok), exInTok: Math.round(o.exInTok),
  oldSoldTok: Math.round(o.oldSoldTok), rProfit: Math.round(o.rProfit), rLoss: Math.round(o.rLoss),
}));

// Window summaries. A = last 90 days, B = the 90 before, C = the 90 before that.
// supply at the END of the day before `d` (= start of window)
const prevSupply = d => { const i = series.findIndex(r => r.d === d); return (i > 0 ? series[i - 1] : series[0]).supply; };
const win = (from, to) => {
  const s = series.filter(r => r.d >= iso(from) && r.d < iso(to));
  const sum = k => s.reduce((a, r) => a + r[k], 0);
  const first = s[0], last = s.at(-1);
  return {
    from: first.d, to: last.d, days: s.length,
    priceStart: first.price, priceEnd: last.price, priceChangePct: +(100 * (last.price / first.price - 1)).toFixed(1),
    netBuyUsd: sum("netBuyUsd"), netSellUsd: sum("netSellUsd"), netUsd: sum("netBuyUsd") - sum("netSellUsd"),
    grossUsd: sum("grossUsd"), buyerDays: sum("buyers"), sellerDays: sum("sellers"),
    newBuyers: sum("newBuyers"), newUsd: sum("newUsd"), returners: sum("returners"), retUsd: sum("retUsd"),
    exNetTok: sum("exOutTok") - sum("exInTok"), exOutTok: sum("exOutTok"), exInTok: sum("exInTok"),
    oldSoldTok: sum("oldSoldTok"), rProfit: sum("rProfit"), rLoss: sum("rLoss"),
    barsStart: first.bars, barsEnd: last.bars,
    holderStart: prevSupply(first.d).holder, holderEnd: last.supply.holder,
    holderChange: last.supply.holder - prevSupply(first.d).holder,
    exStart: prevSupply(first.d).ex, exEnd: last.supply.ex, lpStart: prevSupply(first.d).lp, lpEnd: last.supply.lp,
    fedStart: prevSupply(first.d).fed, fedEnd: last.supply.fed,
  };
};
const windows = { A: win(END - 90 * DAY, END), B: win(END - 180 * DAY, END - 90 * DAY), C: win(END - 270 * DAY, END - 180 * DAY) };

// Did the June–July low buyers hold? Net bought ≥ $50 worth at the low's average price.
const lowPrice = series.filter(r => r.d >= iso(LOW[0]) && r.d < iso(LOW[1])).reduce((a, r, _, s) => a + r.price / s.length, 0);
let lb = 0, lbTok = 0, lbHeld = 0, lbAll = 0, lbMore = 0, lbNone = 0;
for (const [a, net] of lowNet) {
  if (net * lowPrice < 50) continue;
  lb++; lbTok += net;
  const bal = book.W.get(a)?.bal ?? 0;
  lbHeld += Math.min(bal, net);
  if (bal >= net * 0.95) lbAll++;
  if (bal > net * 1.05) lbMore++;
  if (bal < net * 0.05) lbNone++;
}
const lowBuyers = { window: [iso(LOW[0]), iso(LOW[1] - DAY)], avgPrice: +lowPrice.toPrecision(4), wallets: lb, boughtTok: Math.round(lbTok),
  stillHeldPct: +(100 * lbHeld / lbTok).toFixed(1), keptAll: lbAll, addedMore: lbMore, soldAll: lbNone };

let nb = 0, nbHold = 0, nbTok = 0, nbHeldTok = 0;
for (const [a, got] of newA) { nb++; nbTok += got; const b = book.W.get(a)?.bal ?? 0; if (b >= got * 0.5) nbHold++; nbHeldTok += Math.min(b, got); }
const newBuyerRetention = { wallets: nb, stillHoldHalfPct: +(100 * nbHold / nb).toFixed(1), tokensStillHeldPct: +(100 * nbHeldTok / nbTok).toFixed(1) };
console.log(JSON.stringify({ newBuyerRetention }));
writeFileSync(new URL("../public/recent.json", import.meta.url), JSON.stringify({ updated: series.at(-1).d, bars: BARS, windows, lowBuyers, newBuyerRetention, infra: { exchange: exchange.size, router: router.size, bots: bots.size, exFed: [...exFed] }, series }));
console.log(JSON.stringify({ windows, lowBuyers }, null, 1));
