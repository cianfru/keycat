// KEYCAT — the single source of token constants. Every script and the site import from here.
export const TOKEN = {
  symbol: "KEYCAT",
  name: "Keyboard Cat",
  chain: "base",
  address: "0x9a26f5433671751c3276a065f57e5a02d2817973",
  decimals: 18,
  totalSupply: 10_000_000_000,
  // First swap on the main pool (Uniswap V2 KEYCAT/WETH) — DexScreener pairCreatedAt 2024-03-26.
  launch: "2024-03-26",
  mainPool: "0x377feeed4820b3b28d1ab429509e7a0789824fca",
};

// Addresses that are NOT holders. Address-keyed (never match on a ticker). `kind` decides how the
// supply is classified: null/burn = out of supply, lp = DEX liquidity (liquid), cex = exchange /
// market-maker inventory (liquid). ONLY confirmed infrastructure goes here — an unknown big wallet
// stays a holder until someone verifies it on Basescan (a wrong exclusion overstates liquidity,
// a missing one invents a whale; both are errors, the second is at least visible in the top list).
export const EXCLUDE_LABELS = {
  "0x0000000000000000000000000000000000000000": { name: "null / mint source", kind: "null" },
  "0x000000000000000000000000000000000000dead": { name: "burn", kind: "burn" },
  "0x377feeed4820b3b28d1ab429509e7a0789824fca": { name: "Uniswap V2: KEYCAT/WETH", kind: "lp" },
  "0xd82403772cb858219cfb58bfab46ba7a31073474": { name: "Uniswap V3: KEYCAT/WETH", kind: "lp" },
  "0xb211a9ddff3a10806c8fdb92dbc4c34596a23f84": { name: "Aerodrome: KEYCAT/WETH", kind: "lp" },
  "0x3b9ddad7459fdfcfdb7117d53301182dd46b7042": { name: "Uniswap V2: KEYCAT/VIRTUAL", kind: "lp" },
  "0x860c135ac0156b18cf0771274597e3f98526a0bc": { name: "Uniswap V3: KEYCAT/USDC", kind: "lp" },
  "0xd8c51d2998b239af635e238fa2a0d490af692222": { name: "Uniswap V3: KEYCAT/TOSHI", kind: "lp" },
  "0x498581ff718922c3f8e6a244956af099b2652b2b": { name: "Uniswap V4: PoolManager", kind: "lp" },
};
export const EXCLUDE = new Set(Object.keys(EXCLUDE_LABELS));
