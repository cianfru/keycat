"""Daily KEYCAT/USD reconstructed from the chain — no price API needed for the launch era.

For every UTC day since launch: read the Uniswap V2 KEYCAT/WETH pair's reserves (getReserves) at
the 12:00 UTC block via an archive eth_call on a public Base RPC, KEYCAT-per-WETH = r1/r0 (token0
is WETH 0x4200…0006), times Coinbase's ETH-USD daily close. Base blocks are exactly 2s apart, so
the block for any timestamp is computed, not searched.

Cross-checked against GeckoTerminal's daily closes over the last year (see the report).
Writes data/price_onchain.json = [[YYYY-MM-DD, usd, pool_weth]].

  python3 scripts/pull_price_onchain.py
"""
import json, subprocess, time, datetime as dt
from concurrent.futures import ThreadPoolExecutor

PAIR = "0x377feeed4820b3b28d1ab429509e7a0789824fca"
START = 12315000
RPCS = ["https://mainnet.base.org", "https://developer-access-mainnet.base.org", "https://base.gateway.tenderly.co"]


def post(url, method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    for a in range(10):
        try:
            out = subprocess.run(["curl", "-sS", "-m", "40", "-X", "POST", "-H", "content-type: application/json", url, "-d", body],
                                 capture_output=True, text=True).stdout
            d = json.loads(out)
            if "result" in d:
                return d["result"]
        except Exception:
            pass
        time.sleep(2 + a)
    raise RuntimeError(f"{method} failed")


def get(u):
    for a in range(6):
        try:
            return json.loads(subprocess.run(["curl", "-sS", "-m", "60", u], capture_output=True, text=True).stdout)
        except Exception:
            time.sleep(3 * (a + 1))


def main():
    t_start = int(post(RPCS[0], "eth_getBlockByNumber", [hex(START), False])["timestamp"], 16)
    head = int(post(RPCS[0], "eth_blockNumber", []), 16)
    eth, s = {}, dt.datetime(2024, 3, 20)
    while s < dt.datetime.utcnow():
        e = s + dt.timedelta(days=290)
        for t, lo, hi, op, cl, v in get(f"https://api.exchange.coinbase.com/products/ETH-USD/candles?granularity=86400&start={s:%Y-%m-%d}&end={e:%Y-%m-%d}"):
            eth[dt.datetime.utcfromtimestamp(t).strftime("%Y-%m-%d")] = cl
        s = e
        time.sleep(0.4)
    days = []
    d = dt.datetime(2024, 3, 26, 12, tzinfo=dt.timezone.utc)
    while True:
        b = START + (int(d.timestamp()) - t_start) // 2
        if b > head:
            break
        days.append((d.strftime("%Y-%m-%d"), b))
        d += dt.timedelta(days=1)

    def one(i_day):
        i, (ds, b) = i_day
        r = post(RPCS[i % len(RPCS)], "eth_call", [{"to": PAIR, "data": "0x0902f1ac"}, hex(b)])[2:]
        weth, key = int(r[:64], 16), int(r[64:128], 16)
        return ds, weth, key

    with ThreadPoolExecutor(4) as ex:
        res = list(ex.map(one, enumerate(days)))
    out = [[ds, weth / key * eth[ds], weth / 1e18] for ds, weth, key in res if key and weth and ds in eth]
    json.dump(out, open("data/price_onchain.json", "w"))
    print(len(out), out[0], out[-1])


if __name__ == "__main__":
    main()
