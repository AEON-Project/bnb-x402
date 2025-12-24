import {
  Network,
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkClient,
} from "@x402/core/types";
import { PaymentRequirementsV1 } from "@x402/core/types/v1";
import {encodeFunctionData, getAddress, Hex} from "viem";
import {aeonAuthorizationPrimaryType, aeonAuthorizationTypes, authorizationTypes, ERC20_ABI} from "../../../constants";
import { ClientEvmSigner } from "../../../signer";
import { ExactEvmPayloadV1 } from "../../../types";
import { createNonce, getEvmChainId } from "../../../utils";
import {verifyTransferWithAuthorizationSupport} from "../../../contractUtils";
import console from "node:console";

/**
 * EVM client implementation for the Exact payment scheme (V1).
 */
export class ExactEvmSchemeV1 implements SchemeNetworkClient {
  readonly scheme = "exact";

  /**
   * Creates a new ExactEvmClientV1 instance.
   *
   * @param signer - The EVM signer for client operations
   */
  constructor(private readonly signer: ClientEvmSigner) {}

  /**
   * Creates a payment payload for the Exact scheme (V1).
   *
   * @param x402Version - The x402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<
    Pick<PaymentPayload, "x402Version" | "payload"> & { scheme: string; network: Network }
  > {
    const selectedV1 = paymentRequirements as unknown as PaymentRequirementsV1;
    const nonce = createNonce();
    const now = Math.floor(Date.now() / 1000);

    const authorization: ExactEvmPayloadV1["authorization"] = {
      from: this.signer.address,
      to: getAddress(selectedV1.payTo),
      value: selectedV1.maxAmountRequired,
      validAfter: (now - 600).toString(), // 10 minutes before
      validBefore: (now + selectedV1.maxTimeoutSeconds).toString(),
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
      authorizationResult = await this.signAuthorization(authorization, selectedV1);
    } else {
      authorizationResult = await this.signAuthorizationNoSuperEip3009(
          authorization,
          selectedV1,
      );
    }

    const signature = authorizationResult;
    // Sign the authorization
    // const signature = await this.signAuthorization(authorization, selectedV1);

    const payload: ExactEvmPayloadV1 = {
      authorization,
      signature,
    };

    return {
      x402Version,
      scheme: selectedV1.scheme,
      network: selectedV1.network,
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
    authorization: ExactEvmPayloadV1["authorization"],
    requirements: PaymentRequirementsV1,
  ): Promise<`0x${string}`> {
    const chainId = getEvmChainId(requirements.network);

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
      authorization: ExactEvmPayloadV1["authorization"],
      requirements: PaymentRequirementsV1,
  ): Promise<`0x${string}`> {
    const chainId = getEvmChainId(requirements.network);

    if (!requirements.extra?.name || !requirements.extra?.version) {
      throw new Error(
          `EIP-712 domain parameters (name, version) are required in payment requirements for asset ${requirements.asset}`,
      );
    }

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



    // const { name, version } = requirements.extra;

    const domain = {
      name: "Facilitator",
      version: "1",
      chainId,
      verifyingContract: getAddress("0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e"),
    };

    const message = {
      token: getAddress(requirements.asset),
      from: getAddress(authorization.from),
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
      needApprove: true,
    };

    return await this.signer.signTypedData({
      domain,
      types: aeonAuthorizationTypes,
      primaryType: aeonAuthorizationPrimaryType,
      message,
    });
  }
}
