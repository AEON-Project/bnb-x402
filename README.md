# @aeon-ai-pay/x402-axios Example Client

This is an example client that demonstrates how to use the `@aeon-ai-pay/x402-axios` package to make HTTP requests to endpoints protected by the x402 payment protocol.

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

# @aeon-ai-pay/x402-hono Example Server

This is an example Hono server that demonstrates how to use the `@aeon-ai-pay/x402-hono` middleware to implement paywall functionality in your API endpoints.

## Prerequisites

- Node.js v20+ (install via [nvm](https://github.com/nvm-sh/nvm))
- pnpm v10 (install via [pnpm.io/installation](https://pnpm.io/installation))
- A valid Ethereum address for receiving payments

## Setup

1. Copy `.env-local` to `.env` and add your Ethereum address to receive payments:

```bash
cp .env-local .env
```

2. Install and build all packages from the typescript examples root:

```bash
pnpm install
```

3. Run the server

```bash
pnpm dev
```

## API Endpoints

### `/weather` - Simple Payment Configuration
- **Payment**: $0.001 (configured via `createRouteConfigFromPrice`)
- **Network**: Based on NETWORK environment variable
- **Response**: Weather data

### `/premium/content` - Multiple Payment Options
- **Payment Options**:
  - USDT on BSC (Binance Smart Chain) - $0.01
- **User Choice**: Users can pay with either option
- **Response**: Premium content with payment method information

## Configuration Examples

### Simple Configuration
```typescript
app.use(
  paymentMiddleware(
    {
      "/weather": createRouteConfigFromPrice("$0.001", network, evmAddress),
    },
    {
      url: facilitatorUrl,
    },
  ),
);
```

### Advanced Multi-Chain Configuration
```typescript
app.use(
  paymentMiddleware(
    {
      "/premium/*": {
        paymentRequirements: [
          {
            scheme: "exact",
            namespace: "evm",
            tokenAddress: "0x55d398326f99059ff775485246999027b3197955", // USDT on BSC
            amountRequired: 0.01,
            amountRequiredFormat: "humanReadable",
            networkId: "56",
            payToAddress: evmAddress, // Example Evm address
            description: "Premium content access with USDT on BSC",
            tokenDecimals: 18,
            tokenSymbol: "USDT",
          }
        ],
      },
    },
    {
      url: facilitatorUrl,
    },
  ),
);
```

## Testing the Server

You can test the server using one of the example clients:

### Using the Axios Client
```bash
cd ../clients
# Ensure .env is setup
pnpm install
pnpm dev
```

## Payment Flow

1. **Request**: Client makes a request to a protected endpoint
2. **Payment Required**: Server responds with 402 status and available payment options
3. **Payment Choice**: Client chooses preferred payment method (EVM)
4. **Payment**: Client creates and signs payment transaction
5. **Verification**: Server verifies the payment via facilitator
6. **Access**: Server provides access to protected content
7. **Settlement**: Payment is settled on-chain

## Environment Variables

- `FACILITATOR_URL`: URL of the payment facilitator service
- `NETWORK`: Network to use for simple price configurations ("bsc")
- `EVM_ADDRESS`: Your Ethereum address for receiving EVM payments

## Supported Networks & Tokens

### EVM Chains
- **BSC (Binance Smart Chain)**: USDT (0x55d398326f99059ff775485246999027b3197955)