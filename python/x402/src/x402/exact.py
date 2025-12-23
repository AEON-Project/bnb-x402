import time
import secrets
import os
from typing import Dict, Any
from typing_extensions import (
    TypedDict,
)  # use `typing_extensions.TypedDict` instead of `typing.TypedDict` on Python < 3.12
from eth_account import Account
from x402.encoding import safe_base64_encode, safe_base64_decode
from x402.types import (
    PaymentRequirements,
)
from x402.chains import get_chain_id
import json
from web3 import Web3
try:
    # web3.py < 7
    from web3.middleware import geth_poa_middleware as poa_middleware
except ImportError:  # pragma: no cover
    # web3.py >= 7
    from web3.middleware import ExtraDataToPOAMiddleware as poa_middleware


# Facilitator contract address (EVM exact scheme)
FACILITATOR_ADDRESS = "0x555e3311a9893c9B17444C1Ff0d88192a57Ef13e"

# Minimal ERC-20 ABI for approve/allowance (pre-authorization flow)
ERC20_ABI = [
    {
        "type": "function",
        "name": "approve",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "success", "type": "bool"}],
        "stateMutability": "nonpayable",
    },
    {
        "type": "function",
        "name": "allowance",
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "outputs": [{"name": "remaining", "type": "uint256"}],
        "stateMutability": "view",
    },
]


def _get_rpc_url_for_network(network: str) -> str | None:
    """
    Resolve RPC URL for a network.

    Priority:
    - env X402_RPC_URLS: "base=...,bsc=...,xlayer=..."
    - env X402_RPC_URL_<NETWORK> (e.g. X402_RPC_URL_BASE_SEPOLIA)
    - env X402_RPC_URL
    """
    mapping = os.getenv("X402_RPC_URLS")
    if mapping:
        try:
            pairs = [p.strip() for p in mapping.split(",") if p.strip()]
            for pair in pairs:
                if "=" not in pair:
                    continue
                k, v = pair.split("=", 1)
                if k.strip().lower() == str(network).strip().lower() and v.strip():
                    return v.strip()
        except Exception:
            pass

    network_key = str(network).upper().replace("-", "_")
    by_network = os.getenv(f"X402_RPC_URL_{network_key}")
    if by_network and by_network.strip():
        return by_network.strip()

    global_rpc = os.getenv("X402_RPC_URL")
    if global_rpc and global_rpc.strip():
        return global_rpc.strip()

    return None


def _ensure_erc20_allowance(
    account: Account,
    payment_requirements: PaymentRequirements,
    *,
    owner: str,
    spender: str,
    required_amount: int,
) -> None:
    """
    Ensure ERC-20 allowance(owner, spender) >= required_amount by sending approve() if needed.
    Mirrors TS client behavior: read allowance, approve if insufficient, wait receipt, fail if not success.
    """
    rpc = _get_rpc_url_for_network(str(payment_requirements.network))
    if not rpc:
        raise ValueError(
            "Missing RPC URL for ERC-20 approval flow. "
            "Set X402_RPC_URLS / X402_RPC_URL_<NETWORK> / X402_RPC_URL."
        )

    w3 = Web3(Web3.HTTPProvider(rpc))
    # Support POA chains (e.g. BSC) where block.extraData is longer than 32 bytes
    w3.middleware_onion.inject(poa_middleware, layer=0)
    token = Web3.to_checksum_address(payment_requirements.asset)
    owner_addr = Web3.to_checksum_address(owner)
    spender_addr = Web3.to_checksum_address(spender)

    token_contract = w3.eth.contract(address=token, abi=ERC20_ABI)
    current_allowance = token_contract.functions.allowance(owner_addr, spender_addr).call()
    if int(current_allowance) >= int(required_amount):
        return

    print(f"approve: {spender_addr} ,required_amount: {required_amount}")
    # Build approve tx
    approve_fn = token_contract.functions.approve(spender_addr, int(required_amount))
    tx = approve_fn.build_transaction(
        {
            "from": owner_addr,
            "nonce": w3.eth.get_transaction_count(owner_addr),
            "chainId": int(get_chain_id(payment_requirements.network)),
        }
    )

    def _populate_fee_fields(built_tx: dict) -> None:
        """
        Populate fee fields in a way compatible with eth-account:
        - If EIP-1559 fields are present (or chain supports it), use maxFeePerGas/maxPriorityFeePerGas and DO NOT set gasPrice.
        - Otherwise fall back to legacy gasPrice.
        """
        # If caller already provided fees, keep them and remove incompatible ones.
        if "maxFeePerGas" in built_tx or "maxPriorityFeePerGas" in built_tx:
            built_tx.pop("gasPrice", None)
            built_tx.setdefault("type", 2)
            return

        # Detect EIP-1559 support via baseFeePerGas on pending/latest block.
        base_fee = None
        try:
            blk = w3.eth.get_block("pending")
            base_fee = blk.get("baseFeePerGas")  # type: ignore[attr-defined]
        except Exception:
            try:
                blk = w3.eth.get_block("latest")
                base_fee = blk.get("baseFeePerGas")  # type: ignore[attr-defined]
            except Exception:
                base_fee = None

        if base_fee is not None:
            # EIP-1559 path
            try:
                priority = int(w3.eth.max_priority_fee)  # type: ignore[attr-defined]
            except Exception:
                # Conservative fallback
                priority = int(w3.to_wei(1, "gwei"))

            # Common heuristic: maxFee = 2*baseFee + priority
            max_fee = int(int(base_fee) * 2 + priority)
            built_tx["maxPriorityFeePerGas"] = priority
            built_tx["maxFeePerGas"] = max_fee
            built_tx["type"] = 2
            built_tx.pop("gasPrice", None)
            return

        # Legacy path
        try:
            built_tx["gasPrice"] = w3.eth.gas_price
        except Exception:
            pass

    # Gas + fee (best-effort)
    try:
        est = w3.eth.estimate_gas(tx)
        tx["gas"] = int(est * 1.2)
    except Exception:
        pass
    _populate_fee_fields(tx)

    # Some tokens (e.g. USDT-like) require setting allowance to 0 before increasing.
    def _send_and_wait(built_tx: dict) -> None:
        # Ensure fee fields are compatible before signing
        _populate_fee_fields(built_tx)
        signed = account.sign_transaction(built_tx)
        raw = getattr(signed, "raw_transaction", None)
        if raw is None:
            raw = getattr(signed, "rawTransaction", None)  # backwards compat
        if raw is None:
            raise AttributeError(
                "SignedTransaction missing raw transaction bytes (expected raw_transaction/rawTransaction)"
            )
        tx_hash = w3.eth.send_raw_transaction(raw)
        timeout = int(os.getenv("X402_APPROVAL_TX_TIMEOUT_SECONDS", "120"))
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)
        if getattr(receipt, "status", None) != 1:
            raise RuntimeError("Token approval transaction failed")

    try:
        _send_and_wait(tx)
    except Exception as e:
        msg = str(e).lower()
        if "must approve 0" in msg or "reset allowance" in msg or "approve from non-zero" in msg:
            # Try approve(0) then approve(required)
            tx0 = token_contract.functions.approve(spender_addr, 0).build_transaction(
                {
                    "from": owner_addr,
                    "nonce": w3.eth.get_transaction_count(owner_addr),
                    "chainId": int(get_chain_id(payment_requirements.network)),
                }
            )
            _send_and_wait(tx0)

            tx1 = token_contract.functions.approve(spender_addr, int(required_amount)).build_transaction(
                {
                    "from": owner_addr,
                    "nonce": w3.eth.get_transaction_count(owner_addr),
                    "chainId": int(get_chain_id(payment_requirements.network)),
                }
            )
            _send_and_wait(tx1)
        else:
            raise


def create_nonce() -> bytes:
    """Create a random 32-byte nonce for authorization signatures."""
    return secrets.token_bytes(32)


def prepare_payment_header(
    sender_address: str, x402_version: int, payment_requirements: PaymentRequirements
) -> Dict[str, Any]:
    """Prepare an unsigned payment header with sender address, x402 version, and payment requirements."""
    nonce = create_nonce()
    valid_after = str(int(time.time()) - 60)  # 60 seconds before
    valid_before = str(int(time.time()) + payment_requirements.max_timeout_seconds)

    return {
        "x402Version": x402_version,
        "scheme": payment_requirements.scheme,
        "network": payment_requirements.network,
        "payload": {
            "signature": None,
            "authorization": {
                "from": sender_address,
                "to": payment_requirements.pay_to,
                "value": payment_requirements.max_amount_required,
                "validAfter": valid_after,
                "validBefore": valid_before,
                "nonce": nonce,
            },
        },
    }


class PaymentHeader(TypedDict):
    x402Version: int
    scheme: str
    network: str
    payload: dict[str, Any]


def sign_payment_header(
    account: Account, payment_requirements: PaymentRequirements, header: PaymentHeader
) -> str:
    """Sign a payment header using the account's private key."""
    try:
        auth = header["payload"]["authorization"]

        nonce_bytes = bytes.fromhex(auth["nonce"])

        typed_data = {
            "types": {
                "TransferWithAuthorization": [
                    {"name": "from", "type": "address"},
                    {"name": "to", "type": "address"},
                    {"name": "value", "type": "uint256"},
                    {"name": "validAfter", "type": "uint256"},
                    {"name": "validBefore", "type": "uint256"},
                    {"name": "nonce", "type": "bytes32"},
                ]
            },
            "primaryType": "TransferWithAuthorization",
            "domain": {
                "name": payment_requirements.extra["name"],
                "version": payment_requirements.extra["version"],
                "chainId": int(get_chain_id(payment_requirements.network)),
                "verifyingContract": payment_requirements.asset,
            },
            "message": {
                "from": auth["from"],
                "to": auth["to"],
                "value": int(auth["value"]),
                "validAfter": int(auth["validAfter"]),
                "validBefore": int(auth["validBefore"]),
                "nonce": nonce_bytes,
            },
        }

        signed_message = account.sign_typed_data(
            domain_data=typed_data["domain"],
            message_types=typed_data["types"],
            message_data=typed_data["message"],
        )
        signature = signed_message.signature.hex()
        if not signature.startswith("0x"):
            signature = f"0x{signature}"

        header["payload"]["signature"] = signature

        header["payload"]["authorization"]["nonce"] = f"0x{auth['nonce']}"

        encoded = encode_payment(header)
        return encoded
    except Exception:
        raise

def sign_payment_header_No_Supper(
    account: Account, payment_requirements: PaymentRequirements, header: PaymentHeader
) -> str:
    """Sign a payment header using the account's private key."""
    try:
        auth = header["payload"]["authorization"]

        # Pre-authorization: ensure facilitator has enough allowance to pull tokens if token doesn't support EIP-3009
        _ensure_erc20_allowance(
            account,
            payment_requirements,
            owner=auth["from"],
            spender=FACILITATOR_ADDRESS,
            required_amount=int(auth["value"]),
        )

        nonce_bytes = bytes.fromhex(auth["nonce"])

        typed_data = {
            "types": {
                "tokenTransferWithAuthorization": [
                    {"name": "token", "type": "address"},
                    {"name": "from", "type": "address"},
                    {"name": "to", "type": "address"},
                    {"name": "value", "type": "uint256"},
                    {"name": "validAfter", "type": "uint256"},
                    {"name": "validBefore", "type": "uint256"},
                    {"name": "nonce", "type": "bytes32"},
                    {"name": "needApprove", "type": "bool"},
                ]
            },
            "primaryType": "tokenTransferWithAuthorization",
            "domain": {
                "name": "Facilitator",
                "version": "1",
                "chainId": int(get_chain_id(payment_requirements.network)),
                "verifyingContract": FACILITATOR_ADDRESS,
            },
            "message": {
                "token": payment_requirements.asset,
                "from": auth["from"],
                "to": auth["to"],
                "value": int(auth["value"]),
                "validAfter": int(auth["validAfter"]),
                "validBefore": int(auth["validBefore"]),
                "nonce": nonce_bytes,
                "needApprove": True,
            },
        }

        signed_message = account.sign_typed_data(
            domain_data=typed_data["domain"],
            message_types=typed_data["types"],
            message_data=typed_data["message"],
        )
        signature = signed_message.signature.hex()
        if not signature.startswith("0x"):
            signature = f"0x{signature}"

        header["payload"]["signature"] = signature

        header["payload"]["authorization"]["nonce"] = f"0x{auth['nonce']}"

        encoded = encode_payment(header)
        return encoded
    except Exception:
        raise



def encode_payment(payment_payload: Dict[str, Any]) -> str:
    """Encode a payment payload into a base64 string, handling HexBytes and other non-serializable types."""
    from hexbytes import HexBytes

    def default(obj):
        if isinstance(obj, HexBytes):
            return obj.hex()
        if hasattr(obj, "to_dict"):
            return obj.to_dict()
        if hasattr(obj, "hex"):
            return obj.hex()
        raise TypeError(
            f"Object of type {obj.__class__.__name__} is not JSON serializable"
        )

    return safe_base64_encode(json.dumps(payment_payload, default=default))


def decode_payment(encoded_payment: str) -> Dict[str, Any]:
    """Decode a base64 encoded payment string back into a PaymentPayload object."""
    return json.loads(safe_base64_decode(encoded_payment))
