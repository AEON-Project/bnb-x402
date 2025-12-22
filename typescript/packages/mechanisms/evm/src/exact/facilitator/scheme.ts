import {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import {
  encodeFunctionData,
  getAddress,
  Hex,
  isAddressEqual,
  parseErc6492Signature,
  parseSignature,
} from "viem";
import {
  aeonAuthorizationPrimaryType,
  aeonAuthorizationTypes,
  authorizationTypes,
  eip3009ABI,
} from "../../constants";
import { FacilitatorEvmSigner } from "../../signer";
import { ExactEvmPayloadV2 } from "../../types";
import { ReadContractClient, verifyTransferWithAuthorizationSupport } from "../../contractUtils";
import * as console from "node:console";
import { ZeroGasTool } from "./utils/ZeroGasTool";

export interface ExactEvmSchemeConfig {
  /**
   * If enabled, the facilitator will deploy ERC-4337 smart wallets
   * via EIP-6492 when encountering undeployed contract signatures.
   *
   * @default false
   */
  deployERC4337WithEIP6492?: boolean;
}

/**
 * EVM facilitator implementation for the Exact payment scheme.
 */
export class ExactEvmScheme implements SchemeNetworkFacilitator {
  readonly scheme = "exact";
  readonly caipFamily = "eip155:*";
  private readonly config: Required<ExactEvmSchemeConfig>;

  /**
   * Creates a new ExactEvmFacilitator instance.
   *
   * @param signer - The EVM signer for facilitator operations
   * @param config - Optional configuration for the facilitator
   */
  constructor(
    private readonly signer: FacilitatorEvmSigner,
    config?: ExactEvmSchemeConfig,
  ) {
    this.config = {
      deployERC4337WithEIP6492: config?.deployERC4337WithEIP6492 ?? false,
    };
  }

  /**
   * Get mechanism-specific extra data for the supported kinds endpoint.
   * For EVM, no extra data is needed.
   *
   * @param _ - The network identifier (unused for EVM)
   * @returns undefined (EVM has no extra data)
   */
  getExtra(_: string): Record<string, unknown> | undefined {
    return undefined;
  }

  /**
   * Get signer addresses used by this facilitator.
   * Returns all addresses this facilitator can use for signing/settling transactions.
   *
   * @param _ - The network identifier (unused for EVM, addresses are network-agnostic)
   * @returns Array of facilitator wallet addresses
   */
  getSigners(_: string): string[] {
    return [...this.signer.getAddresses()];
  }

  /**
   * Verifies a payment payload.
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements
   * @returns Promise resolving to verification response
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const exactEvmPayload = payload.payload as ExactEvmPayloadV2;

    // Verify scheme matches
    if (payload.accepted.scheme !== "exact" || requirements.scheme !== "exact") {
      return {
        isValid: false,
        invalidReason: "unsupported_scheme",
        payer: exactEvmPayload.authorization.from,
      };
    }

    // Get chain configuration
    if (!requirements.extra?.name || !requirements.extra?.version) {
      return {
        isValid: false,
        invalidReason: "missing_eip712_domain",
        payer: exactEvmPayload.authorization.from,
      };
    }

    const { name, version } = requirements.extra;
    const erc20Address = getAddress(requirements.asset);

    // Verify network matches
    if (payload.accepted.network !== requirements.network) {
      return {
        isValid: false,
        invalidReason: "network_mismatch",
        payer: exactEvmPayload.authorization.from,
      };
    }
    const supportEip3009 = await verifyTransferWithAuthorizationSupport(
      this.signer,
      requirements.asset,
    );
    console.log("[DEBUG] tokenAddress:", requirements.asset);
    console.log("[DEBUG] supportEip3009:", supportEip3009);
    // let permitTypedData;
    // if (supportEip3009) {
    //   permitTypedData = {
    //     types: authorizationTypes,
    //     primaryType: "TransferWithAuthorization" as const,
    //     domain: {
    //       name,
    //       version,
    //       chainId: parseInt(requirements.network.split(":")[1]),
    //       verifyingContract: erc20Address,
    //     },
    //     message: {
    //       from: exactEvmPayload.authorization.from,
    //       to: exactEvmPayload.authorization.to,
    //       value: BigInt(exactEvmPayload.authorization.value),
    //       validAfter: BigInt(exactEvmPayload.authorization.validAfter),
    //       validBefore: BigInt(exactEvmPayload.authorization.validBefore),
    //       nonce: exactEvmPayload.authorization.nonce,
    //     },
    //   };
    // } else {
    //   const verifyingContract = "0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e";
    //   permitTypedData = {
    //     types: aeonAuthorizationTypes,
    //     primaryType: aeonAuthorizationPrimaryType,
    //     domain: {
    //       name: "Facilitator",
    //       version: "1",
    //       chainId: parseInt(requirements.network.split(":")[1]),
    //       verifyingContract: verifyingContract,
    //     },
    //     message: {
    //       token: getAddress(requirements.asset),
    //       from: exactEvmPayload.authorization.from,
    //       to: exactEvmPayload.authorization.to,
    //       value: BigInt(exactEvmPayload.authorization.value),
    //       validAfter: BigInt(exactEvmPayload.authorization.validAfter),
    //       validBefore: BigInt(exactEvmPayload.authorization.validBefore),
    //       nonce: exactEvmPayload.authorization.nonce,
    //       needApprove: true,
    //     },
    //   };
    // }
    // Verify signature
    // try {
    //   const recoveredAddress = await this.signer.verifyTypedData({
    //     address: exactEvmPayload.authorization.from,
    //     ...(permitTypedData as any),
    //     signature: exactEvmPayload.signature!,
    //   });

    const funData = {
      abi: [
        {
          name: "tokenTransferWithAuthorization",
          type: "function",
          inputs: [
            { name: "token", type: "address" },
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
            { name: "needApprove", type: "bool" },
            { name: "signature", type: "bytes" },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "tokenTransferWithAuthorization",
      args: [
        getAddress(requirements.asset),
        getAddress(exactEvmPayload.authorization.from),
        getAddress(exactEvmPayload.authorization.to),
        BigInt(exactEvmPayload.authorization.value),
        BigInt(exactEvmPayload.authorization.validAfter),
        BigInt(exactEvmPayload.authorization.validBefore),
        exactEvmPayload.authorization.nonce as Hex,
        !supportEip3009,
        exactEvmPayload.signature as Hex,
      ],
    };
    const data = encodeFunctionData(funData);
    const to = "0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e";
    try {
      // Optional: estimate gas (useful for debugging / logging)
      const [account] = await this.signer.getAddresses();
      await this.signer.estimateGas({
        // account: client.account!,
        account: account,
        // account: payload.authorization.from as Hex,
        to: to as Hex,
        data,
      });
    } catch (error) {
      let errorMessage = "Failed to estimate gas";

      if (error instanceof Error) {
        const errorStr = error.message;

        // Check for specific revert reasons
        if (errorStr.includes("0x13be252b")) {
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
          const from = getAddress(exactEvmPayload.authorization.from);
          const facilitatorAddress = getAddress("0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e");

          // Read current allowance and auto-approve if needed
          const currentAllowance = (await this.signer.readContract({
            address: getAddress(requirements.asset) as Hex,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [from, facilitatorAddress],
          })) as bigint;
          console.log("currentAllowance:", currentAllowance);

          errorMessage =
            "Insufficient token allowance. Please approve the facilitator contract to spend your tokens before making the payment.";
        } else if (errorStr.includes("0xccea9e6f")) {
          errorMessage =
            "Invalid operator. The caller is not authorized to perform this operation.";
        } else if (errorStr.includes("0xdf8e4372")) {
          errorMessage =
            "Authorization not yet valid. The payment authorization is not yet active.";
        } else if (errorStr.includes("0x0f05f5bf")) {
          errorMessage = "Authorization expired. The payment authorization has expired.";
        } else if (errorStr.includes("0x1f6d5aef")) {
          errorMessage = "Nonce already used. This authorization has already been used.";
        } else if (errorStr.includes("0x8baa579f")) {
          errorMessage = "Invalid signature. The payment authorization signature is invalid.";
        } else {
          errorMessage = "Failed to estimate gas: " + errorStr;
        }
        return {
          isValid: false,
          invalidReason: errorMessage,
          payer: exactEvmPayload.authorization.from,
        };
      } else {
        // Signature verification failed - could be an undeployed smart wallet
        // Check if smart wallet is deployed
        const signature = exactEvmPayload.signature!;
        const signatureLength = signature.startsWith("0x")
          ? signature.length - 2
          : signature.length;
        const isSmartWallet = signatureLength > 130; // 65 bytes = 130 hex chars for EOA

        if (isSmartWallet) {
          const payerAddress = exactEvmPayload.authorization.from;
          const bytecode = await this.signer.getCode({ address: payerAddress });

          if (!bytecode || bytecode === "0x") {
            // Wallet is not deployed. Check if it's EIP-6492 with deployment info.
            // EIP-6492 signatures contain factory address and calldata needed for deployment.
            // Non-EIP-6492 undeployed wallets cannot succeed (no way to deploy them).
            const erc6492Data = parseErc6492Signature(signature);
            const hasDeploymentInfo =
              erc6492Data.address &&
              erc6492Data.data &&
              !isAddressEqual(erc6492Data.address, "0x0000000000000000000000000000000000000000");

            if (!hasDeploymentInfo) {
              // Non-EIP-6492 undeployed smart wallet - will always fail at settlement
              // since EIP-3009 requires on-chain EIP-1271 validation
              return {
                isValid: false,
                invalidReason: "invalid_exact_evm_payload_undeployed_smart_wallet",
                payer: payerAddress,
              };
            }
            // EIP-6492 signature with deployment info - allow through
            // Facilitators with sponsored deployment support can handle this in settle()
          } else {
            // Wallet is deployed but signature still failed - invalid signature
            return {
              isValid: false,
              invalidReason: "invalid_exact_evm_payload_signature",
              payer: exactEvmPayload.authorization.from,
            };
          }
        } else {
          // EOA signature failed
          return {
            isValid: false,
            invalidReason: "invalid_exact_evm_payload_signature",
            payer: exactEvmPayload.authorization.from,
          };
        }
      }
    }

    // Verify payment recipient matches
    if (getAddress(exactEvmPayload.authorization.to) !== getAddress(requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_recipient_mismatch",
        payer: exactEvmPayload.authorization.from,
      };
    }

    // Verify validBefore is in the future (with 6 second buffer for block time)
    const now = Math.floor(Date.now() / 1000);
    if (BigInt(exactEvmPayload.authorization.validBefore) < BigInt(now + 6)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_authorization_valid_before",
        payer: exactEvmPayload.authorization.from,
      };
    }

    // Verify validAfter is not in the future
    if (BigInt(exactEvmPayload.authorization.validAfter) > BigInt(now)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_authorization_valid_after",
        payer: exactEvmPayload.authorization.from,
      };
    }

    // Check balance
    try {
      const balance = (await this.signer.readContract({
        address: erc20Address,
        abi: eip3009ABI,
        functionName: "balanceOf",
        args: [exactEvmPayload.authorization.from],
      })) as bigint;

      if (BigInt(balance) < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: "insufficient_funds",
          payer: exactEvmPayload.authorization.from,
        };
      }
    } catch {
      // If we can't check balance, continue with other validations
    }

    // Verify amount is sufficient
    if (BigInt(exactEvmPayload.authorization.value) < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_authorization_value",
        payer: exactEvmPayload.authorization.from,
      };
    }

    return {
      isValid: true,
      invalidReason: undefined,
      payer: exactEvmPayload.authorization.from,
    };
  }

  /**
   * Settles a payment by executing the transfer.
   *
   * @param payload - The payment payload to settle
   * @param requirements - The payment requirements
   * @returns Promise resolving to settlement response
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const exactEvmPayload = payload.payload as ExactEvmPayloadV2;

    // Re-verify before settling
    // const valid = await this.verify(payload, requirements);
    // if (!valid.isValid) {
    //   return {
    //     success: false,
    //     network: payload.accepted.network,
    //     transaction: "",
    //     errorReason: valid.invalidReason ?? "invalid_scheme",
    //     payer: exactEvmPayload.authorization.from,
    //   };
    // }

    let tx;
    try {
      // Parse ERC-6492 signature if applicable
      const parseResult = parseErc6492Signature(exactEvmPayload.signature!);
      const { signature, address: factoryAddress, data: factoryCalldata } = parseResult;

      // Deploy ERC-4337 smart wallet via EIP-6492 if configured and needed
      if (
        this.config.deployERC4337WithEIP6492 &&
        factoryAddress &&
        factoryCalldata &&
        !isAddressEqual(factoryAddress, "0x0000000000000000000000000000000000000000")
      ) {
        // Check if smart wallet is already deployed
        const payerAddress = exactEvmPayload.authorization.from;
        const bytecode = await this.signer.getCode({ address: payerAddress });

        if (!bytecode || bytecode === "0x") {
          // Wallet not deployed - attempt deployment
          try {
            console.log(`Deploying ERC-4337 smart wallet for ${payerAddress} via EIP-6492`);

            // Send the factory calldata directly as a transaction
            // The factoryCalldata already contains the complete encoded function call
            const deployTx = await this.signer.sendTransaction({
              to: factoryAddress as Hex,
              data: factoryCalldata as Hex,
            });

            // Wait for deployment transaction
            await this.signer.waitForTransactionReceipt({ hash: deployTx });
            console.log(`Successfully deployed smart wallet for ${payerAddress}`);
          } catch (deployError) {
            console.error("Smart wallet deployment failed:", deployError);
            // Deployment failed - cannot proceed
            throw deployError;
          }
        } else {
          console.log(`Smart wallet for ${payerAddress} already deployed, skipping deployment`);
        }
      }

      // Determine if this is an ECDSA signature (EOA) or smart wallet signature
      // ECDSA signatures are exactly 65 bytes (130 hex chars without 0x)
      const signatureLength = signature.startsWith("0x") ? signature.length - 2 : signature.length;
      const isECDSA = signatureLength === 130;

      const supportEip3009 = await verifyTransferWithAuthorizationSupport(
        this.signer,
        requirements.asset,
      );

      const funData = {
        abi: [
          {
            name: "tokenTransferWithAuthorization",
            type: "function",
            inputs: [
              { name: "token", type: "address" },
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "validAfter", type: "uint256" },
              { name: "validBefore", type: "uint256" },
              { name: "nonce", type: "bytes32" },
              { name: "needApprove", type: "bool" },
              { name: "signature", type: "bytes" },
            ],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "tokenTransferWithAuthorization",
        args: [
          getAddress(requirements.asset),
          getAddress(exactEvmPayload.authorization.from),
          getAddress(exactEvmPayload.authorization.to),
          BigInt(exactEvmPayload.authorization.value),
          BigInt(exactEvmPayload.authorization.validAfter),
          BigInt(exactEvmPayload.authorization.validBefore),
          exactEvmPayload.authorization.nonce as Hex,
          !supportEip3009,
          exactEvmPayload.signature as Hex,
        ],
      };

      let next = true;
      if (parseInt(requirements.network.split(":")[1]) == 56) {
        console.log("使用 ZeroGasTool 代付");
        try {
          // 创建 ZeroGasTool 实例
          const tool = new ZeroGasTool();
          const validateResult = await tool.validateGaslessWithdraw2(funData);

          if (validateResult && validateResult.isValid) {
            // 执行交易
            tx = (await tool.executeGaslessWithdraw(validateResult.txConfig)) as `0x${string}`;
            // 等待交易确认
            const receipt = await this.signer.waitForTransactionReceipt({
              hash: tx as Hex,
            });

            if (receipt.status === "success") {
              console.log("使用 ZeroGasTool 代付成功");
              next = false;
              const resource = payload.resource.url;
              console.log("resource:", resource);
              const sendData = {
                ...exactEvmPayload.authorization,
                ...requirements,
                resource,
                tx,
                time: new Date().toISOString(),
              };
              // Post settlement log asynchronously (fire and forget)
              postSettleLog(sendData).catch(logErr => {
                console.error("[ERROR] Settlement log failed:", logErr);
                // Log error but don't affect main settlement flow
              });
            } else {
              // 如果校验结果不支持赞助，继续执行原有的普通交易流程
              next = false;
            }
          }
        } catch (zeroGasError) {
          // 如果 ZeroGasTool 处理失败，静默失败并使用原有的普通交易流程
          // 不抛出错误，确保不影响原有逻辑
          console.warn(
            "[ZEROGAS] Error or not applicable, using original transaction flow:",
            zeroGasError instanceof Error ? zeroGasError.message : String(zeroGasError),
          );
        }
      }

      if (next) {
        const data = encodeFunctionData(funData);
        const to = "0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e";
        // Send settlement transaction (must assign tx hash for receipt waiting)
        tx = await this.signer.sendTransaction({
          to: to as Hex,
          data,
        });

        // Wait for  transaction to be confirmed
        const approvalReceipt = await this.signer.waitForTransactionReceipt({
          hash: tx,
        });

        if (approvalReceipt.status !== "success") {
          return {
            success: false,
            errorReason: "invalid_transaction_state",
            transaction: tx,
            network: payload.accepted.network,
            payer: exactEvmPayload.authorization.from,
          };
        }
      }


      return {
        success: true,
        transaction: tx as string,
        network: payload.accepted.network,
        payer: exactEvmPayload.authorization.from,
      };
    } catch (error) {
      // Keep tx hash if we already broadcasted, so callers can track it even on timeout/failure.
      const txHashFromError =
        error instanceof Error
          ? (error.message.match(/hash\s+"(0x[0-9a-fA-F]{64})"/)?.[1] as `0x${string}` | undefined)
          : undefined;

      let errorMessage = "Failed to settle transaction";
      if (error instanceof Error) {
        const errorStr = error.message;
        // Check for specific revert reasons
        if (errorStr.includes("0x13be252b")) {
          errorMessage =
            "Insufficient token allowance. Please approve the facilitator contract to spend your tokens before making the payment.";
        } else if (errorStr.includes("0xccea9e6f")) {
          errorMessage =
            "Invalid operator. The caller is not authorized to perform this operation.";
        } else if (errorStr.includes("0xdf8e4372")) {
          errorMessage =
            "Authorization not yet valid. The payment authorization is not yet active.";
        } else if (errorStr.includes("0x0f05f5bf")) {
          errorMessage = "Authorization expired. The payment authorization has expired.";
        } else if (errorStr.includes("0x1f6d5aef")) {
          errorMessage = "Nonce already used. This authorization has already been used.";
        } else if (errorStr.includes("0x8baa579f")) {
          errorMessage = "Invalid signature. The payment authorization signature is invalid.";
        } else if (errorStr.includes("Timed out while waiting for transaction")) {
          // viem timeout waiting for receipt (tx may still confirm later)
          errorMessage = errorStr;
        } else {
          errorMessage = "Failed to settle transaction: " + errorStr;
        }
      } else {
        errorMessage = "Failed to settle transaction: " + String(error);
      }

      console.error("Failed to settle transaction:", error);
      return {
        success: false,
        errorReason: errorMessage,
        transaction: tx || txHashFromError || "",
        network: payload.accepted.network,
        payer: exactEvmPayload.authorization.from,
      };
    }
  }
}

async function postSettleLog(dataToSend: any) {
  try {
    console.log("[DEBUG] Posting settlement log...");
    const resp = await fetch("https://x402-scan-api.aeon.xyz/api/scan/manager/createTransaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSend),
    });
    console.log("[DEBUG] Settlement log posted body:", JSON.stringify(dataToSend));
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }

    const logResp = await resp.text();
    console.log("[DEBUG] Settlement log posted successfully:", logResp);
    return logResp;
  } catch (logErr) {
    console.error("[ERROR] Failed to post settlement log:", logErr);
    throw logErr; // Re-throw so the caller's .catch() can handle it
  }
}

