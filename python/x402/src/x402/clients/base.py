import time
import os
from typing import Optional, Callable, Dict, Any, List
from eth_account import Account
from x402.exact import sign_payment_header, sign_payment_header_No_Supper
from x402.types import (
    PaymentRequirements,
    UnsupportedSchemeException,
)
from x402.common import x402_VERSION
import secrets
from x402.encoding import safe_base64_decode
import json
from web3 import Web3
try:
    # web3.py < 7
    from web3.middleware import geth_poa_middleware as poa_middleware
except ImportError:  # pragma: no cover
    # web3.py >= 7
    from web3.middleware import ExtraDataToPOAMiddleware as poa_middleware

# Minimal ABI for ERC-3009 `transferWithAuthorization` probing (aligned with TS contractUtils.ts)
TRANSFER_WITH_AUTHORIZATION_ABI = [
    {
        "name": "transferWithAuthorization",
        "type": "function",
        "inputs": [
            {"internalType": "address", "name": "from", "type": "address"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "value", "type": "uint256"},
            {"internalType": "uint256", "name": "validAfter", "type": "uint256"},
            {"internalType": "uint256", "name": "validBefore", "type": "uint256"},
            {"internalType": "bytes32", "name": "nonce", "type": "bytes32"},
            {"internalType": "bytes", "name": "signature", "type": "bytes"},
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
    }
]

# Define type for the payment requirements selector
PaymentSelectorCallable = Callable[
    [List[PaymentRequirements], Optional[str], Optional[str], Optional[int]],
    PaymentRequirements,
]


def decode_x_payment_response(header: str) -> Dict[str, Any]:
    """Decode the X-PAYMENT-RESPONSE header.

    Args:
        header: The X-PAYMENT-RESPONSE header to decode

    Returns:
        The decoded payment response containing:
        - success: bool
        - transaction: str (hex)
        - network: str
        - payer: str (address)
    """
    decoded = safe_base64_decode(header)
    result = json.loads(decoded)
    return result


class PaymentError(Exception):
    """Base class for payment-related errors."""

    pass


class PaymentAmountExceededError(PaymentError):
    """Raised when payment amount exceeds maximum allowed value."""

    pass


class MissingRequestConfigError(PaymentError):
    """Raised when request configuration is missing."""

    pass


class PaymentAlreadyAttemptedError(PaymentError):
    """Raised when payment has already been attempted."""

    pass


class x402Client:
    """Base client for handling x402 payments."""

    def __init__(
            self,
            account: Account,
            max_value: Optional[int] = None,
            payment_requirements_selector: Optional[PaymentSelectorCallable] = None,
    ):
        """Initialize the x402 client.

        Args:
            account: eth_account.Account instance for signing payments
            max_value: Optional maximum allowed payment amount in base units
            payment_requirements_selector: Optional custom selector for payment requirements
        """
        self.account = account
        self.max_value = max_value
        self._payment_requirements_selector = (
                payment_requirements_selector or self.default_payment_requirements_selector
        )

    @staticmethod
    def default_payment_requirements_selector(
            accepts: List[PaymentRequirements],
            network_filter: Optional[str] = None,
            scheme_filter: Optional[str] = None,
            max_value: Optional[int] = None,
    ) -> PaymentRequirements:
        """Select payment requirements from the list of accepted requirements.

        Args:
            accepts: List of accepted payment requirements
            network_filter: Optional network to filter by
            scheme_filter: Optional scheme to filter by
            max_value: Optional maximum allowed payment amount

        Returns:
            Selected payment requirements (PaymentRequirements instance from x402.types)

        Raises:
            UnsupportedSchemeException: If no supported scheme is found
            PaymentAmountExceededError: If payment amount exceeds max_value
        """
        for paymentRequirements in accepts:
            scheme = paymentRequirements.scheme
            network = paymentRequirements.network

            # Check scheme filter
            if scheme_filter and scheme != scheme_filter:
                continue

            # Check network filter
            if network_filter and network != network_filter:
                continue

            if scheme == "exact":
                # Check max value if set
                if max_value is not None:
                    max_amount = int(paymentRequirements.max_amount_required)
                    if max_amount > max_value:
                        raise PaymentAmountExceededError(
                            f"Payment amount {max_amount} exceeds maximum allowed value {max_value}"
                        )

                return paymentRequirements

        raise UnsupportedSchemeException("No supported payment scheme found")

    def select_payment_requirements(
            self,
            accepts: List[PaymentRequirements],
            network_filter: Optional[str] = None,
            scheme_filter: Optional[str] = None,
    ) -> PaymentRequirements:
        """Select payment requirements using the configured selector.

        Args:
            accepts: List of accepted payment requirements (PaymentRequirements models)
            network_filter: Optional network to filter by
            scheme_filter: Optional scheme to filter by

        Returns:
            Selected payment requirements (PaymentRequirements instance from x402.types)

        Raises:
            UnsupportedSchemeException: If no supported scheme is found
            PaymentAmountExceededError: If payment amount exceeds max_value
        """
        return self._payment_requirements_selector(
            accepts, network_filter, scheme_filter, self.max_value
        )

    @staticmethod
    def _looks_like_function_missing_error(error_message: str) -> bool:
        msg = error_message.lower()
        return (
                "function does not exist" in msg
                or "method not found" in msg
                or "unknown method" in msg
                or "function selector not found" in msg
                or "no matching function" in msg
                or "invalid function selector" in msg
                or "function not found" in msg
                or ("contract function" in msg and "not found" in msg)
        )

    @staticmethod
    def _looks_like_expected_business_logic_error(error_message: str) -> bool:
        # If we hit these, the function likely exists; our dummy args are just invalid.
        msg = error_message.lower()
        return (
                "authorization is expired" in msg
                or "invalid signature" in msg
                or "authorization is used" in msg
                or "authorization is not yet valid" in msg
                or "invalid authorization" in msg
                or "invalid signature length" in msg
        )

    @staticmethod
    def get_rpc_url_for_network(network: str) -> Optional[str]:
        """
        Resolve an EVM RPC URL for a network.

        Supports a mapping list (recommended for multi-network setups):
        - env X402_RPC_URLS, format: "base=https://...,bsc=https://...,xlayer=https://..."

        Falls back to:
        - env X402_RPC_URL_<NETWORK> (e.g. X402_RPC_URL_BASE_SEPOLIA)
        - env X402_RPC_URL
        """
        # 1) Mapping list env (easy to extend as new networks are added)
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
                # Ignore malformed mapping and continue with other resolution strategies
                pass

        # 2) Per-network env
        network_key = str(network).upper().replace("-", "_")
        by_network = os.getenv(f"X402_RPC_URL_{network_key}")
        if by_network and by_network.strip():
            return by_network.strip()

        # 3) Global env
        global_rpc = os.getenv("X402_RPC_URL")
        if global_rpc and global_rpc.strip():
            return global_rpc.strip()

        return None

    @classmethod
    def verify_token_supports_eip3009(
            cls,
            payment_requirements: PaymentRequirements,
            *,
            rpc_url: Optional[str] = None,
    ) -> bool:
        """
        Verify whether `payment_requirements.asset` supports ERC-3009 `transferWithAuthorization`.

        This mirrors the TS `contractUtils.ts` behavior:
        - If the call succeeds => True (function exists)
        - Known "function missing" errors => False
        - Known business-logic reverts (invalid signature, etc.) => True
        - Generic "execution reverted" with no reason => conservative False
        - Otherwise conservative False

        Note: requires an RPC URL. If not provided, it is resolved from env based on `payment_requirements.network`.
        """
        rpc = rpc_url or cls.get_rpc_url_for_network(str(payment_requirements.network))
        if not rpc:
            raise ValueError(
                "Missing RPC URL for EIP-3009 check. "
                "Set env X402_RPC_URL or X402_RPC_URL_<NETWORK>, or pass rpc_url=..."
            )

        web3 = Web3(Web3.HTTPProvider(rpc))
        # Support POA chains (e.g. BSC) where block.extraData is longer than 32 bytes
        web3.middleware_onion.inject(poa_middleware, layer=0)
        try:
            contract = web3.eth.contract(
                address=Web3.to_checksum_address(payment_requirements.asset),
                abi=TRANSFER_WITH_AUTHORIZATION_ABI,
            )
            contract.functions.transferWithAuthorization(
                "0x0000000000000000000000000000000000000000",  # from
                "0x0000000000000000000000000000000000000000",  # to
                0,  # value
                0,  # validAfter
                0,  # validBefore
                b"\x00" * 32,  # nonce
                b"",  # signature
            ).call()
            return True
        except Exception as e:
            msg = str(e)
            if cls._looks_like_function_missing_error(msg):
                return False
            if cls._looks_like_expected_business_logic_error(msg):
                return True

            lower = msg.lower()
            if "execution reverted: 0x" in lower or (
                    "execution reverted" in lower and ":" not in lower
            ):
                return False
            return False

    def create_payment_header(
            self,
            payment_requirements: PaymentRequirements,
            x402_version: int = x402_VERSION,
    ) -> str:
        """Create a payment header for the given requirements.

        Args:
            payment_requirements: Selected payment requirements
            x402_version: x402 protocol version

        Returns:
            Signed payment header
        """
        unsigned_header = {
            "x402Version": x402_version,
            "scheme": payment_requirements.scheme,
            "network": payment_requirements.network,
            "payload": {
                "signature": None,
                "authorization": {
                    "from": self.account.address,
                    "to": payment_requirements.pay_to,
                    "value": payment_requirements.max_amount_required,
                    "validAfter": str(int(time.time()) - 60),  # 60 seconds before
                    "validBefore": str(
                        int(time.time()) + payment_requirements.max_timeout_seconds
                    ),
                    "nonce": self.generate_nonce(),
                },
            },
        }

        supported = self.verify_token_supports_eip3009(payment_requirements)
        print(f"verify_token_supports_eip3009: {supported}")
        if not supported:
            signed_header = sign_payment_header_No_Supper(
                self.account,
                payment_requirements,
                unsigned_header,
            )
        else:
            signed_header = sign_payment_header(
                self.account,
                payment_requirements,
                unsigned_header,
            )
        return signed_header

    def generate_nonce(self):
        # Generate a random nonce (32 bytes = 64 hex chars)
        nonce = secrets.token_hex(32)
        return nonce
