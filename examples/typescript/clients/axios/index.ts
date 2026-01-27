import { config } from "dotenv";
import { x402Client, wrapAxiosWithPayment, x402HTTPClient } from "@x402/axios";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, publicActions } from "viem";
import {bsc, xLayer} from "viem/chains";
import { kite } from "@x402/evm/custom-chains";
import axios from "axios";

config();

const evmPrivateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
const baseURL = process.env.RESOURCE_SERVER_URL || "http://localhost:4021";
const endpointPath = process.env.ENDPOINT_PATH || "/weather";
const url = `${baseURL}${endpointPath}`;

/**
 * Example demonstrating how to use @x402/axios to make requests to x402-protected endpoints.
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
  const walletClient = createWalletClient({
    account: evmAccount,
    chain: kite,
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
  // registerExactSvmScheme(client, { signer: svmSigner });

  const api = wrapAxiosWithPayment(axios.create(), client);

  console.log(`Making request to: ${url}\n`);
  const response = await api.get(url);
  const body = response.data;
  console.log("Response body:", body);

  if (response.status < 400) {
    const paymentResponse = new x402HTTPClient(client).getPaymentSettleResponse(
      name => response.headers[name.toLowerCase()],
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
