import { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@x402/core/types";
import { encodeFunctionData, getAddress, Hex } from "viem";
import {
  aeonAuthorizationPrimaryType,
  aeonAuthorizationTypes,
  authorizationTypes,
} from "../../constants";
import { ClientEvmSigner } from "../../signer";
import { ExactEvmPayloadV2 } from "../../types";
import { createNonce } from "../../utils";
import { ReadContractClient, verifyTransferWithAuthorizationSupport } from "../../contractUtils";
import * as console from "node:console";

/**
 * EVM client implementation for the Exact payment scheme.
 *
 */
export class ExactEvmScheme implements SchemeNetworkClient {
  readonly scheme = "exact";

  /**
   * Creates a new ExactEvmClient instance.
   *
   * @param signer - The EVM signer for client operations
   */
  constructor(
    private readonly signer: ClientEvmSigner,
    /**
     * Optional viem client used for on-chain capability checks (e.g. readContract).
     * If not provided, the client will assume ERC-3009 support and proceed with EIP-712 signing.
     */
    private readonly readClient?: ReadContractClient,
  ) {}

  /**
   * Creates a payment payload for the Exact scheme.
   *
   * @param x402Version - The x402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "x402Version" | "payload">> {
    const nonce = createNonce();
    const now = Math.floor(Date.now() / 1000);

    const authorization: ExactEvmPayloadV2["authorization"] = {
      from: this.signer.address,
      to: getAddress(paymentRequirements.payTo),
      value: paymentRequirements.amount,
      validAfter: (now - 600).toString(), // 10 minutes before
      validBefore: (now + paymentRequirements.maxTimeoutSeconds).toString(),
      nonce,
    };

    // 验证代币合约是否有TransferWithAuthorization函数
    const supportsTransferWithAuthorization = await verifyTransferWithAuthorizationSupport(
      this.signer,
      paymentRequirements.asset,
    );
    console.log("[DEBUG] tokenAddress:", paymentRequirements.asset);
    console.log("[DEBUG] supportsTransferWithAuthorization:", supportsTransferWithAuthorization);
    let authorizationResult;
    if (supportsTransferWithAuthorization) {
      authorizationResult = await this.signAuthorization(authorization, paymentRequirements);
    } else {
      authorizationResult = await this.signAuthorizationNoSuperEip3009(
        authorization,
        paymentRequirements,
      );
    }
    // Sign the authorization
    const signature = authorizationResult;
    // const signature = await this.signAuthorization(authorization, paymentRequirements);

    const payload: ExactEvmPayloadV2 = {
      authorization,
      signature,
    };

    return {
      x402Version,
      payload,
    };
  }

  /**
   * Sign the EIP-3009 authorization using EIP-712
   *
   * @param authorization - The authorization to sign
   * @param requirements - The payment requirements
   * @returns Promise resolving to the signature
   */
  private async signAuthorization(
    authorization: ExactEvmPayloadV2["authorization"],
    requirements: PaymentRequirements,
  ): Promise<`0x${string}`> {
    const chainId = parseInt(requirements.network.split(":")[1]);

    if (!requirements.extra?.name || !requirements.extra?.version) {
      throw new Error(
        `EIP-712 domain parameters (name, version) are required in payment requirements for asset ${requirements.asset}`,
      );
    }

    const { name, version } = requirements.extra;

    const domain = {
      name,
      version,
      chainId,
      verifyingContract: getAddress(requirements.asset),
    };

    const message = {
      from: getAddress(authorization.from),
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    };

    return await this.signer.signTypedData({
      domain,
      types: authorizationTypes,
      primaryType: "TransferWithAuthorization",
      message,
    });
  }

  /**
   * Sign the EIP-3009 authorization using EIP-712
   *
   * @param authorization - The authorization to sign
   * @param requirements - The payment requirements
   * @returns Promise resolving to the signature
   */
  private async signAuthorizationNoSuperEip3009(
    authorization: ExactEvmPayloadV2["authorization"],
    requirements: PaymentRequirements,
  ): Promise<`0x${string}`> {
    const chainId = parseInt(requirements.network.split(":")[1]);

    if (!requirements.extra?.name || !requirements.extra?.version) {
      throw new Error(
        `EIP-712 domain parameters (name, version) are required in payment requirements for asset ${requirements.asset}`,
      );
    }

    const ERC20_ABI = [
      {
        type: "function",
        name: "approve",
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "success", type: "bool" }],
        stateMutability: "nonpayable",
      },
      {
        type: "function",
        name: "allowance",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        outputs: [{ name: "remaining", type: "uint256" }],
        stateMutability: "view",
      },
    ] as const;
    const from = getAddress(authorization.from);
    const facilitatorAddress = getAddress("0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e");

    // Read current allowance and auto-approve if needed
    const currentAllowance = (await this.signer.readContract({
      address: getAddress(requirements.asset) as Hex,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [from, facilitatorAddress],
    })) as bigint;

    const requiredAmount = BigInt(authorization.value);
    if (currentAllowance < requiredAmount) {
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [facilitatorAddress, requiredAmount],
      });
      const  tx=await this.signer.sendTransaction({
        to: getAddress(requirements.asset),
        data: approveData,
      });

      console.log(" Wait for approval transaction to be confirmed requiredAmount:",requiredAmount)
      // Wait for approval transaction to be confirmed
      const approvalReceipt = await this.signer.waitForTransactionReceipt({
        hash: tx,
      });

      if (approvalReceipt.status !== "success") {
        throw new Error("Token approval transaction failed");
      }
      console.log("approve tx:", tx);
    }

    const domain = {
      name: "Facilitator",
      version: "1",
      chainId,
      verifyingContract: getAddress("0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e"),
    };
    const message = {
      token: getAddress(requirements.asset),
      from,
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
      needApprove: true,
    };

    const data = {
      domain,
      types: aeonAuthorizationTypes,
      primaryType: aeonAuthorizationPrimaryType,
      message,
    };
    console.log("signTypedData: ", data);
    const sign = await this.signer.signTypedData(data);
    console.log("sign: ", sign);
    return sign;
  }
}
