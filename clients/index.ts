import axios from "axios";
import { config } from "dotenv";
import { Chain, createWalletClient, http, publicActions, type Hex } from "viem";
import { withPaymentInterceptor, decodeXPaymentResponse } from "@aeon-ai-pay/x402-axios";
import { evm } from "@aeon-ai-pay/x402/types";

config();

const evmPrivateKey = process.env.EVM_PRIVATE_KEY as Hex;
const baseURL = process.env.RESOURCE_SERVER_URL as string; // e.g. http://localhost:3000
const endpointPath = process.env.ENDPOINT_PATH as string; // e.g. /image

if (!baseURL || !evmPrivateKey || !endpointPath) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// EVM client
const evmClient = evm.createSignerBase(evmPrivateKey);
/*const evmClient = evm.createSignerBsc(evmPrivateKey);
const evmClient = evm.createSignerXLayer(evmPrivateKey);*/


// Create the API client with payment interceptor
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
    console.error("example axios error", error);
  });
