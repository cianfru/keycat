"""Behavioural exchange test for the largest owners of each Solana snapshot, keyless.

A wallet whose most recent 1,000 transactions all happened within 24 hours is doing exchange /
market-maker volume, not holding. We check the top N on-curve owners of each token (program-owned
accounts are already flagged by sol_snapshot.py). Results cached in data/sol/activity.json.

  python3 scripts/sol_classify.py bome fartcoin spxsol [--top=40]
"""
import json, os, subprocess, sys, time

RPC = "https://api.mainnet-beta.solana.com"
CACHE = "data/sol/activity.json"


def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    for a in range(8):
        try:
            d = json.loads(subprocess.run(["curl", "-sS", "-m", "60", "-X", "POST", "-H", "content-type: application/json", RPC, "-d", body],
                                          capture_output=True, text=True).stdout)
            if "result" in d:
                return d["result"]
        except Exception:
            pass
        time.sleep(3 * (a + 1))
    raise RuntimeError(method)


def activity(addr):
    sigs = rpc("getSignaturesForAddress", [addr, {"limit": 1000}])
    ts = [s["blockTime"] for s in sigs if s.get("blockTime")]
    span_h = (max(ts) - min(ts)) / 3600 if len(ts) > 1 else None
    return {"sigs": len(sigs), "spanHours": round(span_h, 2) if span_h is not None else None,
            "exchangeLike": len(sigs) >= 1000 and span_h is not None and span_h < 24}


def main():
    names = [a for a in sys.argv[1:] if not a.startswith("--")]
    top = int(next((a.split("=")[1] for a in sys.argv[1:] if a.startswith("--top=")), 40))
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    for n in names:
        d = json.load(open(f"data/sol/{n}.json"))
        todo = [o for o in d["owners"] if not o[2]][:top]
        for a, b, _ in todo:
            if a not in cache:
                cache[a] = activity(a)
                time.sleep(0.4)
        ex = [a for a, _, _ in todo if cache[a]["exchangeLike"]]
        share = sum(b for a, b, _ in todo if cache[a]["exchangeLike"]) / d["supply"] * 100
        print(f"{n}: {len(ex)} of top {top} owners exchange-like, {share:.1f}% of supply")
        json.dump(cache, open(CACHE, "w"))


if __name__ == "__main__":
    main()
