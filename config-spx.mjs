// SPX6900 on Ethereum — for the KEYCAT-vs-SPX comparison only. Labels copied from
// cianfru/the_terminal scripts/build-onchain-local.mjs EXCLUDE_LABELS (owner-verified there).
export const TOKEN = { symbol: "SPX", name: "SPX6900", chain: "ethereum", address: "0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c", decimals: 8 };
export const EXCLUDE_LABELS = {
 "0x0000000000000000000000000000000000000000": {
  "name": "null / mint source",
  "kind": "null"
 },
 "0x000000000000000000000000000000000000dead": {
  "name": "burn",
  "kind": "burn"
 },
 "0x52c77b0cb827afbad022e6d6caf2c44452edbc39": {
  "name": "Uniswap V2: SPX",
  "kind": "lp"
 },
 "0x3ee18b2214aff97000d974cf647e7c347e8fa585": {
  "name": "Wormhole bridge",
  "kind": "bridge"
 },
 "0xf35a6bd6e0459a4b53a27862c51a2a7292b383d1": {
  "name": "CoinSpot",
  "kind": "cex"
 },
 "0x6d6cc65e2060d0a280fcd47b6c22ec5636797fec": {
  "name": "KuCoin",
  "kind": "cex"
 },
 "0xdc154fcee1babb560e8528c3a7791527f01423df": {
  "name": "BitGo custody (WalletSimple)",
  "kind": "cex"
 },
 "0x7dafba1d69f6c01ae7567ffd7b046ca03b706f83": {
  "name": "Kraken 245",
  "kind": "cex"
 },
 "0xd2dd7b597fd2435b6db61ddf48544fd931e6869f": {
  "name": "Kraken 246",
  "kind": "cex"
 },
 "0x651641299c7ec0aa44ad7ed9b7e12702fed2022f": {
  "name": "Bybit 56",
  "kind": "cex"
 },
 "0x0529ea5885702715e83923c59746ae8734c553b7": {
  "name": "Bitvavo 2",
  "kind": "cex"
 },
 "0x9b0c45d46d386cedd98873168c36efd0dcba8d46": {
  "name": "Revolut 3",
  "kind": "cex"
 },
 "0x3cc936b795a188f0e246cbb2d74c5bd190aecf18": {
  "name": "MEXC 3",
  "kind": "cex"
 },
 "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43": {
  "name": "Coinbase 10",
  "kind": "cex"
 },
 "0xdf5e3a1ed0c14a53eee240022301ecb9d267671b": {
  "name": "Kraken-linked",
  "kind": "cex"
 },
 "0x73d8bd54f7cf5fab43fe4ef40a62d390644946db": {
  "name": "Binance proxy",
  "kind": "cex"
 },
 "0xb0a3a2b60e969afd26561429aa4c1444c57e4411": {
  "name": "Bitvavo 3",
  "kind": "cex"
 },
 "0x15da7556d5ed888306839bed06f868aeaedcb0d7": {
  "name": "Revolut-linked",
  "kind": "cex"
 },
 "0x377b8ce04761754e8ac153b47805a9cf6b190873": {
  "name": "Uphold cold wallet",
  "kind": "cex"
 },
 "0xcffad3200574698b78f32232aa9d63eabd290703": {
  "name": "Crypto.com",
  "kind": "cex"
 },
 "0xab782bc7d4a2b306825de5a7730034f8f63ee1bc": {
  "name": "Bitvavo",
  "kind": "cex"
 },
 "0xa023f08c70a23abc7edfc5b6b5e171d78dfc947e": {
  "name": "Crypto.com 2",
  "kind": "cex"
 },
 "0xc882b111a75c0c657fc507c04fbfcd2cc984f071": {
  "name": "Gate.io",
  "kind": "cex"
 },
 "0x93228d328c9c74c2bfe9f97638bbb5ef322f2bd5": {
  "name": "Bybit 2",
  "kind": "cex"
 },
 "0xdd276dc5223d0120f9bf1776f38957cc8da23cb0": {
  "name": "KuCoin 2",
  "kind": "cex"
 },
 "0x91dca37856240e5e1906222ec79278b16420dc92": {
  "name": "Indodax",
  "kind": "cex"
 },
 "0x9642b23ed1e01df1092b92641051881a322f5d4e": {
  "name": "MEXC 2",
  "kind": "cex"
 },
 "0xe8c15aad9d4cd3f59c9dfa18828b91a8b2c49596": {
  "name": "KuCoin 3",
  "kind": "cex"
 },
 "0xb8e6d31e7b212b2b7250ee9c26c56cebbfbe6b23": {
  "name": "KuCoin 4",
  "kind": "cex"
 },
 "0xf8191d98ae98d2f7abdfb63a9b0b812b93c873aa": {
  "name": "Wintermute",
  "kind": "cex"
 },
 "0xa28f81ad2ba9b7f2cc37223b399622a39edb493f": {
  "name": "Wintermute 2 (suspected)",
  "kind": "cex"
 },
 "0xcc282e2004428939ee5149a9e7872f0b4d5d5ec7": {
  "name": "Kraken 3",
  "kind": "cex"
 },
 "0x21a31ee1afc51d94c2efccaa2092ad1028285549": {
  "name": "Binance",
  "kind": "cex"
 },
 "0x33a64dcdfa041befebc9161a3e0c6180cd94fa89": {
  "name": "CoinSpot 2",
  "kind": "cex"
 },
 "0x548054687ef6c56c6d82e8269e5fd93d8b88fcb2": {
  "name": "CoinEx",
  "kind": "cex"
 },
 "0x0d0707963952f2fba59dd06f2b425ace40b492fe": {
  "name": "Gate.io 1",
  "kind": "cex"
 },
 "0x6fe39f2831caf58529779efdb73341aa64df50ab": {
  "name": "Coinbase-linked",
  "kind": "cex"
 },
 "0xb51bf9029d778899d42e96ebcdc0498bd061006d": {
  "name": "Wealthsimple",
  "kind": "cex"
 },
 "0x28c6c06298d514db089934071355e5743bf21d60": {
  "name": "Binance 14",
  "kind": "cex"
 },
 "0x67336cec42645f55059eff241cb02ea5cc52ff86": {
  "name": "Bitfinex-linked",
  "kind": "cex"
 },
 "0xeff6cb8b614999d130e537751ee99724d01aa167": {
  "name": "MEV bot",
  "kind": "cex"
 },
 "0x67bda3ad12bb8e70db54b32d4613f0d2e9933a36": {
  "name": "OKX (suspected)",
  "kind": "cex"
 },
 "0x7c706586679af2ba6d1a9fc2da9c6af59883fdd3": {
  "name": "Uniswap V3: SPX",
  "kind": "lp"
 },
 "0x000000000004444c5dc75cb358380d2e3de08a90": {
  "name": "Uniswap V4: PoolManager",
  "kind": "lp"
 },
 "0x7c1c4a2cf81d2fc83b89bfd34f4d2c7e90044b32": {
  "name": "Uniswap V2: BITCOIN/SPX",
  "kind": "lp"
 },
 "0xf60c2ea62edbfe808163751dd0d8693dcb30019c": {
  "name": "Binance US",
  "kind": "cex"
 },
 "0x1a9d699aee3a56ca49d0cc3b542ae3a37885a3e1": {
  "name": "Upbit 2",
  "kind": "cex"
 },
 "0x51c72848c68a965f66fa7a88855f9f7784502a7f": {
  "name": "Market maker",
  "kind": "mm"
 },
 "0xbdb3ba9ffe392549e1f8658dd2630c141fdf47b6": {
  "name": "MEV bot",
  "kind": "mm"
 },
 "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0": {
  "name": "Kraken hot",
  "kind": "cex"
 },
 "0xf30ba13e4b04ce5dc4d254ae5fa95477800f0eb0": {
  "name": "Kraken hot 2",
  "kind": "cex"
 },
 "0xf8f061cfc030928a4acb8c4980911b4f5afc4002": {
  "name": "Bybit 3",
  "kind": "cex"
 },
 "0x963737c550e70ffe4d59464542a28604edb2ef9a": {
  "name": "HitBTC",
  "kind": "cex"
 },
 "0xd5fb306ba80ad8d695b041f98c7fa09998cd7af6": {
  "name": "Coinbase Prime custody",
  "kind": "cex"
 },
 "0x786c5328cb8e47c24b743ad4c2a8f09ef6f199cd": {
  "name": "Coinbase Prime custody 2",
  "kind": "cex"
 },
 "0xfe5d8f5c36d6bf7d4ec107d3546b19fc65ac896a": {
  "name": "Coinbase smart wallet",
  "kind": "cex"
 },
 "0x3cd751e6b0078be393132286c442345e5dc49699": {
  "name": "Coinbase 4",
  "kind": "cex"
 },
 "0x77696bb39917c91a0c3908d577d5e322095425ca": {
  "name": "Coinbase hot",
  "kind": "cex"
 },
 "0xa86309988947559b6e72ef716c5058f479386c0f": {
  "name": "Coinbase 5",
  "kind": "cex"
 },
 "0x4976a4a02f38326660d17bf34b431dc6e2eb2327": {
  "name": "Binance 2",
  "kind": "cex"
 },
 "0x9696f59e4d72e237be84ffd425dcad154bf96976": {
  "name": "Binance hot",
  "kind": "cex"
 },
 "0x46340b20830761efd32832a74d7169b29feb9758": {
  "name": "Crypto.com 3",
  "kind": "cex"
 },
 "0x1b14376ee2d46ae5c27a43d902d96d4f3f264b83": {
  "name": "KuCoin 5",
  "kind": "cex"
 },
 "0x58edf78281334335effa23101bbe3371b6a36a51": {
  "name": "KuCoin hot",
  "kind": "cex"
 },
 "0xa1d8d972560c2f8144af871db508f0b0b10a3fbf": {
  "name": "KuCoin hot 2",
  "kind": "cex"
 },
 "0x636858d62f2e81deb7fd563621faef1a6a14d6c5": {
  "name": "CoinDCX hot",
  "kind": "cex"
 },
 "0xd24400ae8bfebb18ca49be86258a3c749cf46853": {
  "name": "Gemini hot",
  "kind": "cex"
 },
 "0xf81b45b1663b7ea8716c74796d99bbe4ea26f488": {
  "name": "Ourbit",
  "kind": "cex"
 },
 "0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98": {
  "name": "Bittrex",
  "kind": "cex"
 },
 "0x077d360f11d220e4d5d831430c81c26c9be7c4a4": {
  "name": "ChangeNow hot",
  "kind": "cex"
 },
 "0x504ce9e51e508c85a161058c12e970a903d482fc": {
  "name": "Kraken-linked",
  "kind": "cex"
 },
 "0x655fe3fc7764e621ca738254eb1b90fae3461d51": {
  "name": "Kraken-linked",
  "kind": "cex"
 },
 "0x50ef5ed097913c223827636890cfb9ed492f5955": {
  "name": "CoinEx-linked",
  "kind": "cex"
 },
 "0x0802dd2edd3f9fad39a9173b4595be819f201d61": {
  "name": "CoinEx-linked",
  "kind": "cex"
 },
 "0xbca34ed5875079cc561840f3409a790769821dbc": {
  "name": "CoinEx-linked",
  "kind": "cex"
 },
 "0xfcbfc2618826fdf33e592b8e0c65089d91a0896b": {
  "name": "CoinEx-linked",
  "kind": "cex"
 }
};
