import axios from "axios";
import { config } from "dotenv";
import { Chain, createWalletClient, http, publicActions, type Hex } from "viem";
import { withPaymentInterceptor, decodeXPaymentResponse } from "@aeon-ai-pay/x402-axios";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";

config();

const evmPrivateKey = process.env.EVM_PRIVATE_KEY as Hex;
const baseURL = process.env.RESOURCE_SERVER_URL as string; // e.g. http://localhost:3000
const endpointPath = process.env.ENDPOINT_PATH as string; // e.g. /image

if (!baseURL || !evmPrivateKey || !endpointPath) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// EVM client
const evmAccount = privateKeyToAccount(evmPrivateKey);
const evmClient = createWalletClient({
  account: evmAccount,
  transport: http(),
  chain: bsc as Chain,
}).extend(publicActions);

// Create the API client with payment interceptor
// If multiple clients are provided, the payment interceptor will use the first one that is available according to payment requirements
// You can comment out the evmClient to test the solana client
const api = withPaymentInterceptor(
  axios.create({
    baseURL,
  }),
  {
    evmClient,
  },
);

api
  .get(endpointPath)
  .then(response => {
    console.log(response.data);

    const paymentResponse = decodeXPaymentResponse(response.headers["x-payment-response"]);
    console.log(paymentResponse);
  })
  .catch(error => {
    console.error("example clients error", error);
  });
