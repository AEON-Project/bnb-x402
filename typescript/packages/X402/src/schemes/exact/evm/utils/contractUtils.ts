import { WalletClient, PublicActions, Hex } from "viem";

// TransferWithAuthorization function ABI for verification (ERC-3009)
const TRANSFER_WITH_AUTHORIZATION_ABI = [
    {
        name: "transferWithAuthorization",
        type: "function",
        inputs: [
            {
                internalType: "address",
                name: "from",
                type: "address"
            },
            {
                internalType: "address",
                name: "to",
                type: "address"
            },
            {
                internalType: "uint256",
                name: "value",
                type: "uint256"
            },
            {
                internalType: "uint256",
                name: "validAfter",
                type: "uint256"
            },
            {
                internalType: "uint256",
                name: "validBefore",
                type: "uint256"
            },
            {
                internalType: "bytes32",
                name: "nonce",
                type: "bytes32"
            },
            {
                internalType: "bytes",
                name: "signature",
                type: "bytes"
            }
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
] as const;

/**
 * Check whether the token contract supports the TransferWithAuthorization function
 * Use the `readContract` method to detect whether a function exists (ERC-3009)
 * @param client - Viem client instance
 * @param tokenAddress - Token contract address
 * @returns Promise<boolean> - Returns true if the contract supports the function, otherwise returns false
 */
async function hasTransferWithAuthorization(
    client: WalletClient & PublicActions,
    tokenAddress: string
): Promise<boolean> {
    try {
        console.log(`[DEBUG] Checking if contract ${tokenAddress} supports TransferWithAuthorization using readContract...`);

        // Attempt to read the contract function to detect its existence
        // Here we don't need to actually call the function, we just need to check if the function exists
        // Using readContract will throw an error when the function does not exist
        await (client as any).readContract({
            address: tokenAddress as Hex,
            abi: TRANSFER_WITH_AUTHORIZATION_ABI,
            functionName: "transferWithAuthorization",
            args: [
                '0x0000000000000000000000000000000000000000', // from
                '0x0000000000000000000000000000000000000000', // to
                BigInt(0), // value
                BigInt(0), // validAfter
                BigInt(0), // validBefore
                '0x0000000000000000000000000000000000000000000000000000000000000000', // nonce
                '0x', // signature (empty bytes)
            ],
        });
        
        console.log(`[DEBUG] readContract succeeded for ${tokenAddress} - function exists`);
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`[DEBUG] readContract failed for ${tokenAddress}:`, errorMessage);

        // Check for errors that the function will not occur
        if (errorMessage.toLowerCase().includes('function does not exist') || 
            errorMessage.toLowerCase().includes('method not found') ||
            errorMessage.toLowerCase().includes('unknown method') ||
            errorMessage.toLowerCase().includes('function selector not found') ||
            errorMessage.toLowerCase().includes('no matching function') ||
            errorMessage.toLowerCase().includes('invalid function selector') ||
            errorMessage.toLowerCase().includes('function not found') ||
            (errorMessage.toLowerCase().includes('contract function') && errorMessage.toLowerCase().includes('not found'))) {
            console.log(`[DEBUG] Function does not exist on contract ${tokenAddress}`);
            return false;
        }

        // Check for business logic errors (indicating that the function exists but the parameters are invalid)
        if (errorMessage.toLowerCase().includes('authorization is expired') ||
            errorMessage.toLowerCase().includes('invalid signature') ||
            errorMessage.toLowerCase().includes('authorization is used') ||
            errorMessage.toLowerCase().includes('authorization is not yet valid') ||
            errorMessage.toLowerCase().includes('invalid authorization') ||
            errorMessage.toLowerCase().includes('invalid signature length')) {
            console.log(`[DEBUG] Function exists on ${tokenAddress} but failed due to invalid parameters (expected)`);
            return true;
        }

        // Check whether it is a general execution rollback error - this usually indicates that the function does not exist
        if (errorMessage.toLowerCase().includes('execution reverted: 0x') ||
            (errorMessage.toLowerCase().includes('execution reverted') && !errorMessage.toLowerCase().includes(':'))) {
            console.log(`[DEBUG] Function call reverted for ${tokenAddress} - likely function does not exist`);
            return false;
        }

        // For other types of errors, conservatively return false
        console.log(`[DEBUG] Unknown error for ${tokenAddress}, assuming function does not exist`);
        return false;
    }
}

/**
 * Verify whether the token contract supports the TransferWithAuthorization function and record the result
 * @param client - viem client instance
 * @param tokenAddress - Token contract address
 * @param enableLogging - Whether to enable log output, defaults to true
 * @returns Promise<boolean> - Verification result
 */
async function verifyTransferWithAuthorizationSupport(
    client: WalletClient & PublicActions,
    tokenAddress: string,
    enableLogging: boolean = true
): Promise<boolean> {
    const supportsTransferWithAuthorization = await hasTransferWithAuthorization(client, tokenAddress);
    
    if (enableLogging) {
        console.log(`[DEBUG] Token contract ${tokenAddress} supports TransferWithAuthorization: ${supportsTransferWithAuthorization}`);
    }
    
    return supportsTransferWithAuthorization;
}

export {
    hasTransferWithAuthorization,
    verifyTransferWithAuthorizationSupport,
    TRANSFER_WITH_AUTHORIZATION_ABI,
};
