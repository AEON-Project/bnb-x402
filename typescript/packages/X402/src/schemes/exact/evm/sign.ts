import {
    EvmAuthorizationParameters,
    PaymentRequirements,
} from "../../../types/index.js";
import {stringToHex} from "../../../shared/encoding.js";
import {evm} from "../../../shared/index.js";
import {WalletClient, PublicActions, Hex, encodeFunctionData} from "viem";
import {verifyTransferWithAuthorizationSupport} from "./utils/contractUtils.js";

const ERC20_ABI = [
    {
        name: "transfer",
        type: "function",
        inputs: [
            {name: "to", type: "address"},
            {name: "value", type: "uint256"},
        ],
        outputs: [{name: "success", type: "bool"}],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "approve",
        inputs: [
            {name: "spender", type: "address"},
            {name: "amount", type: "uint256"}
        ],
        outputs: [{name: "success", type: "bool"}],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "allowance",
        inputs: [
            {name: "owner", type: "address"},
            {name: "spender", type: "address"}
        ],
        outputs: [{name: "remaining", type: "uint256"}],
        stateMutability: "view",
    },
] as const;


// Utility function to detect wallet type
function isLocalSigner(client: WalletClient & PublicActions): boolean {
    // Check if client has a local account that can sign transactions directly
    // This should be true for viem clients created with privateKeyToAccount
    return !!(client.account && client.account.type === 'local');
}


// Utility function to create transaction request
async function createTransactionRequest(
    client: WalletClient & PublicActions,
    from: string,
    to: string,
    value: bigint,
    tokenAddress: string | undefined,
    networkId: string
) {
    const chain = evm.getChain(networkId);
    const account = from as Hex;

    // Get current gas price and nonce in parallel
    const [gasPrice, nonce] = await Promise.all([
        client.getGasPrice(),
        client.getTransactionCount({address: account}),
    ]);

    let baseRequest;

    if (tokenAddress === evm.ZERO_ADDRESS) {
        // Native token transfer
        baseRequest = {
            account,
            to: to as Hex,
            value,
            gasPrice,
            nonce,
            chain,
            chainId: chain.id,
        };
    } else {
        // ERC20 token transfer
        const data = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [to as Hex, value],
        });

        baseRequest = {
            account,
            to: tokenAddress as Hex,
            data,
            gasPrice,
            nonce,
            chain,
            chainId: chain.id,
        };
    }

    // Estimate gas for the transaction
    const gas = await client.estimateGas({
        account: baseRequest.account,
        to: baseRequest.to,
        value: baseRequest.value,
        data: baseRequest.data,
    });

    return {
        ...baseRequest,
        gas,
    };
}

async function signAuthorizationEip3009(
    client: WalletClient & PublicActions,
    {
        from,
        to,
        value,
    }: Pick<EvmAuthorizationParameters, "from" | "to" | "value">,
    {
        tokenAddress,
        networkId,
        estimatedProcessingTime,
    }: Pick<
        PaymentRequirements,
        "tokenAddress" | "networkId" | "estimatedProcessingTime"
    >
): Promise<{
    type: "signature";
    signature: Hex;
    nonce: Hex;
    version: string;
    validAfter: bigint;
    validBefore: bigint;
}> {
    try {
        const nonce = evm.createNonce();
        const currentTime = Math.floor(Date.now() / 1000);
        const validAfter = BigInt(currentTime - 60); // 1 minute before current time for safety
        const validBefore = BigInt(currentTime + (estimatedProcessingTime ?? 600)); // 10 minutes from now

        // const verifyingContract = "0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e";
        const {domain} = await client.getEip712Domain({
            address: tokenAddress?.toLowerCase() as Hex,
        });
        const data = {
            types: {
                TransferWithAuthorization: [
                    {name: "from", type: "address"},
                    {name: "to", type: "address"},
                    {name: "value", type: "uint256"},
                    {name: "validAfter", type: "uint256"},
                    {name: "validBefore", type: "uint256"},
                    {name: "nonce", type: "bytes32"},
                ],
            },
            domain: {
                name: domain.name,
                version: domain.version,
                chainId: parseInt(networkId),
                verifyingContract: tokenAddress?.toLowerCase() as Hex,
            },
            primaryType: "TransferWithAuthorization" as const,
            message: {
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
            },
        };
        let signature: Hex;

        console.log("Handle different wallet types for signing (EIP3009)");
        console.log("[DEBUG] client.account exists:", !!client.account);
        console.log("[DEBUG] client.account.type:", client.account?.type);
        console.log("[DEBUG] client.account.signTypedData exists:", !!client.account?.signTypedData);
        console.log("[DEBUG] client.account.signTypedData type:", typeof client.account?.signTypedData);
        console.log("[DEBUG] client.account keys:", client.account ? Object.keys(client.account) : "no account");

        // For all wallet types, use the same signing method
        // viem handles the differences internally
        if (!client.account) {
            throw new Error("No account available for signing");
        }

        console.log("[DEBUG] Signing TransferWithAuthorization");
        try {
            if (client.account.signTypedData) {
                signature = (await client.account.signTypedData(data)) as Hex;
            } else {
                throw new Error("signTypedData method not available on account");
            }
        } catch (signError) {
            console.error("[ERROR] Failed to sign with account.signTypedData:", signError);
            // Try alternative signing method using the client directly
            try {
                console.log("[DEBUG] Trying client.signTypedData as fallback");
                console.log("[DEBUG] client.signTypedData exists:", !!client.signTypedData);
                console.log("[DEBUG] client.signTypedData type:", typeof client.signTypedData);
                console.log("[DEBUG] client keys:", Object.keys(client));

                if (client.signTypedData) {
                    signature = (await client.signTypedData({
                        ...data,
                        account: client.account
                    })) as Hex;
                } else {
                    throw new Error("client.signTypedData method not available");
                }
            } catch (clientSignError) {
                console.error("[ERROR] Failed to sign with client.signTypedData:", clientSignError);
                throw new Error(`Failed to sign typed data: ${signError instanceof Error ? signError.message : String(signError)}`);
            }
        }
        console.log("[DEBUG] TransferWithAuthorization signature:", signature);

        return {
            type: "signature",
            signature,
            nonce,
            version: "1",
            validAfter,
            validBefore,
        };
    } catch (error) {
        console.error("[ERROR] signAuthorizationEip3009 outer catch:", error);
        throw new Error(
            `Failed to sign authorization: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

async function signAuthorization(
    client: WalletClient & PublicActions,
    {
        from,
        to,
        value,
    }: Pick<EvmAuthorizationParameters, "from" | "to" | "value">,
    {
        tokenAddress,
        networkId,
        estimatedProcessingTime,
    }: Pick<
        PaymentRequirements,
        "tokenAddress" | "networkId" | "estimatedProcessingTime"
    >
): Promise<{
    type: "signature";
    signature: Hex;
    nonce: Hex;
    version: string;
    validAfter: bigint;
    validBefore: bigint;
}> {
    try {
        const facilitatorAddress = "0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e" as Hex;

        // Pre-approval: Check and approve token allowance if needed
        try {
            console.log("Check current allowance")
            // Check current allowance
            const currentAllowance = await client.readContract({
                address: tokenAddress as Hex,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [from as Hex, facilitatorAddress],
            }) as bigint;

            // Check if approval is needed

            // If allowance is insufficient, approve the required amount
            // Insufficient allowance, need to approve
            console.log("Insufficient allowance, need to approve")
            let approveTxHash: Hex;

            // Check if this is a local signer (private key account)
            if (client.account && client.account.type === 'local') {
                // For local signers, we need to build and sign the transaction manually
                console.log("For local signers, we need to build and sign the transaction manually")
                const approvalData = encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [facilitatorAddress, value],
                });

                console.log(" Get gas price and nonce")
                // Get gas price and nonce
                const [gasPrice, nonce] = await Promise.all([
                    client.getGasPrice(),
                    client.getTransactionCount({address: from as Hex}),
                ]);

                // Estimate gas for approval
                console.log(" Estimate gas for approval")
                const gas = await client.estimateGas({
                    account: from as Hex,
                    to: tokenAddress as Hex,
                    data: approvalData,
                });

                // Sign the approval transaction
                console.log("Sign the approval transaction")
                const signedApprovalTx = await client.account.signTransaction({
                    account: from as Hex,
                    to: tokenAddress as Hex,
                    data: approvalData,
                    gas,
                    gasPrice,
                    nonce,
                    chain: evm.getChain(networkId),
                    chainId: evm.getChain(networkId).id,
                });

                // Broadcast the signed transaction
                approveTxHash = await client.sendRawTransaction({
                    serializedTransaction: signedApprovalTx,
                });
                console.log("Broadcast the signed transaction")
            } else {
                // For external wallets like MetaMask
                console.log("For external wallets like MetaMask")
                approveTxHash = await client.sendTransaction({
                    account: from as Hex,
                    to: tokenAddress as Hex,
                    data: encodeFunctionData({
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [facilitatorAddress, value],
                    }),
                    chain: evm.getChain(networkId),
                });
                console.log("For external wallets like MetaMask approveTxHash:", approveTxHash)
            }

            // Wait for approval transaction to be confirmed
            const approvalReceipt = await client.waitForTransactionReceipt({
                hash: approveTxHash,
            });

            if (approvalReceipt.status !== "success") {
                throw new Error("Token approval transaction failed");
            }

        } catch (error) {
            console.error("[ERROR] Failed to handle token approval:", error);
            throw new Error(`Failed to approve tokens: ${error instanceof Error ? error.message : String(error)}`);
        }

        const nonce = evm.createNonce();
        const currentTime = Math.floor(Date.now() / 1000);
        const validAfter = BigInt(currentTime - 60); // 1 minute before current time for safety
        const validBefore = BigInt(currentTime + (estimatedProcessingTime ?? 600)); // 10 minutes from now

        const verifyingContract = "0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e";

        const data = {
            types: {
                tokenTransferWithAuthorization: [
                    {name: "token", type: "address"},
                    {name: "from", type: "address"},
                    {name: "to", type: "address"},
                    {name: "value", type: "uint256"},
                    {name: "validAfter", type: "uint256"},
                    {name: "validBefore", type: "uint256"},
                    {name: "nonce", type: "bytes32"},
                    {name: "needApprove", type: "bool"},
                ],
            },
            domain: {
                name: "Facilitator",
                version: "1",
                chainId: parseInt(networkId),
                verifyingContract: verifyingContract as Hex,
            },
            primaryType: "tokenTransferWithAuthorization" as const,
            message: {
                token: tokenAddress?.toLowerCase(),
                from: from.toLowerCase(),
                to: to.toLowerCase(),
                value,
                validAfter,
                validBefore,
                nonce,
                needApprove: true,
            },
        };
        let signature: Hex;

        console.log("Handle different wallet types for signing");
        console.log("[DEBUG] client.account exists:", !!client.account);
        console.log("[DEBUG] client.account.type:", client.account?.type);
        console.log("[DEBUG] client.account.signTypedData exists:", !!client.account?.signTypedData);
        console.log("[DEBUG] client.account.signTypedData type:", typeof client.account?.signTypedData);
        console.log("[DEBUG] client.account keys:", client.account ? Object.keys(client.account) : "no account");

        // For all wallet types, use the same signing method
        // viem handles the differences internally
        if (!client.account) {
            throw new Error("No account available for signing");
        }

        console.log("[DEBUG] Signing tokenTransferWithAuthorization");
        try {
            if (client.account.signTypedData) {
                signature = (await client.account.signTypedData(data)) as Hex;
            } else {
                throw new Error("signTypedData method not available on account");
            }
        } catch (signError) {
            console.error("[ERROR] Failed to sign with account.signTypedData:", signError);
            console.log("[DEBUG] Entering fallback signing method");
            // Try alternative signing method using the client directly
            try {
                console.log("[DEBUG] Trying client.signTypedData as fallback");
                console.log("[DEBUG] client.signTypedData exists:", !!client.signTypedData);
                console.log("[DEBUG] client.signTypedData type:", typeof client.signTypedData);
                console.log("[DEBUG] client keys:", Object.keys(client));

                if (client.signTypedData) {
                    console.log("[DEBUG] About to call client.signTypedData");
                    signature = (await client.signTypedData({
                        ...data,
                        account: client.account
                    })) as Hex;
                    console.log("[DEBUG] client.signTypedData succeeded");
                } else {
                    console.log("[DEBUG] client.signTypedData not available, throwing error");
                    throw new Error("client.signTypedData method not available");
                }
            } catch (clientSignError) {
                console.error("[ERROR] Failed to sign with client.signTypedData:", clientSignError);
                console.log("[DEBUG] Both signing methods failed, throwing final error");
                throw new Error(`Failed to sign typed data: ${signError instanceof Error ? signError.message : String(signError)}`);
            }
        }
        console.log("[DEBUG] tokenTransferWithAuthorization signature:", signature);

        return {
            type: "signature",
            signature,
            nonce,
            version: "1",
            validAfter,
            validBefore,
        };
    } catch (error) {
        console.error("[ERROR] signAuthorization outer catch:", error);
        throw new Error(
            `Failed to sign authorization: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}


export {
    signAuthorization,
    signAuthorizationEip3009,
};
