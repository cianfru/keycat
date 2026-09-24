// KEYCAT holder-health analysis — ONE pass over the full transfer history.
//
// Inputs:  data/transfers.csv  (block,log_index,sender,receiver,time,value — exact on-chain order)
//          data/price_onchain.json  ([[date, usd, poolWeth]] — daily, from the pool's reserves)
// Output:  public/report.json  (everything the report page draws; every number reproducible)
//
// Method (same conventions as the SPX6900 work):
//  • FIFO lots per wallet: a receive opens a lot at that day's USD price; a send consumes the
//    oldest lots first. So every held coin keeps its real cost and age.
//  • Addresses in EXCLUDE_LABELS (DEX pools, burn, null) are never holders. A transfer FROM a pool
//    to a wallet is a DEX BUY; wallet → pool is a DEX SELL. Aggregator/router hops sit in between
//    on some trades, so buyer/seller COUNTS are approximate; the pool-side VOLUMES are exact.
//  • A receive from anyone is priced at market that day (the realized-cap convention) — airdrops
//    and transfers-in therefore carry the market price of the day they arrived, not zero.
//
//   node --max-old-space-size=6000 scripts/analyze.mjs
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { TOKEN, EXCLUDE_LABELS } from "../config.mjs";

const DAY = 86400000, EPS = 1e-6;
const iso = ts => new Date(ts).toISOString().slice(0, 10);
const LP = new Set(Object.entries(EXCLUDE_LABELS).filter(([, v]) => v.kind === "lp").map(([a]) => a));
const HOLDER_MIN = 1;                          // a "holder" has ≥1 KEYCAT — ~650k addresses hold spam dust below that
const SIZE_BAR = 1_000_000;
const HOLDER_BARS = [1, 1e4, 1e5, 1e6, 1e7];   // holder counts at ≥1 · ≥10k · ≥100k · ≥1M · ≥10M KEYCAT
const NET_MIN_USD = 5;                         // a wallet's weekly net under $5 is noise, not a buyer or seller                    // "meaningful holder" bar, in KEYCAT (0.01% of supply)
const AGE_EDGES = [30, 90, 180, 365];          // → [<1m, 1-3m, 3-6m, 6-12m, 1y+]
const ageBand = d => { let i = 0; while (i < AGE_EDGES.length && d >= AGE_EDGES[i]) i++; return i; };
const TIERS = [1e5, 1e6, 1e7, 1e8];            // wallet size: <100k · 100k-1M · 1M-10M · 10M-100M · 100M+

// ── price lookup (daily, forward-filled) ───────────────────────────────────
export function makePriceAt(rows) {
  const m = new Map(rows.map(([d, p]) => [d, p]));
  const days = rows.map(r => r[0]);
  return ts => {
    const d = iso(ts);
    if (m.has(d)) return m.get(d);
    // before first price → first price; gap → last known
    let lo = 0, hi = days.length - 1, best = days[0];
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (days[mid] <= d) { best = days[mid]; lo = mid + 1; } else hi = mid - 1; }
    return m.get(best);
  };
}

// ── behavioural classification (pre-pass) ───────────────────────────────────
// No exchange wallet is labelled on Base explorers for KEYCAT, so we find them by BEHAVIOUR, with a
// rule anyone can re-run: counting only transfers of ≥1,000 KEYCAT (spam dust is ignored), a wallet
// that sent ≥300 and received ≥100 transfers, to ≥100 and from ≥25 distinct wallets, is market
// infrastructure, not a holder. If it still holds ≥1M KEYCAT it is EXCHANGE-LIKE (a CEX hot wallet or
// market maker: coins sent to it are deposits); otherwise it is a ROUTER (aggregator, MEV bot,
// settlement contract: coins pass straight through, so a send to it is a trade).
export const RULE = { minTok: 1000, out: 300, in: 100, cpOut: 100, cpIn: 25, keepBal: SIZE_BAR };
export function classifyRows(rows, lp = LP, rule = RULE) {
  const st = new Map();
  const get = a => { let o = st.get(a); if (!o) { o = { i: 0, o: 0, ci: new Set(), co: new Set(), bal: 0 }; st.set(a, o); } return o; };
  for (const [from, to, amt] of rows) {
    const f = get(from), t = get(to);
    f.bal -= amt; t.bal += amt;
    if (amt < rule.minTok) continue;
    f.o++; t.i++;
    if (f.co.size < 400) f.co.add(to);
    if (t.ci.size < 400) t.ci.add(from);
  }
  const exchange = new Map(), router = new Set();
  for (const [a, o] of st) {
    if (lp.has(a) || a in EXCLUDE_LABELS) continue;
    if (o.o >= rule.out && o.i >= rule.in && o.co.size >= rule.cpOut && o.ci.size >= rule.cpIn) {
      if (o.bal >= rule.keepBal) exchange.set(a, { bal: Math.round(o.bal), txIn: o.i, txOut: o.o }); else router.add(a);
    }
  }
  return { exchange, router };
}

// ── FIFO wallet state ──────────────────────────────────────────────────────
export function makeBook() {
  const W = new Map();
  const get = a => { let w = W.get(a); if (!w) { w = { q: [], h: 0, bal: 0, first: 0 }; W.set(a, w); } return w; };
  const receive = (a, qty, ts, price) => { const w = get(a); w.q.push({ ts, price, qty }); w.bal += qty; if (!w.first) w.first = ts; return w; };
  // consume oldest lots; returns realized {cost, value} for the spent qty
  const send = (a, qty, price) => {
    const w = get(a); let need = qty, cost = 0;
    while (need > EPS && w.h < w.q.length) {
      const lot = w.q[w.h], take = Math.min(lot.qty, need);
      lot.qty -= take; need -= take; cost += take * lot.price;
      if (lot.qty <= EPS) { w.q[w.h] = null; w.h++; }
    }
    const moved = qty - need;               // a send beyond known lots (shouldn't happen) is ignored
    w.bal -= moved; if (w.bal < EPS) { w.bal = 0; }
    if (w.h > 64 && w.h > w.q.length / 2) { w.q = w.q.slice(w.h); w.h = 0; }
    return { cost, value: moved * price, qty: moved };
  };
  return { W, get, receive, send };
}

// Per-wallet position summary: remaining FIFO cost basis of what it still holds.
export function position(w) {
  let qty = 0, cost = 0, oldest = Infinity;
  for (let i = w.h; i < w.q.length; i++) { const l = w.q[i]; if (!l || l.qty <= EPS) continue; qty += l.qty; cost += l.qty * l.price; if (l.ts < oldest) oldest = l.ts; }
  return { qty, avg: qty > 0 ? cost / qty : 0, oldest };
}

function snapshot(book, ts, spot) {
  let held = 0, rcap = 0, profit = 0, holders = 0, big = 0, underN = 0, bigUnder = 0;
  const byBar = HOLDER_BARS.map(() => 0), underBar = HOLDER_BARS.map(() => 0);
  const age = [0, 0, 0, 0, 0], tiers = [0, 0, 0, 0, 0], bals = [];
  for (const w of book.W.values()) {
    if (w.bal <= EPS) continue;
    held += w.bal; bals.push(w.bal);
    const counted = w.bal >= HOLDER_MIN;
    if (counted) holders++;
    for (let i = 0; i < HOLDER_BARS.length; i++) if (w.bal >= HOLDER_BARS[i]) byBar[i]++;
    let wc = 0;
    for (let i = w.h; i < w.q.length; i++) {
      const l = w.q[i]; if (!l || l.qty <= EPS) continue;
      rcap += l.qty * l.price; wc += l.qty * l.price;
      if (spot >= l.price) profit += l.qty;
      age[ageBand((ts - l.ts) / DAY)] += l.qty;
    }
    const under = wc / w.bal > spot;
    if (under && counted) underN++;
    if (under) for (let i = 0; i < HOLDER_BARS.length; i++) if (w.bal >= HOLDER_BARS[i]) underBar[i]++;
    if (w.bal >= SIZE_BAR) { big++; if (under) bigUnder++; }
    let t = 0; while (t < TIERS.length && w.bal >= TIERS[t]) t++; tiers[t] += w.bal;
  }
  bals.sort((a, b) => b - a);
  const top = n => held ? +(100 * bals.slice(0, n).reduce((s, x) => s + x, 0) / held).toFixed(2) : 0;
  const pct = x => held ? +(100 * x / held).toFixed(2) : 0;
  const rp = held ? rcap / held : 0;
  return {
    d: iso(ts), price: +spot.toPrecision(6), holders, big, byBar, underBar: underBar.map((u, i) => (byBar[i] ? +(100 * u / byBar[i]).toFixed(1) : 0)),
    underPct: holders ? +(100 * underN / holders).toFixed(2) : 0,
    bigUnderPct: big ? +(100 * bigUnder / big).toFixed(2) : 0,
    sip: pct(profit), rp: +rp.toPrecision(6), mvrv: rp ? +(spot / rp).toFixed(4) : 0,
    held: Math.round(held), age: age.map(pct), tiers: tiers.map(pct), top10: top(10), top100: top(100),
  };
}

async function main() {
  const prices = JSON.parse(readFileSync(new URL("../data/price_onchain.json", import.meta.url)));
  const priceAt = makePriceAt(prices.map(([d, p]) => [d, p]));
  const scale = 10 ** TOKEN.decimals;
  const csvPath = new URL("../data/transfers.csv", import.meta.url);
  const readRows = async function* () {
    const rl = createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line || line.startsWith("block")) continue;
      const [, , from, to, time, raw] = line.split(",");
      const amt = Number(raw) / scale;
      if (amt > EPS) yield [from, to, amt, time];
    }
  };
  const pre = [];
  for await (const r of readRows()) pre.push([r[0], r[1], r[2]]);
  const { exchange, router } = classifyRows(pre);
  pre.length = 0;
  console.log(`classified ${exchange.size} exchange-like wallets, ${router.size} routers`);
  const MARKET = new Set([...LP, ...router]);
  const EXCL = new Set([...Object.keys(EXCLUDE_LABELS), ...exchange.keys(), ...router]);
  const book = makeBook();
  const weeks = new Map();            // Monday → flow counters
  const wk = ts => { const d = new Date(ts); const dow = (d.getUTCDay() + 6) % 7; return iso(Math.floor(ts / DAY) * DAY - dow * DAY); };
  const W = k => { let o = weeks.get(k); if (!o) { o = { buyTok: 0, sellTok: 0, buyUsd: 0, sellUsd: 0, buyers: new Set(), sellers: new Set(), newW: 0, exitW: 0, newBig: 0, exitBig: 0, cexIn: 0, cexOut: 0, netBuyUsd: 0, netSellUsd: 0, netBuyTok: 0, netSellTok: 0, netBuyers: 0, netSellers: 0, rProfit: 0, rLoss: 0, sellsInLossUsd: 0, sellsInProfitUsd: 0 }; weeks.set(k, o); } return o; };

  let n = 0, snaps = [], nextSnap = null, lastTs = 0;
  // Per-wallet NET market flow within the current week. Arbitrage/MEV bots buy on one pool and sell
  // on another in the same week, so gross buys ≈ gross sells; netting per wallet cancels them and
  // leaves the real direction of money.
  let wkNet = new Map(), wkKey = null;
  const flushWeek = () => {
    if (!wkKey) return;
    const o = W(wkKey);
    for (const [, v] of wkNet) {
      if (Math.abs(v.usd) < NET_MIN_USD) continue;
      if (v.usd > 0) { o.netBuyUsd += v.usd; o.netBuyTok += v.tok; o.netBuyers++; }
      else { o.netSellUsd += -v.usd; o.netSellTok += -v.tok; o.netSellers++; }
    }
    wkNet = new Map();
  };
  const addNet = (a, tok, usd) => { let v = wkNet.get(a); if (!v) { v = { tok: 0, usd: 0 }; wkNet.set(a, v); } v.tok += tok; v.usd += usd; };
  let prevBig = new Set();
  const bigSet = () => { const s = new Set(); for (const [a, w] of book.W) if (w.bal >= SIZE_BAR) s.add(a); return s; };
  // balance checkpoints 30 / 90 days before the last price day → "is the whale adding or selling?"
  const endTs = Date.parse(prices.at(-1)[0]) + DAY;
  const cps = [{ d: 90, ts: endTs - 90 * DAY, bal: null }, { d: 30, ts: endTs - 30 * DAY, bal: null }];
  const takeCp = ts => { for (const c of cps) if (!c.bal && ts >= c.ts) { c.bal = new Map(); for (const [a, w] of book.W) if (w.bal > EPS) c.bal.set(a, w.bal); } };
  for await (const [from, to, amt, time] of readRows()) {
    const ts = Date.parse(time);
    // weekly snapshot BEFORE applying the first transfer of a new week (state as of Monday 00:00)
    const k = wk(ts);
    if (nextSnap === null) nextSnap = Date.parse(k) + 7 * DAY;
    while (ts >= nextSnap) {
      const sn = snapshot(book, nextSnap - 1, priceAt(nextSnap - DAY));
      const cur = bigSet();
      sn.bigIn = [...cur].filter(a => !prevBig.has(a)).length;
      sn.bigOut = [...prevBig].filter(a => !cur.has(a)).length;
      prevBig = cur;
      snaps.push(sn); nextSnap += 7 * DAY;
    }
    if (k !== wkKey) { flushWeek(); wkKey = k; }
    takeCp(ts);
    lastTs = ts;
    const p = priceAt(ts), o = W(k);
    const fromLP = MARKET.has(from), toLP = MARKET.has(to);
    if (exchange.has(to) && !EXCL.has(from)) o.cexIn += amt;
    if (exchange.has(from) && !EXCL.has(to)) o.cexOut += amt;
    if (fromLP && !EXCL.has(to)) { o.buyTok += amt; o.buyUsd += amt * p; o.buyers.add(to); addNet(to, amt, amt * p); }
    if (toLP && !EXCL.has(from)) { o.sellTok += amt; o.sellUsd += amt * p; o.sellers.add(from); addNet(from, -amt, -amt * p); }
    if (!EXCL.has(from)) {
      const w = book.get(from), was = w.bal, wasBig = was >= SIZE_BAR;
      const r = book.send(from, amt, p);
      if (toLP) {                        // a DEX sale: realized profit or loss on the coins sold
        const pl = r.value - r.cost;
        if (pl >= 0) { o.rProfit += pl; o.sellsInProfitUsd += r.value; } else { o.rLoss += -pl; o.sellsInLossUsd += r.value; }
      }
      if (was > EPS && w.bal <= EPS) o.exitW++;
      if (wasBig && w.bal < SIZE_BAR) o.exitBig++;
    }
    if (!EXCL.has(to)) {
      const w = book.get(to), was = w.bal;
      w.rin = (w.rin || 0) + amt; if (exchange.has(from)) w.rinEx = (w.rinEx || 0) + amt;
      book.receive(to, amt, ts, p);
      if (was <= EPS) o.newW++;
      if (was < SIZE_BAR && w.bal >= SIZE_BAR) o.newBig++;
    }
    if (++n % 1_000_000 === 0) console.log(`  ${n} transfers · ${iso(ts)} · ${book.W.size} wallets`);
  }
  flushWeek();
  // final snapshot at the latest price
  const spot = prices.at(-1)[1];
  const fin = snapshot(book, lastTs, spot), finBig = bigSet();
  fin.bigIn = [...finBig].filter(a => !prevBig.has(a)).length;
  fin.bigOut = [...prevBig].filter(a => !finBig.has(a)).length;
  snaps.push(fin);
  console.log(`replayed ${n} transfers → ${book.W.size} wallets ever`);

  // ── current per-wallet distribution: how deep is the damage? ──
  const depth = [0, 0, 0, 0, 0, 0];     // P&L on remaining position: ≤-90 · -90..-75 · -75..-50 · -50..0 · 0..+100 · >+100 %
  const depthSup = [0, 0, 0, 0, 0, 0];
  const bucket = r => (r <= -0.9 ? 0 : r <= -0.75 ? 1 : r <= -0.5 ? 2 : r < 0 ? 3 : r <= 1 ? 4 : 5);
  const top = [];
  const now = lastTs;
  // 30/90-day balance deltas for the biggest holders, from the lots' timestamps is not enough (sends
  // consume lots) — so we recompute from the weekly log below using a second light pass.
  for (const [a, w] of book.W) {
    if (w.bal <= EPS) continue;
    const pos = position(w), r = pos.avg > 0 ? spot / pos.avg - 1 : 0, b = bucket(r);
    if (w.bal >= SIZE_BAR) { depth[b]++; depthSup[b] += w.bal; }
    top.push({ a, bal: w.bal, avg: pos.avg, pnl: r, since: iso(w.first), heldDays: Math.round((now - pos.oldest) / DAY),
      fromEx: w.rin ? +(100 * (w.rinEx || 0) / w.rin).toFixed(1) : 0 });   // share of everything it ever received that came from exchange-like wallets
  }
  top.sort((x, y) => y.bal - x.bal);
  const cpBal = (d, a) => cps.find(c => c.d === d)?.bal?.get(a) ?? 0;
  const top50 = top.slice(0, 50).map(t => ({ ...t, bal: Math.round(t.bal), avg: +t.avg.toPrecision(4), pnl: +(100 * t.pnl).toFixed(1),
    d30: Math.round(t.bal - cpBal(30, t.a)), d90: Math.round(t.bal - cpBal(90, t.a)) }));
  // Whole-cohort behaviour of the ≥1M holders over the last 30 / 90 days (by wallet, not by owner).
  const cohort = {};
  for (const c of cps) {
    let add = 0, cut = 0, flat = 0, gone = 0, fresh = 0, net = 0;
    const seen = new Set();
    for (const [a, then] of c.bal) {
      if (then < SIZE_BAR) continue;
      seen.add(a);
      const nowB = book.W.get(a)?.bal ?? 0, dlt = nowB - then; net += dlt;
      if (nowB <= EPS) gone++; else if (dlt > then * 0.05) add++; else if (dlt < -then * 0.05) cut++; else flat++;
    }
    for (const [a, w] of book.W) if (w.bal >= SIZE_BAR && !seen.has(a) && (c.bal.get(a) ?? 0) < SIZE_BAR) { fresh++; net += w.bal - (c.bal.get(a) ?? 0); }
    cohort[c.d] = { add, cut, flat, gone, fresh, net: Math.round(net) };
  }

  const weekly = [...weeks].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([d, o]) => ({
    d, buyUsd: Math.round(o.buyUsd), sellUsd: Math.round(o.sellUsd), netUsd: Math.round(o.buyUsd - o.sellUsd),
    buyTok: Math.round(o.buyTok), sellTok: Math.round(o.sellTok),
    netBuyUsd: Math.round(o.netBuyUsd), netSellUsd: Math.round(o.netSellUsd), netBuyTok: Math.round(o.netBuyTok), netSellTok: Math.round(o.netSellTok),
    netBuyers: o.netBuyers, netSellers: o.netSellers,
    buyers: o.buyers.size, sellers: o.sellers.size, cexIn: Math.round(o.cexIn), cexOut: Math.round(o.cexOut), newW: o.newW, exitW: o.exitW, newBig: o.newBig, exitBig: o.exitBig,
    rProfit: Math.round(o.rProfit), rLoss: Math.round(o.rLoss),
    lossSharePct: o.sellsInLossUsd + o.sellsInProfitUsd ? +(100 * o.sellsInLossUsd / (o.sellsInLossUsd + o.sellsInProfitUsd)).toFixed(1) : null,
  }));

  const out = {
    token: TOKEN, updated: iso(lastTs), holderBars: HOLDER_BARS, netMinUsd: NET_MIN_USD, transfers: n, walletsEver: book.W.size, sizeBar: SIZE_BAR,
    prices: prices.map(([d, p]) => [d, +p.toPrecision(6)]),
    weekly, snaps,
    depth: { labels: ["≤ −90%", "−90 to −75%", "−75 to −50%", "−50 to 0%", "0 to +100%", "> +100%"], wallets: depth, supply: depthSup.map(Math.round) },
    top50, cohort,
    rule: RULE, exchangeLike: [...exchange].map(([a, v]) => ({ a, ...v })).sort((x, y) => y.bal - x.bal), routers: router.size,
    exclude: EXCLUDE_LABELS,
  };
  writeFileSync(new URL("../public/report.json", import.meta.url), JSON.stringify(out));
  const c = snaps.at(-1);
  console.log(`✓ report.json — ${c.d}: price $${c.price} · holders ${c.holders} (≥1M: ${c.big}) · underwater ${c.underPct}% of wallets, ${c.bigUnderPct}% of ≥1M · supply in profit ${c.sip}% · realized $${c.rp} · MVRV ${c.mvrv}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) main().catch(e => { console.error(e); process.exit(1); });
