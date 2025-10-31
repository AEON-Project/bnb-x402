import type {
  PaymentRequirements,
  EnrichedPaymentRequirements,
} from "../types/index.js";
import {
  getTokenDecimals as getEvmTokenDecimals,
  getTokenSymbol as getEvmTokenSymbol,
} from "./evm/tokenMetadata.js";

/**
 * Enrich payment requirements with token metadata (decimals and symbol)
 * This is used by the middleware before redirecting to the paywall
 */
export async function enrichPaymentRequirements(
  requirements: PaymentRequirements[]
): Promise<EnrichedPaymentRequirements[]> {
  return Promise.all(
    requirements.map(async (req) => {
      // Skip if metadata is already present
      if (req.tokenDecimals !== undefined && req.tokenSymbol !== undefined) {
        return req as EnrichedPaymentRequirements;
      }

      // Handle different namespaces
      if (req.namespace === "evm") {
        // Get token metadata for EVM tokens
        const [decimals, symbol] = await Promise.all([
          getEvmTokenDecimals(req.tokenAddress),
          getEvmTokenSymbol(req.tokenAddress),
        ]);

        return {
          ...req,
          tokenDecimals: decimals,
          tokenSymbol: symbol || "UNKNOWN",
        };
      }

      // Return unchanged for unknown namespaces
      return req as EnrichedPaymentRequirements;
    })
  );
}
