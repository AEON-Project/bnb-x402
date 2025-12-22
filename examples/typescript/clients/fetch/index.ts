import { config } from "dotenv";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http, publicActions } from "viem";
import { bsc, xLayer, base } from "viem/chains";
import { createKeyPairSignerFromBytes, createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import { base58 } from "@scure/base";

config();

const evmPrivateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
const svmPrivateKey = process.env.SVM_PRIVATE_KEY as string;
const baseURL = process.env.RESOURCE_SERVER_URL || "http://localhost:4021";
const endpointPath = process.env.ENDPOINT_PATH || "/weather";
const url = `${baseURL}${endpointPath}`;

/**
 * Creates a Solana signer from a private key, supporting multiple formats.
 *
 * @param privateKey - Base58 or hex encoded private key
 * @returns A Solana TransactionSigner
 */
async function createSvmSignerFromPrivateKey(privateKey: string) {
  const trimmedKey = privateKey.trim();
  let keyBytes: Uint8Array;

  // Try to decode as base58 first
  try {
    keyBytes = base58.decode(trimmedKey);
  } catch (base58Error) {
    // If base58 decode fails, try hex format
    if (trimmedKey.startsWith("0x") || /^[0-9a-fA-F]+$/.test(trimmedKey)) {
      const hexKey = trimmedKey.startsWith("0x") ? trimmedKey.slice(2) : trimmedKey;

      if (hexKey.length === 64) {
        // 32 bytes hex = 64 hex chars (private key only)
        keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      } else if (hexKey.length === 128) {
        // 64 bytes hex = 128 hex chars (private + public key)
        keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      } else {
        throw new Error(
          `Invalid SVM private key format. Expected base58 string or hex string (64 or 128 chars). ` +
            `Got ${hexKey.length} hex characters. ` +
            `Base58 error: ${base58Error instanceof Error ? base58Error.message : String(base58Error)}`,
        );
      }
    } else {
      throw new Error(
        `Invalid SVM private key format. Expected base58 string or hex string. ` +
          `Base58 decode error: ${base58Error instanceof Error ? base58Error.message : String(base58Error)}`,
      );
    }
  }

  // Create signer based on key length
  if (keyBytes.length === 64) {
    // 64 bytes = concatenated private + public key
    return await createKeyPairSignerFromBytes(keyBytes);
  } else if (keyBytes.length === 32) {
    // 32 bytes = private key only
    return await createKeyPairSignerFromPrivateKeyBytes(keyBytes);
  } else {
    throw new Error(
      `Invalid SVM private key length: ${keyBytes.length} bytes. Expected 32 or 64 bytes.`,
    );
  }
}

/**
 * Example demonstrating how to use @x402/fetch to make requests to x402-protected endpoints.
 *
 * This uses the helper registration functions from @x402/evm and @x402/svm to register
 * all supported networks for both v1 and v2 protocols.
 *
 * Required environment variables:
 * - EVM_PRIVATE_KEY: The private key of the EVM signer
 * - SVM_PRIVATE_KEY: The private key of the SVM signer
 */
async function main(): Promise<void> {
  const evmAccount = privateKeyToAccount(evmPrivateKey);
  const svmSigner = await createSvmSignerFromPrivateKey(svmPrivateKey);

  // NOTE:
  // The EVM client scheme may need on-chain reads (readContract) and an approve tx (sendTransaction)
  // depending on the token/payment flow. A bare `LocalAccount` only supports signing, so we wrap it
  // with viem clients to provide the missing capabilities.
  // const publicClient = createPublicClient({
  //   chain: bsc,
  //   transport: http(),
  // });
  const walletClient = createWalletClient({
    account: evmAccount,
    chain: xLayer,
    transport: http(),
  }).extend(publicActions);

  const evmSigner = toClientEvmSigner({
    address: evmAccount.address,
    signTypedData: message => evmAccount.signTypedData(message as never),
    readContract: args =>
      walletClient.readContract({
        ...args,
        args: args.args || [],
      } as never),
    sendTransaction: args =>
      walletClient.sendTransaction({
        to: args.to,
        data: args.data,
      } as never),
    waitForTransactionReceipt: (args: { hash: `0x${string}` }) =>
      walletClient.waitForTransactionReceipt(args),
  });

  const client = new x402Client();
  registerExactEvmScheme(client, { signer: evmSigner });
  registerExactSvmScheme(client, { signer: svmSigner });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  console.log(`Making request to: ${url}\n`);
  const response = await fetchWithPayment(url, { method: "GET" });
  const body = await response.json();
  console.log("Response body:", body);

  if (response.ok) {
    const paymentResponse = new x402HTTPClient(client).getPaymentSettleResponse(name =>
      response.headers.get(name),
    );
    console.log("\nPayment response:", paymentResponse);
  } else {
    console.log(`\nNo payment settled (response status: ${response.status})`);
  }
}

main().catch(error => {
  console.error(error?.response?.data?.error ?? error);
  process.exit(1);
});
