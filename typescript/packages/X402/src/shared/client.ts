import { Chain, createWalletClient, Hex, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PaymentClient, EvmClient } from "../types/shared/client";

/**
 * Creates an EVM wallet client with public actions
 * @param privateKey - The private key as a hex string
 * @param chain - The chain configuration (e.g., base, mainnet, etc.)
 * @param rpcUrl - Optional custom RPC URL
 * @returns A wallet client with public actions extended
 */
export function createEvmClient(
  privateKey: Hex,
  chain: Chain,
  rpcUrl?: string
): EvmClient {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain,
    transport: http(rpcUrl),
  }).extend(publicActions) as EvmClient;
}


export type { PaymentClient };

