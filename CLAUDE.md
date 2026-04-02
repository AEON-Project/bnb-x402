# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this repo

A fork of [coinbase/x402](https://github.com/coinbase/x402) — the x402 payment protocol implementation. This fork extends support to additional EVM chains (BSC, X Layer, Kite) and custom tokens (USDT, TESTU) beyond the original Base/Sepolia scope.

## Build & Test Commands

All TypeScript commands run from `typescript/` directory:

```bash
cd typescript

# Install dependencies
pnpm install

# Build all packages (turbo orchestrated, respects dependency order)
pnpm build

# Run all unit tests
pnpm test

# Run integration tests (core, evm, svm)
pnpm test:integration

# Run a single package's tests
pnpm --filter @x402/core test
pnpm --filter @x402/evm test
pnpm --filter @x402/axios test

# Lint & format
pnpm lint
pnpm format
```

Python SDK (from `python/x402/`):

```bash
cd python/x402
pip install -e ".[dev]"
pytest
ruff check .
```

## Running Examples

```bash
# TypeScript server (Hono)
cd examples/typescript && pnpm install
npx tsx servers/hono/index.ts

# TypeScript client (Axios)
npx tsx clients/axios/index.ts

# Python server (FastAPI)
cd examples/python/legacy/servers/fastapi
uvicorn main:app --port 4021

# Python client (httpx)
cd examples/python/legacy/clients/httpx
python main.py
```

## Architecture

### Protocol Versions (V1 vs V2)

**V2** (TypeScript SDK, `x402Version: 2`):
- 402 response: payment requirements in `PAYMENT-REQUIRED` header (base64 encoded)
- Client sends payment via `PAYMENT-SIGNATURE` header
- Settlement response in `PAYMENT-RESPONSE` header
- `accepts[].amount` field, `network` in CAIP-2 format (`eip155:56`)

**V1** (Python SDK, `x402Version: 1`):
- 402 response: payment requirements in JSON body
- Client sends payment via `X-PAYMENT` header
- Settlement response in `X-PAYMENT-RESPONSE` header
- `accepts[].maxAmountRequired` field, `network` as friendly name (`base-sepolia`)

The TypeScript client (`x402HTTPClient.getPaymentRequiredResponse`) has been patched to accept body-based responses for any version, enabling interop with V1 servers and Java servers that put V2 data in the body.

### TypeScript Monorepo (pnpm + turbo)

```
typescript/packages/
├── core/          # @x402/core — protocol types, facilitator client, HTTP encoding/decoding
│   ├── src/types/          # PaymentRequired, PaymentPayload, PaymentRequirements
│   ├── src/http/           # x402HTTPClient (client), x402HTTPResourceServer (server)
│   ├── src/client/         # x402Client — scheme registry + payment creation
│   └── src/server/         # x402ResourceServer — verify/settle orchestration
├── mechanisms/
│   ├── evm/       # @x402/evm — EVM signing (viem), TransferWithAuthorization + approve fallback
│   └── svm/       # @x402/svm — Solana signing
├── http/
│   ├── axios/     # @x402/axios — Axios interceptor wrapping x402Client
│   ├── fetch/     # @x402/fetch — Fetch wrapper
│   ├── express/   # @x402/express — Express middleware wrapping x402HTTPResourceServer
│   ├── hono/      # @x402/hono — Hono middleware
│   ├── next/      # @x402/next — Next.js middleware
│   └── paywall/   # @x402/paywall — React wallet-connect paywall UI
└── legacy/        # V1 implementations (deprecated)
```

### Key Abstractions

- **x402Client** (client-side): Registry of `SchemeNetworkClient` implementations. Selects matching scheme for a `PaymentRequired` response and creates signed `PaymentPayload`.
- **x402HTTPClient** (client-side): HTTP adapter that encodes/decodes payment headers. Wraps x402Client.
- **x402ResourceServer** (server-side): Verifies payment signatures and settles via facilitator.
- **x402HTTPResourceServer** (server-side): Route matching, paywall HTML generation, HTTP header handling. Used by Express/Hono/Next middleware.
- **FacilitatorClient**: Calls external facilitator `/verify` and `/settle` endpoints.

### Custom Chains Added in This Fork

Custom chain definitions are in `typescript/packages/mechanisms/evm/src/custom-chains/`:
- `kite` (Chain ID 2366)
- `bscTest` (Chain ID 97)
- `xLayer` (Chain ID 196)

These are exported via `@x402/evm/custom-chains`.

### Python SDK

```
python/x402/src/x402/
├── types.py          # Pydantic models (uses camelCase aliases for JSON compat)
├── common.py         # x402_VERSION = 1, shared utilities
├── exact.py          # EIP-3009 TransferWithAuthorization signing
├── clients/
│   ├── base.py       # x402Client core logic
│   ├── httpx.py      # httpx async client with payment hooks
│   └── requests.py   # requests adapter
├── fastapi/middleware.py  # FastAPI payment middleware
├── flask/middleware.py    # Flask payment middleware
└── facilitator.py    # Facilitator HTTP client
```

## Integration with Java Backend (CP)

This repo's TypeScript/Python clients connect to a Java-based Crypto Payment (CP) server. The CP server:
- Returns 402 responses with V2 fields in JSON body (not in headers)
- Reads payment from both `PAYMENT-SIGNATURE` (v2) and `X-PAYMENT` (v1) headers
- Settles via external facilitator at configurable URL
- Key response class: `X402ScanCodeApi2Response` with `Accept` inner class containing both v2 standard fields (`amount`, `networkId` as string, `network` as CAIP-2) and internal fields (`amountRequired`, `tokenDecimals`, `tokenSymbol`)
