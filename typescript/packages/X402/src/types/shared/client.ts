import type { PublicActions, WalletClient } from "viem";


/**
 * Interface for EVM client used in payment operations
 */
export interface EvmClient extends WalletClient, PublicActions {}

/**
 * Interface for the payment client that can handle different blockchains
 */
export interface PaymentClient {
  evmClient?: EvmClient;
}
