import { evm } from "../../../shared/index.js";
import { SCHEME } from "../index.js";
import {
  VerifyResponse,
  SettleResponse,
  PaymentRequirements,
  EvmPaymentPayload,
  EvmAuthorizationPayload,
  Namespace,
} from "../../../types/index.js";
import {
  encodeFunctionData,
  WalletClient,
  PublicActions,
  PublicClient,
  Hex,
} from "viem";
import { x402Version } from "../../../index.js";
import {
  validateTransferData,
  validateTransferEventLog,
} from "./validation.js";

const BLOCK_TIME = 2; // Average block time in seconds
const SAFETY_BLOCKS = 3; // Number of blocks for safety margin
const GAS_LIMIT_SAFETY_FACTOR = 1.25; // Allow 25% more than estimated gas

async function getMaxGasForChain(client: PublicClient): Promise<bigint> {
  try {
    const latestBlock = await client.getBlock();
    return latestBlock.gasLimit;
  } catch (error) {
    console.warn("Failed to get gas limit, using default:", error);
    return BigInt(30000000);
  }
}

async function verify(
  client: PublicClient | (WalletClient & PublicActions),
  payload: EvmPaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResponse> {
  console.log("[DEBUG-EVM-VERIFY] Starting EVM payment verification", {
    payloadType: payload.payload.type,
    networkId: paymentRequirements.networkId,
    tokenAddress: paymentRequirements.tokenAddress,
    amountRequired: paymentRequirements.amountRequired,
  });

  const baseValidation = validateBasePayload(payload, paymentRequirements);
  if (!baseValidation.isValid) {
    return baseValidation;
  }

  const chainValidation = validateChain(payload, paymentRequirements);
  if (!chainValidation.isValid) {
    return chainValidation;
  }

  try {
    switch (payload.payload.type) {
      case "authorization":
        return await verifyAuthorizationPayload(
          client,
          payload.payload,
          paymentRequirements
        );
      case "authorizationEip3009":
        return await verifyAuthorizationPayload(
          client,
          payload.payload,
          paymentRequirements
        );
      default:
        return {
          isValid: false,
          errorMessage: "Unsupported payload type",
        };
    }
  } catch (error) {
    return {
      isValid: false,
      errorMessage: `Verification failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function validateBasePayload(
  payload: EvmPaymentPayload,
  paymentRequirements: PaymentRequirements
): VerifyResponse {
  if (payload.scheme !== SCHEME) {
    return { isValid: false, errorMessage: "Invalid scheme" };
  }
  if (payload.x402Version !== x402Version) {
    return { isValid: false, errorMessage: "Invalid x402 version" };
  }
  return { isValid: true };
}

function validateChain(
  payload: EvmPaymentPayload,
  paymentRequirements: PaymentRequirements
): VerifyResponse {
  if (payload.networkId !== paymentRequirements.networkId) {
    return { isValid: false, errorMessage: "Network ID mismatch" };
  }
  return { isValid: true };
}

async function verifyAuthorizationPayload(
  client: PublicClient | (WalletClient & PublicActions),
  payload: any,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResponse> {
  try {
    // Validate authorization parameters
    const { authorization } = payload;
    
    if (!authorization.from || !authorization.to || !authorization.value) {
      return {
        isValid: false,
        errorMessage: "Missing required authorization parameters",
      };
    }

    // Validate amounts match
    if (authorization.value !== paymentRequirements.amountRequired) {
      return {
        isValid: false,
        errorMessage: "Authorization amount does not match required amount",
      };
    }

    // Validate addresses
    if (authorization.to.toLowerCase() !== paymentRequirements.payToAddress?.toLowerCase()) {
      return {
        isValid: false,
        errorMessage: "Authorization recipient does not match required recipient",
      };
    }

    // Validate timing
    const currentTime = Math.floor(Date.now() / 1000);
    if (authorization.validAfter && BigInt(currentTime) < authorization.validAfter) {
      return {
        isValid: false,
        errorMessage: "Authorization not yet valid",
      };
    }

    if (authorization.validBefore && BigInt(currentTime) > authorization.validBefore) {
      return {
        isValid: false,
        errorMessage: "Authorization has expired",
      };
    }

    return {
      isValid: true,
      type: "payload",
    };
  } catch (error) {
    return {
      isValid: false,
      errorMessage: `Failed to verify authorization: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

async function settle(
  client: WalletClient & PublicActions,
  payload: EvmPaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<SettleResponse> {
  const valid = await verify(client, payload, paymentRequirements);

  if (!valid.isValid) {
    return {
      success: false,
      transaction: "",
      namespace: payload.namespace,
      errorReason: "invalid_payload",
      error: valid.errorMessage,
    };
  }

  try {
    switch (payload.payload.type) {
      case "authorization":
        return await settleAuthorizationPayload(
          client,
          payload.payload,
          paymentRequirements,
          payload.namespace
        );
      case "authorizationEip3009":
        return await settleAuthorizationPayload(
          client,
          payload.payload,
          paymentRequirements,
          payload.namespace
        );
      default:
        return {
          success: false,
          transaction: "",
          namespace: payload.namespace,
          errorReason: "invalid_payload",
          error: "Unsupported payload type",
        };
    }
  } catch (error) {
    return {
      success: false,
      transaction: "",
      namespace: payload.namespace,
      errorReason: "invalid_payload",
      error: `Settlement failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

async function settleAuthorizationPayload(
  client: WalletClient & PublicActions,
  payload: any,
  paymentRequirements: PaymentRequirements,
  namespace: Namespace
): Promise<SettleResponse> {
  try {
    const { authorization } = payload;
    const facilitatorAddress = "0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e";
    
    // Prepare transaction data for settlement
    const data = encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "settlePayment",
          inputs: [
            { name: "token", type: "address" },
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
            { name: "signature", type: "bytes" },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "settlePayment",
      args: [
        paymentRequirements.tokenAddress as Hex,
        authorization.from as Hex,
        authorization.to as Hex,
        authorization.value,
        authorization.validAfter,
        authorization.validBefore,
        authorization.nonce as Hex,
        payload.signature as Hex,
      ],
    });

    // Send settlement transaction
    const txHash = await client.sendTransaction({
      account: client.account!,
      to: facilitatorAddress as Hex,
      data,
      chain: evm.getChain(paymentRequirements.networkId),
    });

    // Wait for confirmation
    const receipt = await client.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== "success") {
      return {
        success: false,
        transaction: txHash,
        namespace,
        errorReason: "invalid_scheme",
        error: "Settlement transaction failed",
      };
    }

    return {
      success: true,
      transaction: txHash,
      namespace,
    };
  } catch (error) {
    return {
      success: false,
      transaction: "",
      namespace,
      errorReason: "invalid_scheme",
      error: `Failed to settle authorization: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export { verify, settle };