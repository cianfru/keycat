# KEYCAT on-chain holder report

Reproducible holder analytics for **Keyboard Cat (KEYCAT)** on Base
(`0x9a26f5433671751c3276a065f57e5a02d2817973`), built the same way as the SPX6900 work in
[`cianfru/the_terminal`](https://github.com/cianfru/the_terminal): every number comes from public
chain data and can be regenerated with the three commands below. No API keys needed.

## What it answers

- **Underwater:** how many wallets hold KEYCAT at a loss, and how deep (FIFO cost basis per wallet).
- **Buying pressure:** weekly DEX buys vs sells (USD and KEYCAT), buyer and seller counts.
- **Exits:** holders over time, wallets crossing the 1M-KEYCAT bar, realized profit/loss of sellers.
- **Big holders:** what wallets with 1M+ KEYCAT did over the last 30 and 90 days.

## Reproduce

```sh
python3 scripts/pull_transfers_rpc.py     # every Transfer log since launch → data/transfers.csv (~20-40 min, public RPCs)
python3 scripts/pull_price_onchain.py     # daily price from the V2 pool's reserves × Coinbase ETH/USD
node --max-old-space-size=6000 scripts/analyze.mjs   # FIFO replay → public/report.json
node --max-old-space-size=7000 scripts/recent.mjs   # last 90 days vs the two windows before → public/recent.json
python3 scripts/spx_pull.py               # SPX6900 (Ethereum) transfers: the_terminal's public archive + a public-RPC tail
TOKEN_PROFILE=spx node --max-old-space-size=7000 scripts/recent.mjs   # same analysis on SPX → public/recent-spx.json
node scripts/build-report.mjs             # → report/keycat-report.html (self-contained page)
node --test test/*.test.mjs
```

`data/transfers.csv` is not committed (it's large); the pull is resumable. Token constants and the
excluded addresses (pools, burn, null) live in `config.mjs`. Exchange-like wallets and routers are found by a behavioural rule in `scripts/analyze.mjs` (`RULE`). `data/geckoterminal_365d.json` is the independent price series the on-chain price was checked against.

## Method in one paragraph

Each wallet's coins are kept as lots in the order received; a send uses the oldest lots first. A
receive from anyone (a DEX buy, an airdrop, a transfer from another wallet) is priced at that day's
market price. Coins leaving a pool to a wallet are buys, coins sent into a pool are sells. Pools,
the null address and the burn address are not holders. Exchange wallets are **not tagged yet**, so
an exchange hot wallet among the top holders counts as a holder; check the top-holders table.
"Holders" are addresses, not people.

## Peer comparison: SPX6900, FARTCOIN, BOME, KEYCAT

A current holder snapshot of all four on the same dollar scale (`report/memecoin-holders.html`):

```sh
python3 scripts/sol_snapshot.py bome ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82
python3 scripts/sol_snapshot.py fartcoin 9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump
python3 scripts/sol_snapshot.py spxsol J3NKxxXZcnNiMjKw9hYb2K4LUxgwB6t1FtPtQVsv3KFr
python3 scripts/sol_classify.py bome fartcoin spxsol   # hot-wallet test for the 40 largest owners
python3 scripts/peers.py                                # needs data/spx/transfers.csv + data/transfers.csv
node scripts/build-peers.mjs
```

A snapshot shows who holds today, not who bought or sold; Solana has no free full transfer history.
