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
cd ../
pnpm install
pnpm build
cd servers
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
            amountRequired: 0.001,
            amountRequiredFormat: "humanReadable",
            networkId: "56",
            payToAddress: evmAddress,
            description: "Weather data access with USDT",
            tokenDecimals: 18,
            tokenSymbol: "USDT",
          },
          {
            scheme: "exact",
            namespace: "evm",
            tokenAddress: "0x6e3BCf81d331fa7Bd79Ac2642486c70BEAE2600E", // TESTU on BSC
            amountRequired: 0.01,
            amountRequiredFormat: "humanReadable",
            networkId: "56",
            payToAddress: evmAddress,
            description: "Weather data access with TESTU",
            tokenDecimals: 18,
            tokenSymbol: "TESTU",
          },
          {
            scheme: "exact",
            namespace: "evm",
            tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC on Base
            amountRequired: 0.001,
            amountRequiredFormat: "humanReadable",
            networkId: "8453",
            payToAddress: evmAddress,
            description: "Weather data access with USDC on Base",
            tokenDecimals: 6,
            tokenSymbol: "USDC",
          },
          {
            scheme: "exact",
            namespace: "evm",
            tokenAddress: "0x779ded0c9e1022225f8e0630b35a9b54be713736", // USDT on Laye
            amountRequired: 0.01,
            amountRequiredFormat: "humanReadable",
            networkId: "196",
            payToAddress: evmAddress,
            description: "Premium content access with USDT on X Laye",
            tokenDecimals: 6,
            tokenSymbol: "USDT",
          },
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


## Architecture Benefits

- **Better UX**: Users can choose their preferred payment method
- **Cross-Chain**: Support multiple blockchain ecosystems
- **Extensible**: Easy to add new networks and tokens
