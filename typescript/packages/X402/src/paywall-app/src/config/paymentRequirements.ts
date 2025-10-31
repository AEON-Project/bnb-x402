import { type PaymentRequirements } from "@aeon-ai-pay/x402/types";
import { TEST_TOKEN_ADDRESSES } from "../../../types/shared/tokens.js";

export const evmPaymentRequirementsUSDTonBSC: PaymentRequirements = {
  namespace: "evm",
  tokenAddress: "0x55d398326f99059ff775485246999027b3197955", // USDT on BSC
  amountRequired: 0.01, // 0.01 USDT
  amountRequiredFormat: "humanReadable", // Human readable format
  payToAddress: "0xc60d20FB910794df939eA1B758B367d7114733ae",
  networkId: "56", // BSC Chain ID
  description: "Access to generated images (EVM)",
  resource: "https://example.com/resource",
  scheme: "exact",
  mimeType: "application/json",
  outputSchema: null,
  estimatedProcessingTime: 30,
  extra: null,
  maxAmountRequired: undefined,
  requiredDeadlineSeconds: undefined,
};

// EVM native token payment option (BNB)
export const evmNativePaymentRequirements: PaymentRequirements = {
  namespace: "evm",
  tokenAddress: "0x0000000000000000000000000000000000000000", // Special address for native token
  amountRequired: 0.0001, // 0.0001 BNB
  amountRequiredFormat: "humanReadable", // Human readable format
  payToAddress: "0xc60d20FB910794df939eA1B758B367d7114733ae",
  networkId: "56", // BSC Chain ID
  description: "Access to generated images with BNB",
  resource: "https://example.com/resource",
  scheme: "exact",
  mimeType: "application/json",
  outputSchema: null,
  estimatedProcessingTime: 30,
  extra: null,
  maxAmountRequired: undefined,
  requiredDeadlineSeconds: undefined,
};

// TESTU token payment option
export const evmTestuPaymentRequirements: PaymentRequirements = {
  namespace: "evm",
  tokenAddress: TEST_TOKEN_ADDRESSES.TESTU_BSC, // TESTU on BSC
  amountRequired: 0.01, // 0.01 TESTU
  amountRequiredFormat: "humanReadable", // Human readable format
  payToAddress: "0xc60d20FB910794df939eA1B758B367d7114733ae", // Will be replaced with evmAddress
  networkId: "56", // BSC Chain ID
  description: "Premium content access with TESTU",
  resource: "https://example.com/resource",
  scheme: "exact",
  mimeType: "application/json",
  outputSchema: null,
  estimatedProcessingTime: 30,
  extra: null,
  maxAmountRequired: undefined,
  requiredDeadlineSeconds: undefined,
  tokenDecimals: 18,
  tokenSymbol: "TESTU",
};

/**
 * Creates a TESTU payment requirement with a dynamic payToAddress
 * @param evmAddress - The EVM address to receive the payment
 * @returns PaymentRequirements configured for TESTU token
 */
export function createTestuPaymentRequirements(evmAddress: string): PaymentRequirements {
  return {
    ...evmTestuPaymentRequirements,
    payToAddress: evmAddress,
  };
}



export const imageGenerationPaymentRequirements: PaymentRequirements[] = [
  evmPaymentRequirementsUSDTonBSC,
  evmNativePaymentRequirements,
  evmTestuPaymentRequirements,
];
