"""Holder structure of SPX6900, FARTCOIN, BOME and KEYCAT on the same dollar scale.

Wallet balances: Solana tokens from sol_snapshot.py (program-owned accounts and exchange-like
wallets from sol_classify.py removed); SPX on Ethereum and KEYCAT on Base from the full transfer
replays (labelled infrastructure and behavioural exchange-like wallets removed). Balances are
valued at one CoinGecko price fetch. Wallets, not people: one person can hold several wallets and
SPX's holders span chains (Base, ~3% of SPX's value, is not included here).

Also pulls 365 days of price / market cap / volume from CoinGecko for the 90-day trend.
Writes public/peers.json.

  python3 scripts/peers.py
"""
import csv, json, subprocess, time, importlib.util
from collections import defaultdict

CG = {"spx": "spx6900", "fartcoin": "fartcoin", "bome": "book-of-meme", "keycat": "keyboard-cat-base"}
TIERS = [10, 100, 1_000, 10_000, 100_000]


def get(u):
    for a in range(8):
        try:
            d = json.loads(subprocess.run(["curl", "-sS", "-m", "60", u], capture_output=True, text=True).stdout)
            if isinstance(d, (list, dict)) and not (isinstance(d, dict) and d.get("status", {}).get("error_code")):
                return d
        except Exception:
            pass
        time.sleep(15 * (a + 1))
    raise RuntimeError(u)


def evm_balances(path, decimals, exclude):
    bal = defaultdict(int)
    with open(path) as f:
        r = csv.reader(f); next(r)
        for _, _, fr, to, _, v in r:
            v = int(v); bal[fr] -= v; bal[to] += v
    return {a: b / 10 ** decimals for a, b in bal.items() if b > 0 and a not in exclude}


def js_labels(path):
    """Read EXCLUDE_LABELS from a config .mjs via node (addresses → kind)."""
    out = subprocess.run(["node", "--input-type=module", "-e",
                          f"import {{ EXCLUDE_LABELS }} from '{path}'; console.log(JSON.stringify(EXCLUDE_LABELS))"],
                         capture_output=True, text=True).stdout
    return json.loads(out)


def sol_balances(name, act):
    d = json.load(open(f"data/sol/{name}.json"))
    return {a: b for a, b, pda in d["owners"] if not pda and not act.get(a, {}).get("exchangeLike")}, d


def structure(bals, price, circ):
    v = sorted(bals.values(), reverse=True)
    held = sum(v)
    usd = [x * price for x in v]
    tiers = {t: sum(1 for u in usd if u >= t) for t in TIERS}
    return {
        "wallets": {str(t): n for t, n in tiers.items()},
        "perMcapMillion": {str(t): round(n / (price * circ / 1e6), 1) for t, n in tiers.items()},
        "medianUsdOf100plus": round(sorted([u for u in usd if u >= 100])[len([u for u in usd if u >= 100]) // 2], 0),
        "top10PctOfHeld": round(100 * sum(v[:10]) / held, 1), "top100PctOfHeld": round(100 * sum(v[:100]) / held, 1),
        "heldPctOfCirc": round(100 * held / circ, 1),
        "top": [[a, round(b)] for a, b in sorted(bals.items(), key=lambda kv: -kv[1])[:15]],
    }


def trend(cg_id):
    d = get(f"https://api.coingecko.com/api/v3/coins/{cg_id}/market_chart?vs_currency=usd&days=365&interval=daily")
    p, m, vol = d["prices"], d["market_caps"], d["total_volumes"]
    def win(a, b):   # days-ago window [a, b)
        s = slice(len(p) - b, len(p) - a)
        pv, vv, mv = p[s], vol[s], m[s]
        return {"priceChangePct": round(100 * (pv[-1][1] / pv[0][1] - 1), 1),
                "avgVolUsd": round(sum(x[1] for x in vv) / len(vv)),
                "avgTurnoverPct": round(100 * sum(x[1] / max(y[1], 1) for x, y in zip(vv, mv)) / len(vv), 2)}
    return {"last90": win(0, 90), "prior90": win(90, 180), "yearChangePct": round(100 * (p[-1][1] / p[0][1] - 1), 1),
            "series": [[time.strftime("%Y-%m-%d", time.gmtime(t / 1000)), round(x, 8), round(v)] for (t, x), (_, v) in zip(p, vol)]}


def main():
    mk = get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" + ",".join(CG.values()))
    mk = {c["id"]: c for c in mk}
    act = json.load(open("data/sol/activity.json"))
    out = {"taken": time.strftime("%Y-%m-%d"), "tiers": TIERS, "coins": {}}

    # SPX: Ethereum (replay) + Solana (snapshot)
    spx_lab = js_labels("/home/user/keycat/config-spx.mjs")
    spx_eth = evm_balances("data/spx/transfers.csv", 8, set(spx_lab))
    spx_sol, _ = sol_balances("spxsol", act)
    kc_lab = js_labels("/home/user/keycat/config.mjs")
    rep = json.load(open("public/report.json"))
    kc_ex = set(kc_lab) | {e["a"] for e in rep["exchangeLike"]}
    keycat = evm_balances("data/transfers.csv", 18, kc_ex)
    fart, fd = sol_balances("fartcoin", act)
    bome, bd = sol_balances("bome", act)
    sets = {"spx": {**{("eth:" + a): b for a, b in spx_eth.items()}, **{("sol:" + a): b for a, b in spx_sol.items()}},
            "fartcoin": fart, "bome": bome, "keycat": keycat}
    chains = {"spx": "Ethereum + Solana", "fartcoin": "Solana", "bome": "Solana", "keycat": "Base"}
    for k, cid in CG.items():
        c = mk[cid]
        s = structure(sets[k], c["current_price"], c["circulating_supply"])
        out["coins"][k] = {"name": c["name"], "symbol": c["symbol"].upper(), "chains": chains[k], "price": c["current_price"],
                           "mcap": c["market_cap"], "vol24": c["total_volume"], "ath": c["ath"], "athDate": c["ath_date"][:10],
                           "fromAthPct": round(c["ath_change_percentage"], 1), "circ": c["circulating_supply"], **s, "trend": trend(cid)}
        print(k, json.dumps({x: out["coins"][k][x] for x in ["mcap", "wallets", "perMcapMillion", "medianUsdOf100plus", "top10PctOfHeld", "top100PctOfHeld", "heldPctOfCirc"]}))
        print("   trend", out["coins"][k]["trend"]["last90"], out["coins"][k]["trend"]["prior90"], "1y", out["coins"][k]["trend"]["yearChangePct"])
        time.sleep(8)
    out["coins"]["spx"]["chainSplit"] = {"eth": len(spx_eth), "sol": len(spx_sol)}
    json.dump(out, open("public/peers.json", "w"))


if __name__ == "__main__":
    main()
