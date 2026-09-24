# KEYCAT holder report — project notes

- Sister project of `cianfru/the_terminal` (SPX6900). Same north star: radical transparency, every
  number reproducible from public data, method stated, caveats labelled. No hype, no black boxes.
- Owner scope (2026-09-24): NOT a full site and NOT the rainbow (price is too far down for a power-law
  model to mean anything). A visual REPORT answering: how many holders are underwater, what holders are
  doing, buying pressure, whether people are exiting. "Don't have to be too deep for now."
- Data is keyless on purpose: Transfer logs from public Base RPCs (`scripts/pull_transfers_rpc.py`,
  base.org caps getLogs at 2,000 blocks, Tenderly at 1,000 and rate-limits hard; Blockscout's `/api`
  429s under load, drpc refuses every range on its free plan). Price = V2 pool reserves at 12:00 UTC ×
  Coinbase ETH/USD; validated vs GeckoTerminal (median 0.3% over a year). GeckoTerminal's free OHLCV
  only reaches back 365 days, hence the on-chain price.
- Base blocks are exactly 2s apart; the puller computes timestamps from the block number and asserts it
  against the head header.
- `EXCLUDE_LABELS` in config.mjs: pools, burn, null only. Exchange wallets are NOT tagged yet. Before
  publishing anything, check the top holders on Basescan and tag any exchange/team/locker wallet.
- Node's built-in fetch ignores HTTPS_PROXY in the sandbox; the Python scripts shell out to curl.
