/**
 * 代币工具类：简化版 - getTokenSymbolByAddress 仅需传入合约地址（自动匹配多链）
 */
export class TokenSymbolUtil {
    // 核心映射表：链ID -> 合约地址(小写) -> { symbol: 代币符号, name: 代币全称 }
    private static readonly TOKEN_MAPPING: Record<string, Record<string, { symbol: string; name: string }>> = {
        "56": {
            "0x55d398326f99059ff775485246999027b3197955": { symbol: "USDT", name: "Tether USD" },
            "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": { symbol: "USDC", name: "USD Coin" },
            "0x6e3bcf81d331fa7bd79ac2642486c70beae2600e": { symbol: "TESTU", name: "Test USDT" }
        },
        "8453": {
            "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC", name: "USD Coin" },
            "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": { symbol: "USDT", name: "Tether USD" }
        },
        "196": {
            "0x779ded0c9e1022225f8e0630b35a9b54be713736": { symbol: "USDT", name: "Tether USD" },
            "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC", name: "USD Coin" }
        }
    };

    // 缓存：合约地址(小写) -> 代币符号（全局缓存，跨链）
    private static readonly CACHE = new Map<string, string>();

    /**
     * 简化版核心方法：仅传入合约地址，自动匹配所有链的代币符号
     * @param tokenAddress 代币合约地址（大小写不敏感）
     * @returns 代币符号（如"USDC"/"USDT"），未匹配返回空字符串
     */
    public static getTokenSymbolByAddress(tokenAddress: string): string {
        // 1. 参数标准化（空值/格式校验）
        const normalizedAddress = tokenAddress?.trim().toLowerCase() || "";
        if (!normalizedAddress || !normalizedAddress.startsWith("0x")) {
            return "";
        }

        // 2. 优先查缓存
        if (this.CACHE.has(normalizedAddress)) {
            return this.CACHE.get(normalizedAddress)!;
        }

        // 3. 遍历所有链，匹配地址
        let tokenSymbol = "";
        for (const chainId of Object.keys(this.TOKEN_MAPPING)) {
            const chainMapping = this.TOKEN_MAPPING[chainId];
            if (chainMapping[normalizedAddress]) {
                tokenSymbol = chainMapping[normalizedAddress].symbol;
                break; // 找到第一个匹配项即可（若地址跨链重复，取第一个匹配的）
            }
        }

        // 4. 缓存结果（即使未匹配也缓存，避免重复遍历）
        this.CACHE.set(normalizedAddress, tokenSymbol);

        return tokenSymbol;
    }

    /**
     * 简化版：仅传入合约地址，获取代币全称
     * @param tokenAddress 合约地址
     * @returns 代币全称，未匹配返回空字符串
     */
    public static getTokenNameByAddress(tokenAddress: string): string {
        const normalizedAddress = tokenAddress?.trim().toLowerCase() || "";
        if (!normalizedAddress || !normalizedAddress.startsWith("0x")) {
            return "";
        }

        // 遍历所有链匹配
        for (const chainId of Object.keys(this.TOKEN_MAPPING)) {
            const chainMapping = this.TOKEN_MAPPING[chainId];
            if (chainMapping[normalizedAddress]) {
                return chainMapping[normalizedAddress].name;
            }
        }
        return "";
    }

    /**
     * 扩展映射表（支持单地址多链，或新增地址）
     * @param chainId 链ID
     * @param tokenAddress 合约地址
     * @param symbol 代币符号
     * @param name 代币全称
     */
    public static extendTokenMapping(
        chainId: number | string,
        tokenAddress: string,
        symbol: string,
        name: string
    ): void {
        const normalizedChainId = String(chainId).trim();
        const normalizedAddress = tokenAddress.trim().toLowerCase();
        const normalizedSymbol = symbol.trim().toUpperCase();
        const normalizedName = name.trim();

        if (!normalizedChainId || !normalizedAddress || !normalizedSymbol || !normalizedName) return;

        // 初始化链映射
        if (!this.TOKEN_MAPPING[normalizedChainId]) {
            this.TOKEN_MAPPING[normalizedChainId] = {};
        }
        this.TOKEN_MAPPING[normalizedChainId][normalizedAddress] = {
            symbol: normalizedSymbol,
            name: normalizedName
        };

        // 清空该地址的缓存
        this.CACHE.delete(normalizedAddress);
    }

    /**
     * 清空缓存
     */
    public static clearCache(): void {
        this.CACHE.clear();
    }
}