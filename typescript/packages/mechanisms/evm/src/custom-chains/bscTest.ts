import { type Chain } from "viem";

/**
 * bscTest Mainnet Chain 配置
 * Chain ID: 97
 * Token Symbol: BSC
 */
export const bscTest = {
  id: 97,
  name: "bscTest",
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://bsc-testnet-rpc.publicnode.com"],
      webSocket: ["wss://bsc-testnet-rpc.publicnode.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "BSCTestScan",
      url: "https://testnet.bscscan.com/",
    },
  },
} satisfies Chain;