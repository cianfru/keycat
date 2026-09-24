"""Pull every KEYCAT Transfer log on Base from KEYLESS public RPCs (eth_getLogs).

Public nodes cap getLogs ranges (base.org 2,000 blocks, Tenderly 1,000), so the history
launch->head is cut into 1,000-block chunks and fanned out across endpoints; a chunk that errors
is re-queued (rate limits are routine) and a chunk the node says is too big is split in half.
Resumable: finished chunk starts are appended to data/rpc_done.txt, rows to data/rpc_rows.csv.
The final data/transfers.csv is sorted by (block, logIndex) — exact on-chain order, so the FIFO
engine needs no same-block heuristic.

  python3 scripts/pull_transfers_rpc.py
"""
import json, os, queue, subprocess, threading, time, datetime as dt

TOKEN = "0x9a26f5433671751c3276a065f57e5a02d2817973"
TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
START = 12315000          # just before KEYCAT's first log (2024-03-26)
CHUNK = 1000
ENDPOINTS = [
    ("https://developer-access-mainnet.base.org", 4),
    ("https://mainnet.base.org", 4),
    ("https://base.gateway.tenderly.co", 1),
    ("https://gateway.tenderly.co/public/base", 1),
]
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
ROWS, DONE = os.path.join(D, "rpc_rows.csv"), os.path.join(D, "rpc_done.txt")
lock = threading.Lock()


def rpc(url, method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    out = subprocess.run(["curl", "-sS", "-m", "60", "-X", "POST", "-H", "content-type: application/json",
                          url, "-d", body], capture_output=True, text=True).stdout
    return json.loads(out)


def worker(url, q, stats):
    while stats["pending"] > 0:
        try:
            a, b = q.get(timeout=5)
        except queue.Empty:
            continue
        try:
            d = rpc(url, "eth_getLogs", [{"address": TOKEN, "topics": [TOPIC],
                                         "fromBlock": hex(a), "toBlock": hex(b)}])
        except Exception:
            d = {"error": {"message": "transport"}}
        if "result" in d:
            lines = []
            for l in d["result"]:
                if len(l["topics"]) < 3:
                    continue
                v = int(l["data"], 16) if l["data"] not in ("0x", "") else 0
                lines.append(f'{int(l["blockNumber"], 16)},{int(l["logIndex"], 16)},'
                             f'0x{l["topics"][1][-40:]},0x{l["topics"][2][-40:]},{v}\n')
            with lock:
                with open(ROWS, "a") as f:
                    f.writelines(lines)
                with open(DONE, "a") as f:
                    f.write(f"{a},{b}\n")
                stats["pending"] -= 1
                stats["rows"] += len(lines)
                stats["done"] += 1
        else:
            msg = str(d.get("error", {}).get("message", "")).lower()
            too_big = any(k in msg for k in ("more than", "response size", "too large", "too many results", "exceed"))
            if b > a and too_big and "rate" not in msg:
                m = (a + b) // 2
                with lock:
                    stats["pending"] += 1
                q.put((a, m))
                q.put((m + 1, b))
            else:
                q.put((a, b))
                time.sleep(3)


def main():
    os.makedirs(D, exist_ok=True)
    head = int(rpc(ENDPOINTS[0][0], "eth_blockNumber", [])["result"], 16)
    # Resume by COVERAGE, not by chunk start: a split chunk records its halves separately, so a
    # chunk is skipped only when the union of finished [a,b] intervals covers it completely.
    ivs = []
    if os.path.exists(DONE):
        for x in open(DONE):
            a, b = x.strip().split(",")
            ivs.append((int(a), int(b)))
    ivs.sort()
    merged = []
    for a, b in ivs:
        if merged and a <= merged[-1][1] + 1:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    todo = []
    for a in range(START, head + 1, CHUNK):
        b = min(a + CHUNK - 1, head)
        cur = a
        for ma, mb in merged:
            if mb < cur or ma > b:
                continue
            if ma > cur:
                todo.append((cur, ma - 1))
            cur = max(cur, mb + 1)
        if cur <= b:
            todo.append((cur, b))
    chunks = todo
    done = merged
    q = queue.Queue()
    for c in chunks:
        q.put(c)
    stats = {"pending": len(chunks), "rows": 0, "done": 0}
    print(f"head {head}: {len(chunks)} ranges to pull", flush=True)
    ths = [threading.Thread(target=worker, args=(u, q, stats), daemon=True) for u, n in ENDPOINTS for _ in range(n)]
    for t in ths:
        t.start()
    t0 = time.time()
    while stats["pending"] > 0:
        time.sleep(30)
        rate = stats["done"] / (time.time() - t0)
        eta = stats["pending"] / rate / 60 if rate else 0
        print(f"  {stats['done']}/{len(chunks)} chunks · {stats['rows']} rows · {rate:.1f} ch/s · eta {eta:.0f} min", flush=True)

    # Base (OP stack) produces a block every 2s exactly, so ts = t(START) + 2*(block-START).
    # Verified against the real head header rather than assumed.
    t_start = int(rpc(ENDPOINTS[0][0], "eth_getBlockByNumber", [hex(START), False])["result"]["timestamp"], 16)
    t_head = int(rpc(ENDPOINTS[0][0], "eth_getBlockByNumber", [hex(head), False])["result"]["timestamp"], 16)
    assert t_head == t_start + 2 * (head - START), "Base block time is not a constant 2s — interpolation invalid"

    rows = []
    with open(ROWS) as f:
        for line in f:
            b, li, fr, to, v = line.rstrip().split(",")
            rows.append((int(b), int(li), fr, to, v))
    rows.sort()
    out, last = 0, None
    with open(os.path.join(D, "transfers.csv"), "w") as f:
        f.write("block,log_index,sender,receiver,time,value\n")
        for b, li, fr, to, v in rows:
            if (b, li) == last:
                continue
            last = (b, li)
            ts = dt.datetime.fromtimestamp(t_start + 2 * (b - START), dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            f.write(f"{b},{li},{fr},{to},{ts},{v}\n")
            out += 1
    print(f"✓ transfers.csv: {out} transfers to block {head}", flush=True)


if __name__ == "__main__":
    main()
