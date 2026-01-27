import { type Chain } from "viem";

/**
 * KiteAI Mainnet Chain 配置
 * Chain ID: 2366
 * Token Symbol: KITE
 * 官网: https://www.gokite.ai/
 */
export const kite = {
  id: 2366,
  name: "KiteAI Mainnet",
  nativeCurrency: {
    name: "KITE",
    symbol: "KITE",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.gokite.ai/"],
      webSocket: ["wss://rpc.gokite.ai/ws"],
    },
  },
  blockExplorers: {
    default: {
      name: "KiteScan",
      url: "https://kitescan.ai",
    },
  },
} satisfies Chain;
