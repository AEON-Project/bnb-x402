# @aeon-ai-pay/x402-axios Example Client

This is an example client that demonstrates how to use the `@aeon-ai-pay/x402-axios` package to make HTTP requests to endpoints protected by the x402 payment protocol.

## Prerequisites
- Node.js v20+ (install via [nvm](https://github.com/nvm-sh/nvm))
- pnpm v10 (install via [pnpm.io/installation](https://pnpm.io/installation))

## Setup

1. Install and build all packages from the typescript examples root:
```bash
cd ../
pnpm install
pnpm build
cd clients
```

2. Copy `.env-example` to `.env` :
```bash
cp .env-example .env
```

3. Start the example client (remember you need to be running a server locally or point at an endpoint):
```bash
pnpm dev
```

## How It Works

The example demonstrates how to:
1. Create a wallet client using viem
2. Create an Axios instance with x402 payment handling
3. Make a request to a paid endpoint
4. Handle the response or any errors

## Example Code

```typescript
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

```
