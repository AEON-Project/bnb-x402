import { ethers } from "ethers";
import { PaymasterClient } from "megafuel-js-sdk";

/**
 * Gasless 提现工具类
 * 拆分验证和执行步骤，支持独立调用
 */
export class ZeroGasTool {
  private sponsorUrl: string;
  private policyUUID: string;
  private evmPrivateKey: string;
  private tokenContractAddress: string;
  private wallet: ethers.Wallet;
  private paymasterClient: PaymasterClient;
  private pendingNonce: number | null = null; // 记录待执行的 nonce

  /**
   *
   */
  constructor() {
    // 初始化配置
    this.sponsorUrl =
      "https://open-platform-ap.nodereal.io/*******/megafuel/56";
    this.policyUUID = "**************";
    this.evmPrivateKey = process.env.EVM_PRIVATE_KEY as string;
    this.tokenContractAddress = "0x555e3311a9893c9b17444c1ff0d88192a57ef13e";

    // 初始化钱包和Paymaster客户端
    this.wallet = new ethers.Wallet(this.evmPrivateKey);
    this.paymasterClient = PaymasterClient.newPrivatePaymaster(this.sponsorUrl, this.policyUUID);
  }

  /**
   * 获取最新的 nonce，始终从链上获取
   *
   * @param usePending - 是否包含待处理的交易，默认为 true
   */
  private async getLatestNonce(usePending: boolean = true): Promise<number> {
    const status = usePending ? "pending" : "latest";
    const currentNonce = await this.paymasterClient.getTransactionCount(
      this.wallet.address,
      status,
    );
    console.log(`📊 获取链上最新 nonce (${status}): ${currentNonce}`);
    return currentNonce;
  }

  /**
   * 重置待执行的 nonce（验证失败时调用）
   */
  private resetPendingNonce(): void {
    this.pendingNonce = null;
    console.log(`🔄 重置待执行的 nonce`);
  }

  /**
   * 设置待执行的 nonce
   *
   * @param nonce
   */
  private setPendingNonce(nonce: number): void {
    this.pendingNonce = nonce;
    console.log(`📌 设置待执行的 nonce: ${nonce}`);
  }

  /**
   * 第一步：验证交易是否可赞助（独立对外方法）
   *
   * @param funData - 函数调用数据
   * @param gasLimit - Gas限制
   * @returns 可赞助信息
   */
  async validateGaslessWithdraw2(funData: any, gasLimit: number = 150000): Promise<any> {
    try {
      // 参数验证
      if (!funData) throw new Error("funData参数不能为空");
      if (!funData.abi) throw new Error("ABI不能为空");
      if (!funData.functionName) throw new Error("functionName不能为空");
      if (!funData.args) throw new Error("args不能为空");

      // 获取网络信息
      const network = await this.paymasterClient.getNetwork();

      // 构建合约实例
      const tokenContract = new ethers.Contract(
        this.tokenContractAddress,
        funData.abi,
        this.wallet,
      );

      // 构建交易对象 - 直接使用 funData.args，因为它已经包含了正确的参数顺序
      const transaction = await tokenContract[funData.functionName].populateTransaction(
        ...funData.args,
      );

      // 获取最新的 nonce（仅用于验证，执行时会重新获取）
      const nonce = await this.getLatestNonce();
      // 记录验证时的 nonce（用于调试，执行时会重新获取）
      this.setPendingNonce(nonce);

      // 交易配置
      const txConfig = {
        ...transaction,
        from: this.wallet.address,
        nonce,
        gasLimit,
        chainId: network.chainId,
        gasPrice: 0,
      };

      // 安全格式用于验证
      const safeTransaction = {
        ...txConfig,
        gasLimit: txConfig.gasLimit.toString(),
        chainId: txConfig.chainId.toString(),
        gasPrice: txConfig.gasPrice.toString(),
      };

      // 核心验证：检查是否可赞助
      console.log("🔍 验证交易可赞助性...");
      const sponsorableInfo = await this.paymasterClient.isSponsorable(safeTransaction);

      // 使用动态 JSON 方式获取属性值，避免 TypeScript 类型限制
      const sponsorableData = JSON.parse(JSON.stringify(sponsorableInfo || {}));
      console.log("📊 validateGaslessWithdraw2 - sponsorableInfo:", sponsorableData);
      console.log("📊 validateGaslessWithdraw2 - 属性列表:", Object.keys(sponsorableData));

      // 尝试两种属性名
      const isSponsorable = sponsorableData.sponsorable || sponsorableData.Sponsorable;
      console.log("📊 validateGaslessWithdraw2 - 是否可赞助:", isSponsorable);

      if (!isSponsorable) {
        // 验证失败，重置 nonce
        this.resetPendingNonce();
        throw new Error("交易不可被赞助");
      }

      console.log("✅ 交易验证通过，可执行");
      return {
        isValid: true,
        sponsorableInfo,
        txConfig, // 返回交易配置供执行步骤使用
        nonce,
      };
    } catch (error) {
      console.error("❌ 验证失败:", error);
      // 验证失败时重置 nonce
      this.resetPendingNonce();
      return {
        isValid: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 第二步：执行提现交易（独立对外方法）
   *
   * @param txConfig - 验证步骤返回的交易配置
   * @param maxRetries - 最大重试次数，默认为 5
   * @returns 交易哈希
   */
  async executeGaslessWithdraw(txConfig: any, maxRetries: number = 5): Promise<string> {
    if (!txConfig) throw new Error("交易配置不能为空");

    let lastError: Error | null = null;
    let lastUsedNonce: number | null = null;

    // 重试机制：处理 nonce 冲突
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 每次重试都获取最新的 nonce，避免使用已使用的 nonce
        const latestNonce = await this.getLatestNonce(true);

        // 如果是重试，说明之前的 nonce 可能已被使用
        if (attempt > 0) {
          console.log(`🔄 重试第 ${attempt} 次，获取最新 nonce: ${latestNonce}`);
          if (lastUsedNonce !== null) {
            console.log(`📊 上次使用的 nonce: ${lastUsedNonce}, 当前链上 nonce: ${latestNonce}`);
          }
        } else {
          console.log(`📊 执行交易，使用 nonce: ${latestNonce}`);
        }

        const updatedTxConfig = {
          ...txConfig,
          nonce: latestNonce,
        };
        console.log(`✍️ 签名交易... (使用 nonce: ${latestNonce})`);
        const signedTx = await this.wallet.signTransaction(updatedTxConfig);

        // 发送交易
        console.log("📤 发送交易...");
        const txHash = await this.paymasterClient.sendRawTransaction(signedTx);

        // 交易发送成功后，重置待执行的 nonce
        this.resetPendingNonce();

        console.log(`🎉 交易发送成功: ${txHash}`);
        return txHash;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message.toLowerCase();

        // 检查是否是 nonce 相关的错误
        const isNonceTooLow =
          errorMessage.includes("nonce too low") ||
          errorMessage.includes("nonce is too low") ||
          errorMessage.includes("nonce too small");
        const isNonceTooHigh =
          errorMessage.includes("nonce too high") ||
          errorMessage.includes("nonce is too high") ||
          errorMessage.includes("nonce too large");
        const isNonceUsed =
          errorMessage.includes("already been used") || errorMessage.includes("nonce already used");
        const isNonceError =
          isNonceTooLow || isNonceTooHigh || isNonceUsed || errorMessage.includes("nonce");

        if (isNonceError && attempt < maxRetries) {
          // 记录当前使用的 nonce
          const currentNonce = await this.getLatestNonce(true);
          lastUsedNonce = currentNonce;

          if (isNonceTooLow) {
            // nonce too low: 说明链上的 nonce 已经增加了，需要等待并重新获取
            console.log(
              `⚠️ Nonce too low (当前: ${currentNonce})，等待链状态更新后重试... (${attempt + 1}/${maxRetries})`,
            );
            // 等待更长时间，让链状态更新
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
          } else if (isNonceTooHigh) {
            // nonce too high: 说明跳过了某些 nonce，需要获取最新的 nonce
            console.log(
              `⚠️ Nonce too high (当前: ${currentNonce})，立即获取最新 nonce 重试... (${attempt + 1}/${maxRetries})`,
            );
            // 获取 latest 状态的 nonce（不包含 pending）
            const latestNonce = await this.getLatestNonce(false);
            console.log(`📊 Latest nonce (不包含 pending): ${latestNonce}`);
            // 短暂等待后重试
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (isNonceUsed) {
            // nonce 已被使用: 需要等待并获取新的 nonce
            console.log(`⚠️ Nonce 已被使用，等待后重试... (${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
          } else {
            // 其他 nonce 错误
            console.log(`⚠️ Nonce 错误，等待后重试... (${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
          continue;
        } else {
          // 如果不是 nonce 错误，或者已达到最大重试次数，抛出错误
          console.error(`❌ 执行交易失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, lastError);
          this.resetPendingNonce();
          throw lastError;
        }
      }
    }

    // 如果所有重试都失败
    this.resetPendingNonce();
    throw lastError || new Error("执行交易失败：未知错误");
  }
}

