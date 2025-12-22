import {WalletClient, PublicActions, Hex, LocalAccount, Transport, Chain} from "viem";
import {SignerWallet} from "../../../../types/shared/evm";

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
 * 检查代币合约是否支持TransferWithAuthorization函数
 * 使用readContract方法来检测函数是否存在（ERC-3009）
 * @param client - viem客户端实例
 * @param tokenAddress - 代币合约地址
 * @returns Promise<boolean> - 如果合约支持该函数返回true，否则返回false
 */
async function hasTransferWithAuthorization <transport extends Transport, chain extends Chain>(
    client: SignerWallet<chain, transport> | LocalAccount,
    tokenAddress: string
): Promise<boolean> {
    try {
        console.log(`[DEBUG] Checking if contract ${tokenAddress} supports TransferWithAuthorization using readContract...`);

        // 尝试读取合约函数来检测是否存在
        // 这里我们不需要实际调用函数，只需要检查函数是否存在
        // 使用readContract会在函数不存在时抛出错误
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

        // 检查是否是函数不存在的错误
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

        // 检查是否是业务逻辑错误（说明函数存在但参数无效）
        if (errorMessage.toLowerCase().includes('authorization is expired') ||
            errorMessage.toLowerCase().includes('invalid signature') ||
            errorMessage.toLowerCase().includes('authorization is used') ||
            errorMessage.toLowerCase().includes('authorization is not yet valid') ||
            errorMessage.toLowerCase().includes('invalid authorization') ||
            errorMessage.toLowerCase().includes('invalid signature length')) {
            console.log(`[DEBUG] Function exists on ${tokenAddress} but failed due to invalid parameters (expected)`);
            return true;
        }

        // 检查是否是一般的执行回滚错误 - 这通常意味着函数不存在
        if (errorMessage.toLowerCase().includes('execution reverted: 0x') ||
            (errorMessage.toLowerCase().includes('execution reverted') && !errorMessage.toLowerCase().includes(':'))) {
            console.log(`[DEBUG] Function call reverted for ${tokenAddress} - likely function does not exist`);
            return false;
        }

        // 对于其他类型的错误，保守地返回false
        console.log(`[DEBUG] Unknown error for ${tokenAddress}, assuming function does not exist`);
        return false;
    }
}

/**
 * 验证代币合约是否支持TransferWithAuthorization函数并记录结果
 * @param client - viem客户端实例
 * @param tokenAddress - 代币合约地址
 * @param enableLogging - 是否启用日志输出，默认为true
 * @returns Promise<boolean> - 验证结果
 */
async function verifyTransferWithAuthorizationSupport<transport extends Transport, chain extends Chain>(
    walletClient: SignerWallet<chain, transport> | LocalAccount,
    tokenAddress: string,
    enableLogging: boolean = true
): Promise<boolean> {
    const supportsTransferWithAuthorization = await hasTransferWithAuthorization(walletClient, tokenAddress);

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
