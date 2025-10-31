import { type PaymentRequirements } from "../types/index.js";
import { evm } from "./index.js";
import { type PublicActions } from "viem";

export async function parsePaymentRequirementsForAmount(
  paymentRequirements: PaymentRequirements,
  client?: PublicActions | any
): Promise<PaymentRequirements> {
  // Handle backward compatibility with x402: if maxAmountRequired is present, use it for amountRequired
  const details = {
    ...paymentRequirements,
    amountRequired:
      paymentRequirements.amountRequired ||
      paymentRequirements.maxAmountRequired ||
      0,
  };

  console.log("[x402 debug] Payment requirements:", details);

  // If already in smallestUnit format, no conversion needed
  if (details.amountRequiredFormat === "smallestUnit") {
    return details;
  }

  // Handle EVM tokens
  if (
    details.namespace === "evm" &&
    details.amountRequiredFormat === "humanReadable" &&
    details.tokenAddress?.toLowerCase() === evm.ZERO_ADDRESS.toLowerCase()
  ) {
    const chain = evm.chains[details.networkId];
    if (!chain) {
      throw new Error(`Unsupported EVM network: ${details.networkId}`);
    }

      return {
        ...details,
        amountRequired: BigInt(
          Math.floor(
            Number(details.amountRequired) * Math.pow(10, 18) // Use 18 decimals for native tokens
          )
        ),
      };
  }

  // For EVM tokens that need data fetching
  try {
    // Check if we already have all the data we need
    if (
      details.tokenDecimals !== undefined &&
      details.tokenSymbol !== undefined
    ) {
      // We have metadata, just convert the amount
      return {
        ...details,
        amountRequired: BigInt(
          Math.floor(
            Number(details.amountRequired) *
              Math.pow(10, details.tokenDecimals)
          )
        ),
      };
    }

    // We need to fetch token metadata
    if (!client) {
      throw new Error("Client is required for fetching token metadata");
    }

    console.log("Fetching EVM token data for:", details.tokenAddress);
    console.log("EVM token network ID:", details.networkId);

    // Fetch token metadata in parallel
    const [decimals, symbol] = await Promise.all([
      evm.getTokenDecimals(details.tokenAddress, client),
      evm.getTokenSymbol(details.tokenAddress, client),
    ]);

    console.log("EVM token metadata:", { decimals, symbol });

    return {
      ...details,
      tokenDecimals: decimals,
      tokenSymbol: symbol || "UNKNOWN",
      amountRequired: BigInt(
        Math.floor(Number(details.amountRequired) * Math.pow(10, decimals))
      ),
    };
  } catch (error) {
    console.error("Error processing EVM token:", error);
    throw new Error(
      `Failed to parse EVM token data: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}