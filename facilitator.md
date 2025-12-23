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

| First-level Field   | Type   | Required | Description                                                                                         |  
|---------------------|--------|----------|-----------------------------------------------------------------------------------------------------|  
| paymentPayload      | object | Yes      | Payment-related payload (This information is crucial, primarily for signing purposes) |  
| paymentRequirements | object | Yes      | Detailed parameters of payment requirements                                                         |  


**Description of `paymentPayload:` fields**:

##  PaymentPayload Top-Level Fields

| Second-level Field |Type|Required|Description|Example Value|
|--------------------|---|---|---|---|
| x402Version        |number|Yes|x402 protocol version number, fixed as 2|2|
| payload            |object|Yes|Core payload information for payment authorization, including authorization parameters and signature|{"authorization":{"from":"0x34B7FE106891a07528b4F2e5E339C32DA13cF510",...},"signature":"0x13c148ab519215be61c5c9e22aaea37feed3d70b612e481d7fe57108457f9eea254b17e19bfda3fe8c9912f33c2abee6188956db98a8acab3e8bb5edcdda19201b"}|
| resource           |object|Yes|Information about accessible resources after payment|{"url":"http://localhost:4021/weather","description":"Weather data","mimeType":"application/json"}|
| accepted           |object|Yes|Payment terms accepted by the payee, consistent with PaymentRequirements structure|{"scheme":"exact","network":"eip155:56","amount":"10000","asset":"0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",...}|
## PaymentPayload.payload Subfields

| Second-level Field |Type|Required|Description|Example Value|
|--------------------|---|---|---|---|
| authorization      |object|Yes|Core parameter set for payment authorization|{"from":"0x34B7FE106891a07528b4F2e5E339C32DA13cF510","to":"0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628","value":"10000",...}|
| signature          |string|Yes|Digital signature of the payload by the payer |0x13c148ab519215be61c5c9e22aaea37feed3d70b612e481d7fe57108457f9eea254b17e19bfda3fe8c9912f33c2abee6188956db98a8acab3e8bb5edcdda19201b|
## PaymentPayload.payload.authorization Subfields

| Second-level Field |Type|Required|Description|Example Value|
|--------------------|---|---|---|---|
| from               |string|Yes|Payer's address |0x34B7FE106891a07528b4F2e5E339C32DA13cF510|
| to                 |string|Yes|Recipient address |0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628|
| value              |string|Yes|Payment amount|10000|
| validAfter         |string|Yes|Authorization effective timestamp |1766455877|
| validBefore        |string|Yes|Authorization expiration timestamp |1766456777|
| nonce              |string|Yes|Random number to prevent replay attacks|0x76688160ef13a286971315a6757794a3840b8eb837cdb2ebae849ce410e3891f|
## PaymentPayload.resource Subfields

| Second-level Field |Type| Required |Description| Example Value                 |
|--------------------|---|-------|---|-------------------------------|
| url                |string| Yes   |URL of the resource corresponding to the payment| http://localhost:4021/weather |
| description        |string| Yes   |Resource description| resource description                           |
| mimeType           |string| No    |MIME type of the resource| application/json              |
## PaymentPayload.accepted Subfields

| Second-level Field |Type|Required| Description                                                         | Example Value                              |
|--------------------|---|---|---------------------------------------------------------------------|--------------------------------------------|
| scheme             |string|Yes| Payment scheme type, fixed as `exact`                               | exact                                      |
| network            |string|Yes| Blockchain network (e.g., 56 corresponds to Binance Smart Chain)    | eip155:56                                  |
| networkId          |string|Yes| Blockchain network ID (e.g., 56 corresponds to Binance Smart Chain) | 56                                         |
| amount             |string|Yes| Payment amount value                                                | 10000                                      |
| asset              |string|Yes| Token contract address                                              | 0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628 |
| payTo              |string|Yes| Payment target address           | 0x2EC8A3D26b720c7a2B16f582d883F722bEEA3628              |
| maxTimeoutSeconds  |number|Yes| Payment timeout period (unit: seconds)                              | 300                                        |
| extra              |object|Yes| Additional supplementary information related to payment             | {"name":"USDT","version":"1"}              |

**JSON Example**:
```json
  {
  "x402Version": 2,
  "payload": {
    "authorization": {
      "from": "0x34B7FE106891a07528b4F2e5E339C32DA13cF510",
      "to": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
      "value": "10000",
      "validAfter": "1766455877",
      "validBefore": "1766456777",
      "nonce": "0x76688160ef13a286971315a6757794a3840b8eb837cdb2ebae849ce410e3891f"
    },
    "signature": "0x13c148ab519215be61c5c9e22aaea37feed3d70b612e481d7fe57108457f9eea254b17e19bfda3fe8c9912f33c2abee6188956db98a8acab3e8bb5edcdda19201b"
  },
  "resource": {
    "url": "http://localhost:4021/weather",
    "description": "Weather data",
    "mimeType": "application/json"
  },
  "accepted": {
    "scheme": "exact",
    "network": "eip155:56",
    "networkId": "56",
    "amount": "10000",
    "asset": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    "payTo": "0x2EC8A3D26b720c7a2B16f582d883F722bEEA3628",
    "maxTimeoutSeconds": 300,
    "extra": {
      "name": "USDT",
      "version": "1"
    }
  }
}
```

**Description of `paymentRequirements` fields**:

| Second-level Field |Type|Required| Description                                                         | Example Value                              |
|--------------------|---|---|---------------------------------------------------------------------|--------------------------------------------|
| scheme             |string|Yes| Payment scheme type, fixed as `exact`                               | exact                                      |
| network            |string|Yes| Blockchain network (e.g., 56 corresponds to Binance Smart Chain)    | eip155:56                                  |
| networkId          |string|Yes| Blockchain network ID (e.g., 56 corresponds to Binance Smart Chain) | 56                                         |
| amount             |string|Yes| Payment amount value                                                | 10000                                      |
| asset              |string|Yes| Token contract address                                              | 0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628 |
| payTo              |string|Yes| Payment target address           | 0x2EC8A3D26b720c7a2B16f582d883F722bEEA3628              |
| maxTimeoutSeconds  |number|Yes| Payment timeout period (unit: seconds)                              | 300                                        |
| extra              |object|Yes| Additional supplementary information related to payment             | {"name":"USDT","version":"1"}              |


**JSON Example**:
```json
{
	"scheme": "exact",
	"network": "eip155:56",
	"networkId": "56",
	"amount": "10000",
	"asset": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
	"payTo": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
	"maxTimeoutSeconds": 300,
	"extra": {
		"name": "USDT",
		"version": "1"
	}
}
```

### 3.3 Response Information

#### 3.3.1 Success Response (Verification Passed)
- **Status Code**: `200 OK`
- **Response Body**:
  ```json  
   {
     "isValid": true,
     "invalidReason": "undefined",
     "payer": "0x34B7FE106891a07528b4F2e5E339C32DA13cF510"
   }
  ```
  


#### 3.3.2 Failure Response (Verification Failed)
- **Status Code**: `401`.
- **Response Body**:
  ```json  
  {
  "isValid": false,
  "invalidReason": "Missing or invalid Authorization header. Expected: Bearer <API_KEY>.",
  "payer": "0x34B7FE106891a07528b4F2e5E339C32DA13cF510"
  }
  ```


### 3.4 Request Example (cURL)
```bash  
curl --location '[Base URL]/verify' \  
--header 'Content-Type: application/json' \  
--header 'Authorization: Bearer 123' \  
--data '{
    "paymentPayload": {
        "x402Version": 2,
        "payload": {
            "authorization": {
                "from": "0x34B7FE106891a07528b4F2e5E339C32DA13cF510",
                "to": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
                "value": "10000",
                "validAfter": "1766455877",
                "validBefore": "1766456777",
                "nonce": "0x76688160ef13a286971315a6757794a3840b8eb837cdb2ebae849ce410e3891f"
            },
            "signature": "0x13c148ab519215be61c5c9e22aaea37feed3d70b612e481d7fe57108457f9eea254b17e19bfda3fe8c9912f33c2abee6188956db98a8acab3e8bb5edcdda19201b"
        },
        "resource": {
            "url": "http://localhost:4021/weather",
            "description": "Weather data",
            "mimeType": "application/json"
        },
        "accepted": {
            "scheme": "exact",
            "network": "eip155:56",
            "networkId": "56",
            "amount": "10000",
            "asset": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
            "payTo": "0x2EC8A3D26b720c7a2B16f582d883F722bEEA3628",
            "maxTimeoutSeconds": 300,
            "extra": {
                "name": "USDT",
                "version": "1"
            }
        }
    },
    "paymentRequirements": {
        "scheme": "exact",
        "network": "eip155:56",
        "networkId": "56",
        "amount": "10000",
        "asset": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        "payTo": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
        "maxTimeoutSeconds": 300,
        "extra": {
            "name": "USDT",
            "version": "1"
        }
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

| First-level Field   | Type   | Required | Description                                                                                         |  
|---------------------|--------|----------|-----------------------------------------------------------------------------------------------------|  
| paymentPayload      | object | Yes      | Payment-related payload (This information is crucial, primarily for signing purposes) |  
| paymentRequirements | object | Yes      | Detailed parameters of payment requirements                                                         |  


**Description of `paymentPayload:` fields**:

##  PaymentPayload Top-Level Fields

| Second-level Field |Type|Required|Description|Example Value|
|--------------------|---|---|---|---|
| x402Version        |number|Yes|x402 protocol version number, fixed as 2|2|
| payload            |object|Yes|Core payload information for payment authorization, including authorization parameters and signature|{"authorization":{"from":"0x34B7FE106891a07528b4F2e5E339C32DA13cF510",...},"signature":"0x13c148ab519215be61c5c9e22aaea37feed3d70b612e481d7fe57108457f9eea254b17e19bfda3fe8c9912f33c2abee6188956db98a8acab3e8bb5edcdda19201b"}|
| resource           |object|Yes|Information about accessible resources after payment|{"url":"http://localhost:4021/weather","description":"Weather data","mimeType":"application/json"}|
| accepted           |object|Yes|Payment terms accepted by the payee, consistent with PaymentRequirements structure|{"scheme":"exact","network":"eip155:56","amount":"10000","asset":"0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",...}|
## PaymentPayload.payload Subfields

| Second-level Field |Type|Required|Description|Example Value|
|--------------------|---|---|---|---|
| authorization      |object|Yes|Core parameter set for payment authorization|{"from":"0x34B7FE106891a07528b4F2e5E339C32DA13cF510","to":"0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628","value":"10000",...}|
| signature          |string|Yes|Digital signature of the payload by the payer |0x13c148ab519215be61c5c9e22aaea37feed3d70b612e481d7fe57108457f9eea254b17e19bfda3fe8c9912f33c2abee6188956db98a8acab3e8bb5edcdda19201b|
## PaymentPayload.payload.authorization Subfields

| Second-level Field |Type|Required|Description|Example Value|
|--------------------|---|---|---|---|
| from               |string|Yes|Payer's address |0x34B7FE106891a07528b4F2e5E339C32DA13cF510|
| to                 |string|Yes|Recipient address |0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628|
| value              |string|Yes|Payment amount|10000|
| validAfter         |string|Yes|Authorization effective timestamp |1766455877|
| validBefore        |string|Yes|Authorization expiration timestamp |1766456777|
| nonce              |string|Yes|Random number to prevent replay attacks|0x76688160ef13a286971315a6757794a3840b8eb837cdb2ebae849ce410e3891f|
## PaymentPayload.resource Subfields

| Second-level Field |Type| Required |Description| Example Value                 |
|--------------------|---|-------|---|-------------------------------|
| url                |string| Yes   |URL of the resource corresponding to the payment| http://localhost:4021/weather |
| description        |string| Yes   |Resource description| resource description                           |
| mimeType           |string| No    |MIME type of the resource| application/json              |
## PaymentPayload.accepted Subfields

| Second-level Field |Type|Required| Description                                                         | Example Value                              |
|--------------------|---|---|---------------------------------------------------------------------|--------------------------------------------|
| scheme             |string|Yes| Payment scheme type, fixed as `exact`                               | exact                                      |
| network            |string|Yes| Blockchain network (e.g., 56 corresponds to Binance Smart Chain)    | eip155:56                                  |
| networkId          |string|Yes| Blockchain network ID (e.g., 56 corresponds to Binance Smart Chain) | 56                                         |
| amount             |string|Yes| Payment amount value                                                | 10000                                      |
| asset              |string|Yes| Token contract address                                              | 0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628 |
| payTo              |string|Yes| Payment target address           | 0x2EC8A3D26b720c7a2B16f582d883F722bEEA3628              |
| maxTimeoutSeconds  |number|Yes| Payment timeout period (unit: seconds)                              | 300                                        |
| extra              |object|Yes| Additional supplementary information related to payment             | {"name":"USDT","version":"1"}              |

**JSON Example**:
```json
  {
  "x402Version": 2,
  "payload": {
    "authorization": {
      "from": "0x34B7FE106891a07528b4F2e5E339C32DA13cF510",
      "to": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
      "value": "10000",
      "validAfter": "1766455877",
      "validBefore": "1766456777",
      "nonce": "0x76688160ef13a286971315a6757794a3840b8eb837cdb2ebae849ce410e3891f"
    },
    "signature": "0x13c148ab519215be61c5c9e22aaea37feed3d70b612e481d7fe57108457f9eea254b17e19bfda3fe8c9912f33c2abee6188956db98a8acab3e8bb5edcdda19201b"
  },
  "resource": {
    "url": "http://localhost:4021/weather",
    "description": "Weather data",
    "mimeType": "application/json"
  },
  "accepted": {
    "scheme": "exact",
    "network": "eip155:56",
    "networkId": "56",
    "amount": "10000",
    "asset": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    "payTo": "0x2EC8A3D26b720c7a2B16f582d883F722bEEA3628",
    "maxTimeoutSeconds": 300,
    "extra": {
      "name": "USDT",
      "version": "1"
    }
  }
}
```

**Description of `paymentRequirements` fields**:

| Second-level Field |Type|Required| Description                                                         | Example Value                              |
|--------------------|---|---|---------------------------------------------------------------------|--------------------------------------------|
| scheme             |string|Yes| Payment scheme type, fixed as `exact`                               | exact                                      |
| network            |string|Yes| Blockchain network (e.g., 56 corresponds to Binance Smart Chain)    | eip155:56                                  |
| networkId          |string|Yes| Blockchain network ID (e.g., 56 corresponds to Binance Smart Chain) | 56                                         |
| amount             |string|Yes| Payment amount value                                                | 10000                                      |
| asset              |string|Yes| Token contract address                                              | 0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628 |
| payTo              |string|Yes| Payment target address           | 0x2EC8A3D26b720c7a2B16f582d883F722bEEA3628              |
| maxTimeoutSeconds  |number|Yes| Payment timeout period (unit: seconds)                              | 300                                        |
| extra              |object|Yes| Additional supplementary information related to payment             | {"name":"USDT","version":"1"}              |


**JSON Example**:
```json
{
	"scheme": "exact",
	"network": "eip155:56",
	"networkId": "56",
	"amount": "10000",
	"asset": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
	"payTo": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
	"maxTimeoutSeconds": 300,
	"extra": {
		"name": "USDT",
		"version": "1"
	}
}
```

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


#### 4.3.2 Failure Response (Settlement Failed)
- **Status Code**: `401`.
- **Response Body**:
  ```json  
  {
  "isValid": false,
  "invalidReason": "Missing or invalid Authorization header. Expected: Bearer <API_KEY>.",
  "payer": "0x34B7FE106891a07528b4F2e5E339C32DA13cF510"
  }
  ```


### 4.4 Request Example (cURL)
```bash  
curl --location '[Base URL]/settle' \  
--header 'Content-Type: application/json' \  
--header 'Authorization: Bearer 123' \  
--data '{
    "paymentPayload": {
        "x402Version": 2,
        "payload": {
            "authorization": {
                "from": "0x34B7FE106891a07528b4F2e5E339C32DA13cF510",
                "to": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
                "value": "10000",
                "validAfter": "1766455877",
                "validBefore": "1766456777",
                "nonce": "0x76688160ef13a286971315a6757794a3840b8eb837cdb2ebae849ce410e3891f"
            },
            "signature": "0x13c148ab519215be61c5c9e22aaea37feed3d70b612e481d7fe57108457f9eea254b17e19bfda3fe8c9912f33c2abee6188956db98a8acab3e8bb5edcdda19201b"
        },
        "resource": {
            "url": "http://localhost:4021/weather",
            "description": "Weather data",
            "mimeType": "application/json"
        },
        "accepted": {
            "scheme": "exact",
            "network": "eip155:56",
            "networkId": "56",
            "amount": "10000",
            "asset": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
            "payTo": "0x2EC8A3D26b720c7a2B16f582d883F722bEEA3628",
            "maxTimeoutSeconds": 300,
            "extra": {
                "name": "USDT",
                "version": "1"
            }
        }
    },
    "paymentRequirements": {
        "scheme": "exact",
        "network": "eip155:56",
        "networkId": "56",
        "amount": "10000",
        "asset": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        "payTo": "0x2EC8A3D26b720c7a2B16f582d883F798bEEA3628",
        "maxTimeoutSeconds": 300,
        "extra": {
            "name": "USDT",
            "version": "1"
        }
    }
}'
```  


## 5. HTTP Status Codes

| Code  | Meaning          | Description |
|-------|------------------|-------------|
| `200` | OK               | Request successful, payment processed |
| `401` | Error            | Missing or invalid Authorization header. Expected: Bearer <API_KEY> |
| `402` | Payment Required | Payment needed to access resource |
| `400` | Bad Request      | Invalid payment payload |
| `403` | Forbidden        | Payment verification failed |
| `500` | Server Error     | Internal error processing payment |

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
/*If the contract does not include the getEip712Domain function, the Domain needs to be customized, such as base usdc
  domain = {
    name: 'USD Coin',
    version: '2',
    chainId: BigInt(parseInt(networkId)),
    verifyingContract: contractAddress,
   };*/
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