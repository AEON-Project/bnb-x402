# API Integration Guide: Calling Facilitator and Building Your Own Facilitator Server


This document will guide you through two key tasks: first, how to call the facilitator (via its core `verify` and `settle` APIs), and second, how to encapsulate these two APIs to build your own facilitator server. Whether you need to interact with an existing facilitator or develop a custom one, this guide provides step-by-step instructions for API integration, parameter specifications, and workflow design.


## 1. API Overview

This document aims to guide developers in correctly calling the `verify` and `settle` APIs (core components of the facilitator), including their purposes, request flow, formats, parameter descriptions, and examples. The two APIs must be called in the order of **first calling `verify` and, upon success, then calling `settle`**.


### 1.1 Basic Information
- **Protocol**: HTTP/HTTPS
- **Base URL**: `https://facilitator.aeon.xyz` 
- **Common Request Method**: `POST`
- **Common Request Headers**: Both APIs share the same request headers (see detailed description below)


## 2. API Calling Flow
1. **Call the `verify` API**: Validate the legitimacy of payment-related information (such as parameter formats, signature validity, etc.).
2. **Check `verify` response**: If `data.valid` in the response is `true` (verification successful), proceed to the next step; if failed, correct the parameters based on the error message and re-call `verify`.
3. **Call the `settle` API**: After `verify` succeeds, submit a payment settlement request to complete the final payment confirmation or fund transfer.


## 3. `verify` API

### 3.1 API Purpose
Used to validate the legitimacy of payment requirement parameters, signature information, etc. It is a pre-check for initiating settlement (`settle`), ensuring that payment parameters meet system requirements.


### 3.2 Request Information

#### 3.2.1 Request URL
`[Base URL]/verify`


#### 3.2.2 Request Method
`POST`


#### 3.2.3 Request Headers

| Field Name      | Type   | Required | Description                                      | Example Value          |  
|-----------------|--------|----------|--------------------------------------------------|-------------------------|  
| Content-Type    | string | Yes      | Request body format, fixed as `application/json`  | `application/json`      |  
| Authorization   | string | Yes      | Authentication token, in the format `Bearer [token]` | `Bearer 123`            |  


#### 3.2.4 Request Body
The request body is in JSON format, containing the following fields:

| First-level Field     | Type   | Required | Description                                                                 |  
|-----------------------|--------|----------|-----------------------------------------------------------------------------|  
| payload               | string | Yes      | Encoded payment-related payload (Base64-encoded JSON string containing core information such as signatures) |  
| paymentRequirements   | object | Yes      | Detailed parameters of payment requirements                                 |  


**Description of `paymentRequirements` fields**:

| Second-level Field     | Type   | Required | Description                                                                 | Example Value                                      |  
|------------------------|--------|----------|-----------------------------------------------------------------------------|-----------------------------------------------------|  
| scheme                 | string | Yes      | Payment scheme type, fixed as `exact`                                       | `exact`                                             |  
| namespace              | string | Yes      | Blockchain namespace (use `evm` for EVM-compatible chains)                   | `evm`                                               |  
| tokenAddress           | string | Yes      | Contract address of the payment token (EVM chain format)                    | `0x6e3BCf81d331fa7Bd79Ac2642486c70BEAE2600E`         |  
| amountRequired         | number | Yes      | Required payment amount (human-readable format)                             | `0.01`                                              |  
| amountRequiredFormat   | string | Yes      | Amount format, fixed as `humanReadable` (non-minimal unit)                   | `humanReadable`                                     |  
| networkId              | string | Yes      | Blockchain network ID (e.g., 56 corresponds to Binance Smart Chain)          | `56`                                                |  
| payToAddress           | string | Yes      | Recipient address (EVM chain format)                                        | `0xA0a35e76e4476Bd62fe452899af7aEa6D1B20aB7`         |  
| description            | string | Yes      | Payment description (e.g., resource access instructions)                    | `Premium content access with TESTU`                 |  
| tokenDecimals          | number | Yes      | Number of decimal places of the token (usually 18)                           | `18`                                                |  
| tokenSymbol            | string | Yes      | Token symbol                                                                | `TESTU`                                             |  
| resource               | string | Yes      | URL of the resource corresponding to the payment (e.g., content access URL) | `http://localhost:4021/premium/content`             |  


### 3.3 Response Information

#### 3.3.1 Success Response (Verification Passed)
- **Status Code**: `200 OK`
- **Response Body**:
  ```json  
  {  
    "isValid": true,
    "type": "payload"
  }  
  ```  
- **verifyheaders**: 
   ```json {
    "x-powered-by": "Express",
    "content-type": "application/json; charset=utf-8",
    "content-length": "33",
    "etag": "W/21-VdI4kxX6pkOFCWYq2jYO1Tz2sD4",
    "date": "Fri, 14 Nov 2025 08:45:50 GMT",
    "connection": "keep-alive",
    "keep-alive": "timeout=5"
    }
  ``` 
  


#### 3.3.2 Failure Response (Verification Failed)
- **Status Code**: `401`.
- **Response Body**:
  ```json  
  {
  "error": "Invalid API key - external validation failed"
  }
  ```  
- **Error Response Headers**:
  ```json 
  {
    "x-powered-by": "Express",
    "content-type": "application/json; charset=utf-8",
    "content-length": "56",
    "etag": "W/\"38-SCeDq9JH0RX2yP66KV0Q9H3RCMk\"",
    "date": "Fri, 14 Nov 2025 10:36:00 GMT",
    "connection": "keep-alive",
    "keep-alive": "timeout=5"
  }
  ```


### 3.4 Request Example (cURL)
```bash  
curl --location '[Base URL]/verify' \  
--header 'Content-Type: application/json' \  
--header 'Authorization: Bearer 123' \  
--data '{
	"payload": "eyJ4NDAyVmVyc2lvbiI6MSwic2NoZW1lIjoiZXhhY3QiLCJuYW1lc3BhY2UiOiJldm0iLCJuZXR3b3JrSWQiOiI1NiIsInJlc291cmNlIjoiaHR0cDovL2xvY2FsaG9zdDo0MDIxL3dlYXRoZXIiLCJwYXlsb2FkIjp7InR5cGUiOiJhdXRob3JpemF0aW9uIiwic2lnbmF0dXJlIjoiMHg1NjQyNGMzM2JlNGI3Njk2MGUwMDA3OWE2JlZDAyZDRhMWIxNGU5MWI\nzNTExY2M1ZTUzMDFkYTZlZWViZjE5NmZhNTkxYzVmZmY0NGVhMDc5ODQ3OWVkYmIyOTNhMGIwNGIzN2E1MDM2NDhkNGVhMGIxYjcxM2RmNjQyM2JiZjFjIiwiYXV0aG9yaXphdGlvbiI6eyJmcm9tIjoiMHhBMGEzNWU3NmU0NDc2QmQ2MmZlNDUyODk5YWY3YUVhNkQxQjIwYUI3IiwidG8iOiIweEQyMWFGMDUwOEUxM0ZjNjJEYkE0RDE1MzlBNWREOEQ4OWNmOERmMTQiLCJ2YWx1ZSI6IjEwMDAwMDAwMDAwMDAwMDAiLCJ2YWxpZEFmdGVyIjoiMTc2MzEwOTg4MCIsInZhbGlkQmVmb3JlIjoiMTc2MzExMDU0MCIsIm5vbmNlIjoiMHg4YmM2ZTQ4NzhlMGVmZTFjMDRhMjFmYzJlNGRlMWVjMDEyNDU3MjNiZWFkYmVlYjAxN2NmNzA3YmNiZWIwZmJiIiwidmVyc2lvbiI6IjEifX19",
	"paymentRequirements": {
		"scheme": "exact",
		"namespace": "evm",
		"tokenAddress": "0x55d398326f99059ff775485246999027b3197955",
		"amountRequired": 0.001,
		"amountRequiredFormat": "humanReadable",
		"payToAddress": "0xD21aF0508E13Fc62DbA4D1539A5dD8D89cf8Df14",
		"networkId": "56",
		"tokenDecimals": 18,
		"tokenSymbol": "USDT",
		"resource": "http://localhost:4021/weather"
	}
}'  
```  


## 4. `settle` API

### 4.1 API Purpose
After the `verify` API succeeds, submit a payment settlement request to confirm payment completion and execute subsequent operations (such as resource authorization, fund transfer, etc.).


### 4.2 Request Information

#### 4.2.1 Request URL
`[Base URL]/settle`


#### 4.2.2 Request Method
`POST`


#### 4.2.3 Request Headers
Same as the `verify` API:

| Field Name      | Type   | Required | Description                                      | Example Value          |  
|-----------------|--------|----------|--------------------------------------------------|-------------------------|  
| Content-Type    | string | Yes      | Request body format, fixed as `application/json`  | `application/json`      |  
| Authorization   | string | Yes      | Authentication token, in the format `Bearer [token]` | `Bearer 123`            |  


#### 4.2.4 Request Body
The request body is in JSON format, containing the `verifyId` returned by the `verify` API and payment transaction information:

| Field Name         | Type   | Required | Description                                                                 | Example Value                                      |  
|--------------------|--------|----------|-----------------------------------------------------------------------------|-----------------------------------------------------|  
| verifyId           | string | Yes      | Unique verification ID returned by the `verify` API (used to associate verification records) | `verify_123456`                                     |  
| transactionHash    | string | Yes      | Blockchain payment transaction hash (must match the payment parameters in `verify`) | `0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef` |  
| timestamp          | number | Yes      | Timestamp of transaction completion (in milliseconds)                        | `1718236800000`                                     |  


### 4.3 Response Information

#### 4.3.1 Success Response (Settlement Completed)
- **Status Code**: `200 OK`
- **Response Body**:
  ```json  
  {
  "success": true,
  "transaction": "0x09e289173079ba3dcee54d9ff23f4b27d45f34100c7dda93daa29e1d53bd9d92",
  "namespace": "evm",
  "payer": "0xA0a35e76e4476Bd62fe452899af7aEa6D1B20aB7"
  }  
  ```
- **settleheaders**: 
  ```json
   {
   "x-powered-by": "Express",
    "content-type": "application/json; charset=utf-8",
    "content-length": "170",
    "etag": "W/aa-JJ1fd5obnqX8fUrlDmWVzQK23pk",
    "date": "Fri, 14 Nov 2025 08:45:53 GMT",
    "connection": "keep-alive",
    "keep-alive": "timeout=5"
    }
    ```


#### 4.3.2 Failure Response (Settlement Failed)
- **Status Code**: `401`.
- **Response Body**:
  ```json  
  {
  "error": "Invalid API key - external validation failed"
  }
  ```  
- **Error Response Headers**:
  ```json 
  {
    "x-powered-by": "Express",
    "content-type": "application/json; charset=utf-8",
    "content-length": "56",
    "etag": "W/38-SCeDq9JH0RX2yP66KV0Q9H3RCMk\"",
    "date": "Fri, 14 Nov 2025 10:36:00 GMT",
    "connection": "keep-alive",
    "keep-alive": "timeout=5"
  }
  ```


### 4.4 Request Example (cURL)
```bash  
curl --location '[Base URL]/settle' \  
--header 'Content-Type: application/json' \  
--header 'Authorization: Bearer 123' \  
--data '{
  "payload": "eyJ4NDAyVmVyc2lvbiI6MSwic2NoZW1lIjoiZXhhY3QiLCJuYW1lc3BhY2UiOiJldm0iLCJuZXR3b3JrSWQiOiI1NiIsInJlc291cmNlIjoiaHR0cDovL2xvY2FsaG9zdDo0MDIxL3dlYXRoZXIiLCJwYXlsb2FkIjp7InR5cGUiOiJhdXRob3JpemF0aW9uIiwic2lnbmF0dXJlIjoiMHg1NjQyNGMzM2JlNGI3Njk2MGUwMDA3OWE2JlZDAyZDRhMWIxNGU5MWI nzNTExY2M1ZTUzMDFkYTZlZWViZjE5NmZhNTkxYzVmZmY0NGVhMDc5ODQ3OWVkYmIyOTNhMGIwNGIzN2E1MDM2NDhkNGVhMGIxYjcxM2RmNjQyM2JiZjFjIiwiYXV0aG9yaXphdGlvbiI6eyJmcm9tIjoiMHhBMGEzNWU3NmU0NDc2QmQ2MmZlNDUyODk5YWY3YUVhNkQxQjIwYUI3IiwidG8iOiIweEQyMWFGMDUwOEUxM0ZjNjJEYkE0RDE1MzlBNWREOEQ4OWNmOERmMTQiLCJ2YWx1ZSI6IjEwMDAwMDAwMDAwMDAwMDAiLCJ2YWxpZEFmdGVyIjoiMTc2MzEwOTg4MCIsInZhbGlkQmVmb3JlIjoiMTc2MzExMDU0MCIsIm5vbmNlIjoiMHg4YmM2ZTQ4NzhlMGVmZTFjMDRhMjFmYzJlNGRlMWVjMDEyNDU3MjNiZWFkYmVlYjAxN2NmNzA3YmNiZWIwZmJiIiwidmVyc2lvbiI6IjEifX19",
  "paymentRequirements": {
    "scheme": "exact",
    "namespace": "evm",
    "tokenAddress": "0x55d398326f99059ff775485246999027b3197955",
    "amountRequired": 0.001,
    "amountRequiredFormat": "humanReadable",
    "payToAddress": "0xD21aF0508E13Fc62DbA4D1539A5dD8D89cf8Df14",
    "networkId": "56",
    "tokenDecimals": 18,
    "tokenSymbol": "USDT",
    "resource": "http://localhost:4021/weather"
  }
}' 
```  


## 5. HTTP Status Codes

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

## 6. Example of ERC20 pre-authorization and signature without support for EIP3009
1. **pre-authorization** :
  ```solidity
  const ERC20_ABI = [
    {
    name: "transfer",
    type: "function",
    inputs: [
      {name: "to", type: "address"},
      {name: "value", type: "uint256"},
    ],
    outputs: [{name: "success", type: "bool"}],
      stateMutability: "nonpayable",
    },
    {
    type: "function",
    name: "approve",
    inputs: [
      {name: "spender", type: "address"},
      {name: "amount", type: "uint256"}
    ],
    outputs: [{name: "success", type: "bool"}],
    stateMutability: "nonpayable",
    },
    {
    type: "function",
    name: "allowance",
    inputs: [
      {name: "owner", type: "address"},
      {name: "spender", type: "address"}
    ],
    outputs: [{name: "remaining", type: "uint256"}],
    stateMutability: "view",
    },
  ] as const;
  
  
  
  const facilitatorAddress = "0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e" as Hex;
  // For external wallets like MetaMask
  console.log("For external wallets like MetaMask")
  approveTxHash = await client.sendTransaction({
  account: from as Hex,
  to: tokenAddress as Hex,
  data: encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
  args: [facilitatorAddress, value],
  }),
  chain: evm.getChain(networkId),
  });
  console.log("For external wallets like MetaMask approveTxHash:", approveTxHash)
  
  
  // Wait for approval transaction to be confirmed
  const approvalReceipt = await client.waitForTransactionReceipt({
  hash: approveTxHash,
  });
  
  if (approvalReceipt.status !== "success") {
  throw new Error("Token approval transaction failed");
  }
      
  ```
2. **signature method** :
  ```solidity
  const nonce = evm.createNonce();
  const currentTime = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(currentTime - 60); // 1 minute before current time for safety
  const validBefore = BigInt(currentTime + (estimatedProcessingTime ?? 600)); // 10 minutes from now
  
  const verifyingContract = "0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e";
  
  const data = {
  types: {
    tokenTransferWithAuthorization: [
      {name: "token", type: "address"},
      {name: "from", type: "address"},
      {name: "to", type: "address"},
      {name: "value", type: "uint256"},
      {name: "validAfter", type: "uint256"},
      {name: "validBefore", type: "uint256"},
      {name: "nonce", type: "bytes32"},
      {name: "needApprove", type: "bool"},
    ],
  },
  domain: {
    name: "Facilitator",
    version: "1",
    chainId: parseInt(networkId),
    verifyingContract: verifyingContract as Hex,
  },
  primaryType: "tokenTransferWithAuthorization" as const,
  message: {
      token: tokenAddress?.toLowerCase(),
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      value,
      validAfter,
      validBefore,
      nonce,
      needApprove: true,
    },
  };
  let signature: Hex;
  
  signature = (await client.account.signTypedData(data)) as Hex;
  ```
## 7. Erc20 signature example supporting EIP3009


  ```solidity
  const nonce = evm.createNonce();
  const currentTime = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(currentTime - 60); // 1 minute before current time for safety
  const validBefore = BigInt(currentTime + (estimatedProcessingTime ?? 600)); // 10 minutes from now
  
  // const verifyingContract = "0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e";
  const {domain} = await client.getEip712Domain({
  address: tokenAddress?.toLowerCase() as Hex,
  });
  const data = {
  types: {
  TransferWithAuthorization: [
    {name: "from", type: "address"},
    {name: "to", type: "address"},
    {name: "value", type: "uint256"},
    {name: "validAfter", type: "uint256"},
    {name: "validBefore", type: "uint256"},
    {name: "nonce", type: "bytes32"},
  ],
  },
  domain: {
  name: domain.name,
  version: domain.version,
  chainId: parseInt(networkId),
  verifyingContract: tokenAddress?.toLowerCase() as Hex,
  },
  primaryType: "TransferWithAuthorization" as const,
  message: {
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce,
    },
  };
  let signature: Hex;
  signature = (await client.account.signTypedData(data)) as Hex;
  ```

## 8. Notes
1. **API Order**: `verify` must be called first and succeed (`data.valid=true`) before calling `settle`; otherwise, `settle` will return a verification failure error.
2. **Parameter Consistency**: `transactionHash` in `settle` must match the payment information described in `paymentRequirements` of `verify` (e.g., amount, token, recipient address, etc.).
3. **Timeliness**: `verifyId` has an expiration period (usually 5-10 minutes); re-call `verify` after expiration to get a new one.
4. **Idempotency**: The `settle` API supports idempotent calls (multiple calls with the same `transactionHash` will not result in duplicate settlements). It is recommended to use `transactionHash` for idempotency control.


## 9. Building Your Own Facilitator Server
To encapsulate `verify` and `settle` into your custom facilitator server, follow these steps:

1. **Define Server Endpoints**: Expose your own `/verify` and `/settle` endpoints that proxy requests to the underlying `verify` and `settle` APIs.
2. **Add Custom Logic**: Integrate business logic such as additional validation (e.g., user permission checks), logging, or payment record storage between request reception and proxying to the core APIs.
3. **Handle Responses**: Forward or transform responses from the core APIs to fit your application’s needs (e.g., mapping error codes to your system’s standards).
4. **Ensure Security**: Implement authentication (e.g., API keys, OAuth2) for your server’s endpoints to restrict access, in addition to the `Authorization` header required by the core APIs.
5. **Test Workflow**: Validate the end-to-end flow: client → your facilitator server → core `verify`/`settle` APIs → your server → client, ensuring parameter consistency and error handling.

Example workflow for your facilitator server:
- Client sends a verification request to your `/verify` endpoint.
- Your server validates the client’s credentials, then forwards the request to the core `verify` API.
- Upon receiving the core API’s response, your server logs the result, then returns the response (or a transformed version) to the client.
- For settlement, repeat the process with your `/settle` endpoint, ensuring `verifyId` is valid and transaction details match.