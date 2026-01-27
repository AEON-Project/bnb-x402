import {Hex, toHex} from "viem";
import { Network } from "@x402/core/types";

/**
 * Extract chain ID from network string (e.g., "base-sepolia" -> 84532)
 * Used by v1 implementations
 *
 * @param network - The network identifier
 * @returns The numeric chain ID
 */
export function getEvmChainId(network: Network): number {
  const raw = String(network);

  // 1) CAIP-2 (V2 style): "eip155:<chainId>"
  // Also tolerate any "<namespace>:<number>" format here.
  if (raw.includes(":")) {
    const parts = raw.split(":");
    if (parts.length === 2) {
      const n = Number(parts[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  // 2) V1 style (requested): "<chainId>"
  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const networkMap: Record<string, number> = {
    base: 8453,
    xLayer: 196,
    bsc: 56,
    kite: 2366,
    "base-sepolia": 84532,
    ethereum: 1,
    sepolia: 11155111,
    polygon: 137,
    "polygon-amoy": 80002,
  };
  return networkMap[raw] || 1;
}

// /**
//  * Create a random 32-byte nonce for authorization
//  *
//  * @returns A hex-encoded 32-byte nonce
//  */
// export function createNonce(): `0x${string}` {
//   // Use dynamic import to avoid require() in ESM context
//   const cryptoObj =
//     typeof globalThis.crypto !== "undefined"
//       ? globalThis.crypto
//       : (globalThis as { crypto?: Crypto }).crypto;
//
//   if (!cryptoObj) {
//     throw new Error("Crypto API not available");
//   }
//
//   return toHex(cryptoObj.getRandomValues(new Uint8Array(32)));
// }


/**
 * Create a random 32-byte nonce for authorization
 *
 * @returns A hex-encoded 32-byte nonce
 */
export function createNonce(): `0x${string}` {
  try {
    const NONCE_BYTES = 32;
    const randomBytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
    // Use browser-compatible approach to convert Uint8Array to hex string
    let hexString = '';
    for (let i = 0; i < randomBytes.length; i++) {
      const hex = randomBytes[i].toString(16).padStart(2, '0');
      hexString += hex;
    }
    console.log("[DEBUG] Generated nonce using browser-compatible approach");
    return `0x${hexString}` as Hex;
  } catch (error) {
    throw new Error(
        `Failed to generate nonce: ${
            error instanceof Error ? error.message : String(error)
        }`
    );
  }
}
