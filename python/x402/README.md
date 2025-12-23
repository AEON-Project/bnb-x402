# x402 Python SDK

**x402: An Internet-Native Payments Protocol**

x402 is a modern internet-native payment protocol Python SDK that supports blockchain-based micropayments and paywall functionality. This protocol is designed to simplify payment integration in Web3 applications, supporting multiple blockchain networks and tokens.

## 🚀 Key Features

- **Multi-Chain Support**: Supports EVM networks (Base, BSC, Avalanche, etc.) and SVM networks (Solana)
- **Framework Integration**: Provides FastAPI and Flask middleware for easy integration into existing projects
- **Paywall Functionality**: Built-in paywall templates supporting both browser and API clients
- **Type Safety**: Complete type annotations for modern Python development
- **Flexible Configuration**: Supports multiple tokens and custom payment requirements
- **Facilitator Mode**: Supports third-party facilitators for payment verification

## 📦 Installation

### Using uv (Recommended)

```bash
# Sync project dependencies
uv sync --python 3.11

# Install as editable package
uv pip install -e .