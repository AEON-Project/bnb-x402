/**
 * Well-known token addresses and constants for the x402 project
 */

// Stablecoin token addresses
export const STABLECOIN_ADDRESSES = {
  USDT_BSC: "0x55d398326f99059ff775485246999027b3197955",
  USDT_BASE: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
  USDC_BASE: "0x2Ce6311ddAE708829bc0784C967b7d77D19FD779",
  USDT_POLYGON: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  USDT_SEI: "0x542589e0677ba061b2d0bbde24a7da4e67941830",
  USDC_SOLANA: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

// Test token addresses
export const TEST_TOKEN_ADDRESSES = {
  TESTU_BSC: "0x6e3BCf81d331fa7Bd79Ac2642486c70BEAE2600E", // TESTU test token on BSC
} as const;

// Native token addresses (special addresses for native tokens)
export const NATIVE_TOKEN_ADDRESSES = {
  BNB_BSC: "0x0000000000000000000000000000000000000000", // Special address for native BNB
  ETH_BASE: "0x0000000000000000000000000000000000000000", // Special address for native ETH Base
  POL_POLYGON: "0x0000000000000000000000000000000000000000", // Special address for native POL Polygon
  SEI_SEI: "0x0000000000000000000000000000000000000000", // Special address for native SEI Sei
  SOL_SOLANA: "11111111111111111111111111111111", // System Program ID for native SOL
} as const;

// Stablecoin symbols
export const STABLECOIN_SYMBOLS = ["USDT", "USDC"] as const;

// Test token symbols
export const TEST_TOKEN_SYMBOLS = ["TESTU"] as const;

// All known stablecoin addresses (for easy checking)
export const ALL_STABLECOIN_ADDRESSES = Object.values(STABLECOIN_ADDRESSES);

// Type definitions
export type StablecoinAddress = typeof STABLECOIN_ADDRESSES[keyof typeof STABLECOIN_ADDRESSES];
export type NativeTokenAddress = typeof NATIVE_TOKEN_ADDRESSES[keyof typeof NATIVE_TOKEN_ADDRESSES];
export type StablecoinSymbol = typeof STABLECOIN_SYMBOLS[number];

/**
 * Check if a token address is a known stablecoin
 */
export function isStablecoinAddress(address: string): boolean {
  return ALL_STABLECOIN_ADDRESSES.includes(address as StablecoinAddress);
}

/**
 * Check if a token symbol is a known stablecoin
 */
export function isStablecoinSymbol(symbol: string): boolean {
  return STABLECOIN_SYMBOLS.includes(symbol.toUpperCase() as StablecoinSymbol);
}
