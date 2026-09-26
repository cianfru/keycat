"""Current holder snapshot of a Solana SPL token, keyless.

One getProgramAccounts call on the public mainnet RPC returns every token account of the mint
(owner + raw amount, via dataSlice). Balances are summed per OWNER (a wallet can have several
token accounts). Owners that are program-derived addresses (off the ed25519 curve) are pools,
vaults, lockers and other program accounts, not people; they are flagged `pda` so concentration
can be shown with and without them.

  python3 scripts/sol_snapshot.py bome ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82
  → data/sol/bome.json  {mint, decimals, supply, taken, owners: [[owner, balance, pda], ...] sorted desc}
"""
import base64, json, os, struct, subprocess, sys, datetime as dt

RPC = "https://api.mainnet-beta.solana.com"
TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58encode(b):
    n = int.from_bytes(b, "big"); s = ""
    while n:
        n, r = divmod(n, 58); s = B58[r] + s
    return "1" * (len(b) - len(b.lstrip(b"\0"))) + s


# ed25519 point decompression: an address is ON the curve iff it decodes to a valid point.
P = 2 ** 255 - 19
D_ = (-121665 * pow(121666, P - 2, P)) % P
I_ = pow(2, (P - 1) // 4, P)


def on_curve(b):
    y = int.from_bytes(b, "little") & ((1 << 255) - 1)
    if y >= P:
        return False
    u = (y * y - 1) % P
    v = (D_ * y * y + 1) % P
    x2 = u * pow(v, P - 2, P) % P
    x = pow(x2, (P + 3) // 8, P)
    if (x * x - x2) % P != 0:
        x = x * I_ % P
    return (x * x - x2) % P == 0


def rpc(method, params, timeout=300):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    out = subprocess.run(["curl", "-sS", "-m", str(timeout), "-X", "POST", "-H", "content-type: application/json", RPC, "-d", body],
                         capture_output=True, text=True).stdout
    d = json.loads(out)
    if "result" not in d:
        raise RuntimeError(str(d.get("error"))[:200])
    return d["result"]


def main(name, mint):
    sup = rpc("getTokenSupply", [mint])["value"]
    dec = sup["decimals"]
    accts = rpc("getProgramAccounts", [TOKEN_PROGRAM, {"encoding": "base64", "dataSlice": {"offset": 32, "length": 40},
                                                       "filters": [{"dataSize": 165}, {"memcmp": {"offset": 0, "bytes": mint}}]}])
    bal = {}
    for a in accts:
        raw = base64.b64decode(a["account"]["data"][0])
        owner, amt = raw[:32], struct.unpack("<Q", raw[32:40])[0]
        if amt:
            bal[owner] = bal.get(owner, 0) + amt
    owners = sorted(bal.items(), key=lambda kv: -kv[1])
    out = [[b58encode(o), v / 10 ** dec, 0 if on_curve(o) else 1] for o, v in owners]
    os.makedirs("data/sol", exist_ok=True)
    json.dump({"name": name, "mint": mint, "decimals": dec, "supply": float(sup["uiAmountString"]),
               "taken": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ"), "tokenAccounts": len(accts), "owners": out},
              open(f"data/sol/{name}.json", "w"))
    pda = sum(1 for o in out if o[2])
    print(f"✓ {name}: {len(accts)} token accounts → {len(out)} owners with a balance ({pda} program-owned) · supply {sup['uiAmountString']}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
