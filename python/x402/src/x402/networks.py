from typing import Literal


SupportedNetworks = Literal["base", "base-sepolia", "avalanche-fuji", "avalanche", "bsc", "xLayer", "kite"]

EVM_NETWORK_TO_CHAIN_ID = {
    "base-sepolia": 84532,
    "base": 8453,
    "avalanche-fuji": 43113,
    "avalanche": 43114,
    "xLayer": 196,
    "bsc": 56,
    "kite": 2366,
}
