# @aeon-ai-pay/x402-axios Example Client

This is an example client that demonstrates how to use the `x402-axios` package to make HTTP requests to endpoints protected by the x402 payment protocol.

## Prerequisites
- Node.js v20+ (install via [nvm](https://github.com/nvm-sh/nvm))
- pnpm v10 (install via [pnpm.io/installation](https://pnpm.io/installation))

## Setup

1. Install and build all packages from the typescript examples root:
```bash
pnpm install
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
import { config } from "dotenv";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { withPaymentInterceptor } from "x402-clients";
import axios from "clients";
import { base } from "viem/chains";

config();

const { RESOURCE_SERVER_URL, PRIVATE_KEY, ENDPOINT_PATH } = process.env;

// Create wallet client
const account = privateKeyToAccount(PRIVATE_KEY as "0x${string}");
const client = createWalletClient({
  account,
  transport: http(),
  chain: base as Chain,
}).extend(publicActions);

// Create Axios instance with payment handling
const api = withPaymentInterceptor(
  axios.create({
    baseURL: RESOURCE_SERVER_URL,
  }),
  client
);

// Make request to paid endpoint
api
  .get(ENDPOINT_PATH)
  .then(response => {
    console.log(response.headers);
    console.log(response.data);
  })
  .catch(error => {
    console.error(error.response?.data?.error);
  });
```
