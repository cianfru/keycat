"""SPX6900 (Ethereum) transfers for the KEYCAT-vs-SPX comparison, keyless.

1. Downloads the public SPX transfer archive from cianfru/the_terminal's `onchain-archive`
   release (sender,receiver,time,value — full history, ends when that archive was last uploaded).
2. Fills the gap from the archive's last timestamp to the chain head with eth_getLogs on public
   Ethereum RPCs (1,000-block ranges), keeping only logs strictly newer than the archive.
3. Writes data/spx/transfers.csv in the same shape analyze/recent scripts read:
   block,log_index,sender,receiver,time,value (block/log_index = 0 for archive rows, which are
   already in time order; value = raw 8-decimal integer).

  python3 scripts/spx_pull.py
"""
import gzip, json, os, subprocess, time, datetime as dt
from concurrent.futures import ThreadPoolExecutor

TOKEN = "0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c"
TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
ARCHIVE = "https://github.com/cianfru/the_terminal/releases/download/onchain-archive/transfers.csv.gz"
RPCS = ["https://rpc.mevblocker.io", "https://gateway.tenderly.co/public/mainnet", "https://mainnet.gateway.tenderly.co"]
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "spx")


def rpc(url, method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    return json.loads(subprocess.run(["curl", "-sS", "-m", "60", "-X", "POST", "-H", "content-type: application/json", url, "-d", body],
                                     capture_output=True, text=True).stdout)


def iso(s):  # "2026-08-26 05:46:47.000 UTC" / "2025-12-12 17:45:59 UTC" → "2026-08-26T05:46:47Z"
    return s.replace(" UTC", "").split(".")[0].replace(" ", "T") + "Z"


def main():
    os.makedirs(D, exist_ok=True)
    gz = os.path.join(D, "archive.csv.gz")
    if not os.path.exists(gz):
        subprocess.run(["curl", "-sSL", "-m", "600", "-o", gz, ARCHIVE], check=True)
    rows = []
    with gzip.open(gz, "rt") as f:
        next(f)
        for line in f:
            s, r, t, v = line.rstrip().split(",")
            rows.append((iso(t), 0, 0, s, r, v))
    rows.sort()
    last = rows[-1][0]
    last_ts = int(dt.datetime.strptime(last, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc).timestamp())
    head = int(rpc(RPCS[0], "eth_blockNumber", [])["result"], 16)
    head_ts = int(rpc(RPCS[0], "eth_getBlockByNumber", [hex(head), False])["result"]["timestamp"], 16)
    start = head - (head_ts - last_ts) // 12 - 2000          # 12s slots; a margin covers missed slots
    print(f"archive: {len(rows)} rows to {last}; pulling blocks {start}..{head}", flush=True)

    def chunk(i_a):
        i, a = i_a
        b = min(a + 999, head)
        for k in range(12):
            d = rpc(RPCS[(i + k) % len(RPCS)], "eth_getLogs", [{"address": TOKEN, "topics": [TOPIC], "fromBlock": hex(a), "toBlock": hex(b)}])
            if "result" in d:
                return d["result"]
            time.sleep(2 + k)
        raise RuntimeError(f"failed {a}-{b}")

    with ThreadPoolExecutor(3) as ex:
        results = list(ex.map(chunk, enumerate(range(start, head + 1, 1000))))
    tail = []
    for logs in results:
        for l in logs:
            ts = int(l["blockTimestamp"], 16)
            if ts <= last_ts or len(l["topics"]) < 3:
                continue
            t = dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            tail.append((t, int(l["blockNumber"], 16), int(l["logIndex"], 16), "0x" + l["topics"][1][-40:], "0x" + l["topics"][2][-40:], str(int(l["data"], 16))))
    tail.sort(key=lambda r: (r[1], r[2]))
    with open(os.path.join(D, "transfers.csv"), "w") as f:
        f.write("block,log_index,sender,receiver,time,value\n")
        for t, b, li, s, r, v in rows + tail:
            f.write(f"{b},{li},{s},{r},{t},{v}\n")
    print(f"✓ data/spx/transfers.csv: {len(rows)} archive + {len(tail)} tail rows, to {tail[-1][0] if tail else last}", flush=True)


if __name__ == "__main__":
    main()
