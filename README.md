# x402 Protocol API Documentation
## BNB Chain AEON Facilitator Implementation

Version: 2.0
Last Updated: December 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Server API Reference](#server-api-reference)
4. [Payment Requirements](#payment-requirements)
5. [HTTP Headers](#http-headers)
6. [Error Handling](#error-handling)
7. [Supported Networks](#supported-networks)

---

## Overview

The BNB x402 protocol enables HTTP-native blockchain payments for API access. This implementation uses the AEON facilitator to provide seamless payment processing on BNB Chain.

### Key Features

- **HTTP 402 Payment Required**: Standard-based payment protocol
- **Automatic Payment Handling**: Client SDK handles payment flow automatically
- **Flexible Payment Options**: Supports EIP3009 tokens and ERC-20 tokens (e.g., USDT)
- **Time-Bound Signatures**: Secure, replay-resistant payment authorizations

### Architecture

![x402 Protocol Flow](./static/flow.png)

**Flow Description:**
1. **Initial Request**: Client makes standard HTTP request
2. **Payment Required**: Server responds with `402 Payment Required` and payment requirements
3. **Payment Selection**: Client SDK selects appropriate payment method,like bsc chain.
4. **Signature creation and create payload**: 
     1. Pre-authorized credit limit and payment amount.
     2. Utilize payload information and employ a contract to generate a signature.
5. **Verification**: The server uses the 'PAYMENT-SIGNATURE' and 'PAYMENT-REQUIRED' interfaces to communicate with the facilitator `/verify` interface.
6. **Get/verify result**: Get the facilitator `/verify` interface response
7. **Settlement**: If verify is OK, Client send request  with `PAYMENT-SIGNATURE` & `PAYMENT-REQUIRED` to facilitator for `settle`.
8. **Submit tx**: If settle is complete,Submit transaction hash.
9. **Tx confirmed**: Return the confirmed result of tx.
10. **Facilitator Response**: The server received a "200 OK" message with transaction details and response body containing tx_hash.
11. **Server Response**: If facilitator reponse status is settled,Client receives `200 OK` and the detailed information of the transaction results.


> Submit the payment paymentPayload and paymentRequirements object, and let the facilitator complete the verification and settlement.

   
---

## Getting Started

### Prerequisites

- Node.js v20.18+ or compatible runtime
- EVM wallet with private key
- Supported token balance (e.g., USDT on BNB Chain)

### Installation

```bash
cd typescript
pnpm install 
pnpm build  
```

#### Server Side

```bash
cd examples/typescript/servers/
pnpm dev
cd ..  
```

#### Client Side

```bash
cd examples/typescript/clients/
pnpm  dev
```

### Quick Start - Server

```typescript
import { config } from "dotenv";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
config();

const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;
const svmAddress = process.env.SVM_ADDRESS;
const apiKey = process.env.API_KEY as string;
if (!evmAddress || !svmAddress) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const facilitatorUrl = process.env.FACILITATOR_URL;
if (!facilitatorUrl) {
  console.error("❌ FACILITATOR_URL environment variable is required");
  process.exit(1);
}

//Create a facilitator client, and if an API Key is provided, configure the authentication header
const facilitatorClient = new HTTPFacilitatorClient({
  url: facilitatorUrl,
  createAuthHeaders: apiKey
    ? async () => {
        return {
          verify: {
            Authorization: `Bearer ${apiKey}`,
          },
          settle: {
            Authorization: `Bearer ${apiKey}`,
          },
          supported: {
            Authorization: `Bearer ${apiKey}`,
          },
        };
      }
    : undefined,
});

const app = new Hono();

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:196",
            payTo: evmAddress,
          },
          // {
          //   scheme: "exact",
          //   price: "$0.001",
          //   network: "eip155:56",
          //   payTo: evmAddress,
          // },
          // {
          //   scheme: "exact",
          //   price: "$0.001",
          //   network: "eip155:8453",
          //   payTo: evmAddress,
          // }
        ],
        description: "Weather data",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(facilitatorClient)
      .register("eip155:196", new ExactEvmScheme())
        .register("eip155:56", new ExactEvmScheme())
        .register("eip155:8453", new ExactEvmScheme())
  ),
);

app.get("/weather", c => {
  return c.json({
    report: {
      weather: "sunny",
      temperature: 70,
    },
  });
});

serve({
  fetch: app.fetch,
  port: 4021,
});

console.log(`Server listening at http://localhost:4021`);
```


### Quick Start - Client

```typescript
import { config } from "dotenv";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http, publicActions } from "viem";
import { bsc, xLayer, base } from "viem/chains";

config();

const evmPrivateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
const baseURL = process.env.RESOURCE_SERVER_URL || "http://localhost:4021";
const endpointPath = process.env.ENDPOINT_PATH || "/weather";
const url = `${baseURL}${endpointPath}`;

/**
 * Example demonstrating how to use @x402/fetch to make requests to x402-protected endpoints.
 *
 * This uses the helper registration functions from @x402/evm and @x402/svm to register
 * all supported networks for both v1 and v2 protocols.
 *
 * Required environment variables:
 * - EVM_PRIVATE_KEY: The private key of the EVM signer
 */
async function main(): Promise<void> {
  const evmAccount = privateKeyToAccount(evmPrivateKey);

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

```


###  Environment Configuration

**Server `.env`:**
```bash
EVM_ADDRESS=0x2EC8A3D26b720c7a2B16f582d883F7980EEA3628
SVM_ADDRESS=53KCTzCNQYNyp84bQD84F2gac2ioPU7AGLm76JmoLpWE
FACILITATOR_URL=http://localhost:3001
API_KEY=4556
```

**Client `.env`:**
```bash
EVM_PRIVATE_KEY=0xYourPrivateKeyHere
SVM_PRIVATE_KEY=0xYourPrivateKeyHere
RESOURCE_SERVER_URL=http://localhost:4021
ENDPOINT_PATH=/weather
PRIVATE_KEY=0xYourPrivateKeyHere
```
### Use client request server
### First Request 
```json
curl --location 'http://localhost:4021/weather'
```
### First Response Header
```json
"payment-required":"
eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cDovL2xvY2FsaG9zdDo0MDIxL3dlYXRoZXIiLCJkZXNjcmlwdGlvbiI6IldlYXRoZXIgZGF0YSIsIm1pbWVUeXBlIjoiYXBwbGljYXRpb24vanNvbiJ9LCJhY2NlcHRzIjpbeyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJlaXAxNTU6MTk2IiwibmV0d29ya0lkIjoiMTk2IiwiYW1vdW50IjoiMTAwMDAiLCJhc3NldCI6IjB4NzRiN2YxNjMzN2I4OTcyMDI3ZjYxOTZhMTdhNjMxYWM2ZGUyNmQyMiIsInBheVRvIjoiMHgyRUM4QTNEMjZiNzIwYzdhMkIxNmY1ODJkODgzRjc5OGJFRUEzNjI4IiwibWF4VGltZW91dFNlY29uZHMiOjMwMCwiZXh0cmEiOnsibmFtZSI6IlVTREMiLCJ2ZXJzaW9uIjoiMiJ9fV19"
```
Base64 decoded data
```json
{
  "x402Version": 2,
  "error": "Parameter required",
  "resource": {
    "url": "http://localhost:4021/weather",
    "description": "Weather data",
    "mimeType": "application/json"
  },
  "accesses": [
    {
      "scheme": "exact",
      "network": "ip155:196",
      "amount": "10000",
      "asset": "0x74b7f16337b8972027f6196a17a631ac6de26d22",
      "payTo": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
      "maxTimeoutSeconds": 300,
      "extra": {
        "name": "USDC",
        "version": "2"
      }
    }
  ]
}
```

### First Response Body
First Response Body is Empty


### Second Request 
```json
curl --location 'http://localhost:4021/weather' \
--header 'payment-signature: eyJ4NDAyVmVyc2lvbiI6MiwicGF5bG9hZCI6eyJhdXRob3JpemF0aW9uIjp7ImZyb20iOiIweDM0QjdGRTEwNjg5MWEwNzUyOGI0RjJlNUUzMzlDMzJEQTEzY0Y1MTAiLCJ0byI6IjB4MkVDOEEzRDI2YjcyMGM3YTJCMTZmNTgyZDg4M0Y3OThiRUVBMzYyOCIsInZhbHVlIjoiMTAwMCIsInZhbGlkQWZ0ZXIiOiIxNzY2NDc5NDUxIiwidmFsaWRCZWZvcmUiOiIxNzY2NDgwMzUxIiwibm9uY2UiOiIweDk5Zjc4ZDRkZWMxMjk5MDljZmM2MGQ4ZGEyOWE0YTA4NDcyMGNmZmFkOGI1OWVlNjk4NDliMTU2MGIwOWZkN2MifSwic2lnbmF0dXJlIjoiMHgwOTUzMTg1YmIzYTNkMDllN2IzYzhjMDA1Y2M4NjU0ZDgzMDFkNTEwY2EwMDU3NTUwYzAzNzZhZGMyMDA3YzMwMDM3ZGI1YzUyNTI2YmM0NTBjNjI3ODY3N2UwZTk4M2E5NDk5MmZkZWUyZjhmZWQyOTYzMDg0NmUwZGRjOTJlNDFjIn0sInJlc291cmNlIjp7InVybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NDAyMS93ZWF0aGVyIiwiZGVzY3JpcHRpb24iOiJXZWF0aGVyIGRhdGEiLCJtaW1lVHlwZSI6ImFwcGxpY2F0aW9uL2pzb24ifSwiYWNjZXB0ZWQiOnsic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiZWlwMTU1Ojg0NTMiLCJuZXR3b3JrSWQiOiI4NDUzIiwiYW1vdW50IjoiMTAwMCIsImFzc2V0IjoiMHg4MzM1ODlmQ0Q2ZURiNkUwOGY0YzdDMzJENGY3MWI1NGJkQTAyOTEzIiwicGF5VG8iOiIweDJFQzhBM0QyNmI3MjBjN2EyQjE2ZjU4MmQ4ODNGNzk4YkVFQTM2MjgiLCJtYXhUaW1lb3V0U2Vjb25kcyI6MzAwLCJleHRyYSI6eyJuYW1lIjoiVVNEIENvaW4iLCJ2ZXJzaW9uIjoiMiJ9fX0='
```
Base64 decoded data
```json
 {
  "x402Version": 2,
  "payload": {
    "authorization": {
      "from": "0x34B7FE106891a07528b4F2e5E339C32DA13cF510",
      "to": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
      "value": "1000",
      "validAfter": "1766479451",
      "validBefore": "1766480351",
      "nonce": "0x99f78d4dec129909cfc60d8da29a4a084720cffad8b59ee69849b1560b09fd7c"
    },
    "signature": "0x0953185bb3a3d09e7b3c8c005cc8654d8301d510ca0057550c0376adc2007c30037db5c52526bc450c6278677e0e983a94992fdee2f8fed29630846e0ddc92e41c",
    "resource": {
      "url": "http://localhost:4021/weather",
      "description": "Weather data",
      "mimeType": "application/json"
    },
    "accepted": {
      "scheme": "exact",
      "network": "eip155:8453",
      "amount": "1000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
      "maxTimeoutSeconds": 300,
      "extra": {
        "name": "USD Coin",
        "version": "2"
      }
    }
  }
}
```
### Second Response  body
```json
{
  success: true,
  transaction: '0x685a5b37f8e9affae5787ee7dfeaab20e0b4e2a8c3197020299b1c0163ef0c74',
  network: 'eip155:8453',
  payer: '0x34B7FE106891a07528b4F2e5E339C32DA13cF510',
  requirements: {
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '1000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628',
    maxTimeoutSeconds: 300,
    extra: { name: 'USD Coin', version: '2' }
  }
}
```

---

---

## Payment Requirements

### EVM Networks

For EVM-compatible networks, payment requirements specify:

```typescript
{
    "scheme": "exact",
    "network": "eip155:56",
    "amount": "10000",
    "asset": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    "payTo": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
    "maxTimeoutSeconds": 300,
    "extra": {
        "name": "USDT",
        "version": "2"
    }
}
```

### Field Descriptions


| Second-level Field |Type|Required| Description                                                         | Example Value                              |
|--------------------|---|---|---------------------------------------------------------------------|--------------------------------------------|
| scheme             |string|Yes| Payment scheme type, fixed as `exact`                               | exact                                      |
| network            |string|Yes| Blockchain network (e.g., 56 corresponds to Binance Smart Chain)    | eip155:56                                  |
| amount             |string|Yes| Payment amount value                                                | 10000                                      |
| asset              |string|Yes| Token contract address                                              | 0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628 |
| payTo              |string|Yes| Payment target address           | 0x2EC8A3D26b720c7a2B16f582d883F722bEEA3628              |
| maxTimeoutSeconds  |number|Yes| Payment timeout period (unit: seconds)                              | 300                                        |
| extra              |object|Yes| Additional supplementary information related to payment             | {"name":"USDT","version":"2"}              |

---

## HTTP Headers

### Request Headers

#### `Authorization`

API key applied to AEON

**Example:**
```
Authorization: Bearer 123
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
| `401` | Error            | Missing or invalid Authorization header. Expected: Bearer <API_KEY> |
| `402` | Payment Required | Payment needed to access resource |
| `400` | Bad Request | Invalid payment payload |
| `403` | Forbidden | Payment verification failed |
| `500` | Server Error | Internal error processing payment |

### Error Reasons

When payment verification fails, the response includes an `invalidReason`:

| Reason                                                                                | Description |
|---------------------------------------------------------------------------------------|-------------|
| insufficient_funds                                                                    | The account does not have enough balance to complete the transaction |
| invalid_exact_evm_payload_authorization_valid_after                                   | The `valid_after` timestamp in the EVM payload authorization is invalid |
| invalid_exact_evm_payload_authorization_valid_before                                  | The `valid_before` timestamp in the EVM payload authorization is invalid |
| invalid_exact_evm_payload_authorization_value                                         | The value specified in the EVM payload authorization is invalid |
| invalid_exact_evm_payload_signature                                                   | The signature of the exact EVM payload is invalid or does not match |
| invalid_exact_evm_payload_undeployed_smart_wallet                                     | The smart wallet referenced in the EVM payload has not been deployed yet |
| invalid_exact_evm_payload_recipient_mismatch                                          | The recipient address in the EVM payload does not match the expected value |
| invalid_exact_svm_payload_transaction                                                 | The exact SVM payload transaction is malformed or invalid |
| invalid_exact_svm_payload_transaction_amount_mismatch                                 | The transaction amount in the SVM payload does not match the required amount |
| invalid_exact_svm_payload_transaction_create_ata_instruction                          | The Create Associated Token Account (ATA) instruction in the SVM payload is invalid |
| invalid_exact_svm_payload_transaction_create_ata_instruction_incorrect_payee          | The payee address in the Create ATA instruction of the SVM payload is incorrect |
| invalid_exact_svm_payload_transaction_create_ata_instruction_incorrect_asset          | The asset type in the Create ATA instruction of the SVM payload is incorrect |
| invalid_exact_svm_payload_transaction_instructions                                    | The instructions included in the SVM payload transaction are invalid |
| invalid_exact_svm_payload_transaction_instructions_length                             | The length of the instructions list in the SVM payload transaction is invalid |
| invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction          | The compute limit instruction in the SVM payload transaction is invalid |
| invalid_exact_svm_payload_transaction_instructions_compute_price_instruction          | The compute price instruction in the SVM payload transaction is invalid |
| invalid_exact_svm_payload_transaction_instructions_compute_price_instruction_too_high | The compute price specified in the SVM payload transaction instruction is too high |
| invalid_exact_svm_payload_transaction_instruction_not_spl_token_transfer_checked      | The instruction in the SVM payload is not a valid SPL Token TransferChecked instruction |
| invalid_exact_svm_payload_transaction_instruction_not_token_2022_transfer_checked     | The instruction in the SVM payload is not a valid Token 2022 TransferChecked instruction |
| invalid_exact_svm_payload_transaction_fee_payer_included_in_instruction_accounts      | The fee payer address is incorrectly included in the instruction accounts list of the SVM payload transaction |
| invalid_exact_svm_payload_transaction_fee_payer_transferring_funds                    | The fee payer is attempting to transfer funds in the SVM payload transaction, which is not allowed |
| invalid_exact_svm_payload_transaction_not_a_transfer_instruction                      | The instruction in the SVM payload transaction is not a valid token transfer instruction |
| invalid_exact_svm_payload_transaction_receiver_ata_not_found                          | The Associated Token Account (ATA) for the receiver does not exist |
| invalid_exact_svm_payload_transaction_sender_ata_not_found                            | The Associated Token Account (ATA) for the sender does not exist |
| invalid_exact_svm_payload_transaction_simulation_failed                               | Simulation of the SVM payload transaction failed before execution |
| invalid_exact_svm_payload_transaction_transfer_to_incorrect_ata                       | The token transfer in the SVM payload is directed to an incorrect Associated Token Account (ATA) |
| invalid_network                                                                       | The network specified for the transaction is invalid or unsupported |
| invalid_payload                                                                       | The transaction payload is malformed, incomplete, or otherwise invalid |
| invalid_payment_requirements                                                          | The payment requirements defined in the transaction are invalid |
| invalid_scheme                                                                        | The payment or transaction scheme specified is invalid |
| invalid_payment                                                                       | The payment details provided are invalid or cannot be processed |
| payment_expired                                                                       | The payment has expired and can no longer be processed |
| unsupported_scheme                                                                    | The payment or transaction scheme specified is not supported |
| invalid_x402_version                                                                  | The X402 protocol version specified is invalid |
| invalid_transaction_state                                                             | The current state of the transaction is invalid for the requested operation |
| settle_exact_svm_block_height_exceeded                                                | The block height limit for settling the SVM transaction has been exceeded |
| settle_exact_svm_transaction_confirmation_timed_out                                   | The confirmation process for the SVM transaction has timed out |
| unexpected_settle_error                                                               | An unexpected error occurred while attempting to settle the transaction |
| unexpected_verify_error                                                               | An unexpected error occurred while attempting to verify the transaction or payload |


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

| Network | Chain ID | Example Token Address                               |
|---------|----------|-----------------------------------------------------|
| BSC     | 56       | USDT: `0x55d398326f99059ff775485246999027b3197955`  |
| BSC     | 56       | USDC: `0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d`  |
| BSC     | 56       | TESTU: `0x6e3BCf81d331fa7Bd79Ac2642486c70BEAE2600E` |
| BASE    | 8453     | USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`  |
| BASE    | 8453     | USDT: `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2`  |
| X Layer | 196      | USDT: `0x779ded0c9e1022225f8e0630b35a9b54be713736`  |
| X Layer | 196      | USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`  |



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
- Verify wallet client chain matches `network`
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


## Support & Resources

- **Documentation**: [https://docs.aeon.xyz](https://docs.aeon.xyz)
- **Facilitator**: [https://facilitator.aeon.xyz](https://facilitator.aeon.xyz)

---

## License

This implementation follows the x402 protocol specification. See individual package licenses for details.

---

**Last Updated:** December 2025
**Protocol Version:** x402 V2.0

