# x402 Protocol API Documentation
## BNB Chain AEON Facilitator Implementation

Version: 1.0
Last Updated: October 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Authentication & Payment Flow](#authentication--payment-flow)
4. [Server API Reference](#server-api-reference)
5. [Client SDK Reference](#client-sdk-reference)
6. [Payment Requirements](#payment-requirements)
7. [HTTP Headers](#http-headers)
8. [Error Handling](#error-handling)
9. [Supported Networks](#supported-networks)
10. [Code Examples](#code-examples)

---

## Overview

The BNB x402 protocol enables HTTP-native blockchain payments for API access. This implementation uses the AEON facilitator to provide seamless payment processing on BNB Chain.

### Key Features

- **HTTP 402 Payment Required**: Standard-based payment protocol
- **Automatic Payment Handling**: Client SDK handles payment flow automatically
- **Flexible Payment Options**: Supports EIP3009 tokens and ERC-20 tokens (e.g., USDT)
- **Time-Bound Signatures**: Secure, replay-resistant payment authorizations

### Architecture

![x402 Protocol Flow](./static/x402-protocol-flow.png)

**Flow Description:**
1. **[1]** Client Application makes GET request to /api
2. **[2]** Server responds with 402 Payment Required and returns payment requirements
3. **[3]** The Client SDK uses the wallet to sign payments, and this process includes both pre-authorization and signature.
4. **[4]** Client retries request with X-PAYMENT header
5. **[5-6]** Server sends payment to Facilitator for verification
6. **[7-11]** Server processes request and settles payment
7. **[12]** Server returns 200 OK with content to Client Application

   
---

## Getting Started

### Prerequisites

- Node.js v20.18+ or compatible runtime
- EVM wallet with private key
- Supported token balance (e.g., USDT on BNB Chain)

### Installation

```bash
pnpm install 
pnpm build  
```

#### Server Side

```bash
cd servers/
pnpm dev
cd ..  
```

#### Client Side

```bash
cd clients/
pnpm  dev
```

### Quick Start - Server

```typescript
import {serve} from "@hono/node-server";
import {Hono} from "hono";
import {paymentMiddleware} from "@aeon-ai-pay/x402-hono";
import {createRouteConfigFromPrice} from "@aeon-ai-pay/x402/shared";

const app = new Hono();
const facilitatorUrl = "https://facilitator.aeon.xyz";
const network = "bsc";
const evmAddress = "0xYourAddress";

// Configure payment requirements
const routeConfig = {
  "/weather": createRouteConfigFromPrice("$0.001", network, evmAddress),
  "/premium/*": {
    paymentRequirements: [{
      scheme: "exact",
      namespace: "evm",
      tokenAddress: "0x6e3BCf81d331fa7Bd79Ac2642486c70BEAE2600E",
      amountRequired: 0.01,
      amountRequiredFormat: "humanReadable",
      networkId: "56",
      payToAddress: evmAddress,
      description: "Premium content access with TESTU",
      tokenDecimals: 18,
      tokenSymbol: "TESTU",
    },]
  }
};

// Apply payment middleware
app.use("*", paymentMiddleware(routeConfig, {url: facilitatorUrl}));

// Protected endpoints
app.get("/weather", (c) => {
  return c.json({report: {weather: "sunny", temperature: 70}});
});

app.get("/premium/content", (c) => {
  return c.json({content: "Premium content"});
});

serve({fetch: app.fetch, port: 4021});
```

### Quick Start - Client

```typescript
import axios from "axios";
import { withPaymentInterceptor } from "@aeon-ai-pay/x402-axios";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";

// Create wallet client
const account = privateKeyToAccount("0xYourPrivateKey");
const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http()
});

// Create HTTP client with payment interceptor
const client = withPaymentInterceptor(axios.create(), walletClient);

// Make requests - payment handled automatically
const response = await client.get("http://localhost:4021/weather");
console.log(response.data);
```

---

## Authentication & Payment Flow

### Step-by-Step Flow



### Payment Types

The x402 protocol supports two payment types:

#### 1.EIP3009 Authorization 

EIP3009 Pre-authorized payment signature that the facilitator can execute.

During pre-authorization, users only need to sign the EIP-3009 authorization once in their wallet. Afterwards, the merchant can directly deduct the payment for gas within the validity period, Users do not need to pay gas, without requiring the user to confirm again


```typescript
{
  type: "authorizationEip3009",
  signature: "0x...",
  nonce: "0x...",
  version: 1,
  validAfter: 1234567890,
  validBefore: 1234567999,
  from: "0xClientAddress",
  to: "0xServerAddress",
  value: "10000000000000000" // Wei
}
```
#### Payment process
1. **Initial Request**: Client makes standard HTTP request
2. **Payment Required**: Server responds with `402 Payment Required` and payment requirements
3. **Payment Selection**: Client SDK selects appropriate payment method
4. **Signature creation and create payload**: The step of pre-authorization involves directly invoking the contract to sign using the payload information.
5. **Retry with Payment**: Client retries request with `X-PAYMENT` header
6. **Verification**: Server sends payment to facilitator for verification
7. **Content Delivery**: Server processes request and returns content
8. **Settlement**: Server settles payment on-chain via facilitator
9. **Response**: Client receives `200 OK` with `X-PAYMENT-RESPONSE` header
  

#### 2.ERC-20 Authorization 
Pre-authorized payment signature that the facilitator can execute.

```typescript
{
  type: "authorization",
  signature: "0x...",
  nonce: "0x...",
  version: 1,
  validAfter: 1234567890,
  validBefore: 1234567999,
  from: "0xClientAddress",
  to: "0xServerAddress",
  value: "10000000000000000" // Wei
}
```
#### Payment process
1. **Initial Request**: Client makes standard HTTP request
2. **Payment Required**: Server responds with `402 Payment Required` and payment requirements
3. **Payment Selection**: Client SDK selects appropriate payment method
4. **Signature creation and create payload**: This pre-authorization process consists of two steps
     1. Pre-authorized credit limit and payment amount;
     2. Utilize payload information and employ a contract to generate a signature.
5. **Retry with Payment**: Client retries request with `X-PAYMENT` header
6. **Verification**: Server sends payment to facilitator for verification
7. **Content Delivery**: Server processes request and returns content
8. **Settlement**: Server settles payment on-chain via facilitator
9. **Response**: Client receives `200 OK` with `X-PAYMENT-RESPONSE` header


> Submit the payment payload and paymentRequirements object, and let the facilitator complete the verification and settlement. The verification by the facilitator is all done by the contract. Please refer to the address:[aeon-facilitator-contract](https://github.com/AEON-Project/aeon-facilitator-contract/tree/main).


---

## Server API Reference

### Middleware Configuration

#### `paymentMiddleware(routeConfig, facilitatorConfig)`

Hono middleware that protects routes with payment requirements.

**Parameters:**

- `routeConfig`: `RoutesConfig` - Map of routes to payment requirements
- `facilitatorConfig`: `FacilitatorConfig` - Facilitator service configuration

**Returns:** Hono middleware function

**Example:**

```typescript
import { paymentMiddleware } from "@aeon-ai-pay/x402-hono";

const routeConfig = {
  "/api/data": {
    paymentRequirements: [/* ... */]
  }
};

app.use("*", paymentMiddleware(routeConfig, {
  url: "https://facilitator.aeon.xyz"
}));
```

### Route Configuration

#### `createRouteConfigFromPrice(price, network, payToAddress)`

Helper to create route config from a price string.

**Parameters:**

- `price`: `string` - Price in format `"$0.001"`
- `network`: `string` - Network identifier (e.g., `"bsc"`, `"polygon"`)
- `payToAddress`: `string` - EVM address to receive payment

**Returns:** `RouteConfig`

**Example:**

```typescript
import { createRouteConfigFromPrice } from "@aeon-ai-pay/x402/shared";

const config = createRouteConfigFromPrice("$0.001", "bsc", "0xYourAddress");
```

### Types

#### `RoutesConfig`

```typescript
type RoutesConfig = {
  [route: string]: RouteConfig;
};
```

#### `RouteConfig`

```typescript
interface RouteConfig {
  paymentRequirements: PaymentRequirement[];
}
```

#### `PaymentRequirement`

```typescript
interface PaymentRequirement {
  scheme: "exact";
  namespace: "evm";
  tokenAddress: string;
  amountRequired: number | bigint;
  amountRequiredFormat: "humanReadable" | "smallestUnit";
  payToAddress: string;
  networkId: string;
  tokenDecimals?: number;
  tokenSymbol?: string;
  description?: string;
  resource?: string;
  mimeType?: string;
  estimatedProcessingTime?: number;
  maxAmountRequired?: number | bigint;
  requiredDeadlineSeconds?: number;
}
```

---

## Client SDK Reference

### Axios Interceptor

#### `withPaymentInterceptor(axiosInstance, walletClient, options?)`

Adds x402 payment handling to an Axios instance.

**Parameters:**

- `axiosInstance`: `AxiosInstance` - Axios HTTP client
- `walletClient`: `WalletClient` - Viem wallet client for signing
- `options?`: `InterceptorOptions` - Optional configuration

**Returns:** `AxiosInstance` with payment interceptor

**Example:**

```typescript
import axios from "axios";
import { withPaymentInterceptor } from "@aeon-ai-pay/x402-axios";

const client = withPaymentInterceptor(
  axios.create({ baseURL: "https://api.example.com" }),
  walletClient
);
```

### Signing Functions
#### `signAuthorizationEip3009(client, authParams, paymentRequirements)`

Signs a payment authorization (EIP-3009 style, this process includes both pre-authorization and signature.).

**Parameters:**

- `client`: `WalletClient` - Viem wallet client
- `authParams`: `AuthorizationParams` - Authorization parameters
- `paymentRequirements`: `PaymentRequirement` - Payment requirements

**Returns:** `Promise<EvmPaymentPayload>`

**Example:**

```typescript
import { signAuthorizationEip3009 } from "@aeon-ai-pay/x402/schemes/exact/evm";

const payload = await signAuthorizationEip3009(
  walletClient,
  {
    from: "0xClientAddress",
    to: "0xServerAddress",
    value: BigInt("10000000000000000"),
    validAfter: Math.floor(Date.now() / 1000),
    validBefore: Math.floor(Date.now() / 1000) + 300
  },
  paymentRequirement
);
```



#### `signAuthorization(client, authParams, paymentRequirements)`

Signs a payment authorization (Pre-authorized style).

**Parameters:**

- `client`: `WalletClient` - Viem wallet client
- `authParams`: `AuthorizationParams` - Authorization parameters
- `paymentRequirements`: `PaymentRequirement` - Payment requirements

**Returns:** `Promise<EvmPaymentPayload>`

**Example:**

```typescript
import { signAuthorization } from "@aeon-ai-pay/x402/schemes/exact/evm";

const payload = await signAuthorization(
  walletClient,
  {
    from: "0xClientAddress",
    to: "0xServerAddress",
    value: BigInt("10000000000000000"),
    validAfter: Math.floor(Date.now() / 1000),
    validBefore: Math.floor(Date.now() / 1000) + 300
  },
  paymentRequirement
);
```



---

## Payment Requirements

### EVM Networks

For EVM-compatible networks, payment requirements specify:

```typescript
{
  scheme: "exact",
  namespace: "evm",
  tokenAddress: "0x55d398326f99059ff775485246999027b3197955", // USDT
  amountRequired: 0.01,
  amountRequiredFormat: "humanReadable",
  payToAddress: "0xRecipientAddress",
  networkId: "56", // BNB Chain
  tokenDecimals: 18,
  tokenSymbol: "USDT",
  description: "Access to premium content"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scheme` | `"exact"` | Yes | Payment scheme (only "exact" supported) |
| `namespace` | `"evm"` | Yes | Blockchain namespace |
| `tokenAddress` | `string` | Yes | Token contract address (use zero address for native) |
| `amountRequired` | `number` \| `bigint` | Yes | Payment amount |
| `amountRequiredFormat` | `"humanReadable"` \| `"smallestUnit"` | Yes | Amount format specification |
| `payToAddress` | `string` | Yes | Recipient address |
| `networkId` | `string` | Yes | Chain ID (e.g., "56" for BSC) |
| `tokenDecimals` | `number` | No | Token decimals (usually 18) |
| `tokenSymbol` | `string` | No | Token symbol (e.g., "USDT") |
| `description` | `string` | No | Human-readable description |
| `resource` | `string` | No | Resource identifier |
| `estimatedProcessingTime` | `number` | No | Expected processing time (seconds) |
| `requiredDeadlineSeconds` | `number` | No | Payment deadline |

---

## HTTP Headers

### Request Headers

#### `X-PAYMENT`

Contains base64-encoded payment payload.

**Format:**
```
X-PAYMENT: base64(JSON.stringify(EvmPaymentPayload))
```

**Example:**
```
X-PAYMENT: eyJ0eXBlIjoiYXV0aG9yaXphdGlvbiIsInNpZ25hdHVyZSI6IjB4Li4uIn0=
```

### Response Headers

#### `X-PAYMENT-RESPONSE`

Contains base64-encoded settlement response on successful payment.

**Format:**
```
X-PAYMENT-RESPONSE: base64(JSON.stringify(SettleResponse))
```

**Decoded Structure:**
```typescript
{
  success: true,
  transaction: "0x123...", // Transaction hash
  namespace: "evm",
  payer: "0xClientAddress"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request successful, payment processed |
| `402` | Payment Required | Payment needed to access resource |
| `400` | Bad Request | Invalid payment payload |
| `403` | Forbidden | Payment verification failed |
| `500` | Server Error | Internal error processing payment |

### Error Reasons

When payment verification fails, the response includes an `invalidReason`:

| Reason | Description |
|--------|-------------|
| `insufficient_funds` | Payer has insufficient balance |
| `invalid_exact_evm_payload_authorization_valid_after` | Authorization not yet valid |
| `invalid_exact_evm_payload_authorization_valid_before` | Authorization expired |
| `invalid_exact_evm_payload_authorization_value` | Incorrect payment amount |
| `invalid_exact_evm_payload_signature` | Invalid signature |
| `invalid_exact_evm_payload_recipient_mismatch` | Wrong recipient address |
| `invalid_network` | Unsupported or wrong network |
| `invalid_payload` | Malformed payment payload |
| `invalid_scheme` | Unsupported payment scheme |
| `invalid_x402_version` | Incompatible protocol version |

### Error Response Example

```json
{
  "error": "Payment verification failed",
  "isValid": false,
  "invalidReason": "insufficient_funds",
  "errorMessage": "Payer has insufficient USDT balance"
}
```

---

## Supported Networks

### EVM Networks

| Network | Chain ID | Native Token | Example Token Address |
|---------|----------|--------------|----------------------|
| BNB Chain (BSC) | 56 | BNB | USDT: `0x55d398326f99059ff775485246999027b3197955` |
| BNB Chain (BSC) | 56 | BNB | TESTU: `0x6e3BCf81d331fa7Bd79Ac2642486c70BEAE2600E` |


### Token Addresses

For ERC-20 tokens, use the token contract address.

---

## Code Examples

### Example 1: Simple Protected Endpoint

**Server:**
```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { paymentMiddleware } from "@aeon-ai-pay/x402-hono";
import { createRouteConfigFromPrice } from "@aeon-ai-pay/x402/shared";

const app = new Hono();

const routeConfig = {
  "/data": createRouteConfigFromPrice("$0.001", "bsc", "0xYourAddress")
};

app.use("*", paymentMiddleware(routeConfig, {
  url: "https://facilitator.aeon.xyz"
}));

app.get("/data", (c) => c.json({ data: "Protected data" }));

serve({ fetch: app.fetch, port: 4021 });
```

**Client:**
```typescript
import axios from "axios";
import { withPaymentInterceptor } from "@aeon-ai-pay/x402-axios";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http()
});

const client = withPaymentInterceptor(axios.create(), walletClient);

async function fetchData() {
  try {
    const response = await client.get("http://localhost:4021/data");
    console.log("Data:", response.data);

    // Check payment response
    const paymentResponse = response.headers["x-payment-response"];
    if (paymentResponse) {
      const decoded = JSON.parse(
        Buffer.from(paymentResponse, "base64").toString()
      );
      console.log("Payment TX:", decoded.transaction);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

fetchData();
```

### Example 2: Multiple Payment Options

**Server:**
```typescript
const routeConfig = {
  "/premium/content": {
    paymentRequirements: [
      // Option 1: USDT on BSC
      {
        scheme: "exact",
        namespace: "evm",
        tokenAddress: "0x55d398326f99059ff775485246999027b3197955",
        amountRequired: 0.01,
        amountRequiredFormat: "humanReadable",
        networkId: "56",
        payToAddress: evmAddress,
        tokenDecimals: 18,
        tokenSymbol: "USDT",
        description: "Pay with USDT on BNB Chain"
      },
      // Option 2: Native BNB
      {
        scheme: "exact",
        namespace: "evm",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        amountRequired: 0.001,
        amountRequiredFormat: "humanReadable",
        networkId: "56",
        payToAddress: evmAddress,
        tokenDecimals: 18,
        tokenSymbol: "BNB",
        description: "Pay with BNB"
      }
    ]
  }
};
```

### Example 3: Custom Payment Selection

```typescript
import axios from "axios";
import { signAuthorization } from "@aeon-ai-pay/x402/schemes/exact/evm";

// Make initial request to get payment requirements
const initialResponse = await axios.get("http://localhost:4021/api", {
  validateStatus: (status) => status === 402 || status === 200
});

if (initialResponse.status === 402) {
  const paymentRequirements = initialResponse.data.paymentRequirements;

  // Select preferred payment method
  const selectedPayment = paymentRequirements.find(
    req => req.tokenSymbol === "USDT"
  );

  // Create payment payload
  const payload = await signAuthorization(
    walletClient,
    {
      from: walletClient.account.address,
      to: selectedPayment.payToAddress,
      value: BigInt(selectedPayment.amountRequired * 10**18),
      validAfter: Math.floor(Date.now() / 1000),
      validBefore: Math.floor(Date.now() / 1000) + 300
    },
    selectedPayment
  );

  // Retry with payment
  const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");
  const response = await axios.get("http://localhost:4021/api", {
    headers: {
      "X-PAYMENT": paymentHeader
    }
  });

  console.log("Success:", response.data);
}
```

### Example 4: Environment Configuration

**Server `.env`:**
```bash
FACILITATOR_URL=https://facilitator.aeon.xyz
NETWORK=bsc
EVM_ADDRESS=0xPayToAddress
PORT=4021
```

**Client `.env`:**
```bash
RESOURCE_SERVER_URL=http://localhost:4021
EVM_PRIVATE_KEY=0xYourPrivateKeyHere
```

**Loading configuration:**
```typescript
import dotenv from "dotenv";
dotenv.config();

const config = {
  facilitatorUrl: process.env.FACILITATOR_URL,
  network: process.env.NETWORK,
  evmAddress: process.env.EVM_ADDRESS,
  port: parseInt(process.env.PORT || "4021")
};
```

---

## Best Practices

### Security

1. **Never commit private keys**: Use environment variables
2. **Validate payment amounts**: Always verify amounts match requirements
3. **Set reasonable timeouts**: Use `validBefore` to expire authorizations
4. **Use HTTPS in production**: Protect payment data in transit
5. **Implement rate limiting**: Prevent abuse of payment endpoints

### Performance

1. **Cache payment requirements**: Reduce 402 responses
2. **Use authorization type**: Faster than full transactions
3. **Set appropriate timeouts**: Balance security and UX
4. **Monitor facilitator status**: Implement health checks

### User Experience

1. **Show clear pricing**: Display costs before requests
2. **Handle errors gracefully**: Provide helpful error messages
3. **Support multiple payment options**: Increase conversion
4. **Provide payment receipts**: Return transaction hashes

---

## Troubleshooting

### Common Issues

#### "Invalid signature" error

**Cause:** Signature doesn't match payment requirements

**Solution:**
- Verify wallet client chain matches `networkId`
- Check `validAfter` and `validBefore` timestamps
- Ensure `from`, `to`, and `value` match requirements

#### "Insufficient funds" error

**Cause:** Wallet lacks required token balance

**Solution:**
- Check token balance: `await client.getBalance({ address, token })`
- Ensure correct token address
- Account for gas fees (for native token payments)

#### Payment not settling

**Cause:** Facilitator unable to process payment

**Solution:**
- Verify facilitator URL is correct
- Check network connectivity
- Review facilitator logs for errors
- Ensure wallet has approved token spending (for ERC-20)

#### 402 response but no payment requirements

**Cause:** Misconfigured route or middleware

**Solution:**
- Verify route pattern matches request path
- Check `routeConfig` includes the route
- Ensure middleware is applied before route handlers

---

## API Reference Summary

### Server Functions

| Function | Purpose |
|----------|---------|
| `paymentMiddleware(config, facilitator)` | Protect routes with payments |
| `createRouteConfigFromPrice(price, network, address)` | Create route config from price |

### Client Functions

| Function | Purpose                       |
|----------|-------------------------------|
| `withPaymentInterceptor(axios, wallet, options?)` | Add payment handling to Axios |
| `signAuthorization(client, params, requirements)` | Sign payment authorization    |
| `signAuthorizationEip3009(client, params, requirements)` | Sign payment authorization, this process includes both pre-authorization and signature.  |

### Core Types

| Type | Purpose |
|------|---------|
| `PaymentRequirement` | Defines payment requirements |
| `EvmPaymentPayload` | Payment payload structure |
| `SettleResponse` | Payment settlement result |
| `VerifyResponse` | Payment verification result |

---

## Support & Resources

- **Documentation**: [https://docs.aeon.xyz](https://docs.aeon.xyz)
- **NPM Packages**:
  - `@aeon-ai-pay/x402` - Core library
  - `@aeon-ai-pay/x402-hono` - Hono middleware
  - `@aeon-ai-pay/x402-axios` - Axios interceptor
- **Facilitator**: [https://facilitator.aeon.xyz](https://facilitator.aeon.xyz)
- **Demo**: [https://x402-demo.aeon.xyz/weather](https://x402-demo.aeon.xyz/weather)

---

## License

This implementation follows the x402 protocol specification. See individual package licenses for details.

---

**Last Updated:** October 2025
**Protocol Version:** x402 V0.0.1
**Implementation Version:** 0.0.22
