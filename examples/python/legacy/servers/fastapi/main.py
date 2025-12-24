import os
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from x402.fastapi.middleware import require_payment
from x402.types import EIP712Domain, TokenAmount, TokenAsset

# Load environment variables
load_dotenv()

# Get configuration from environment
ADDRESS = os.getenv("ADDRESS")

if not ADDRESS:
    raise ValueError("Missing required environment variables")

app = FastAPI()

# Apply payment middleware to specific routes
app.middleware("http")(
    require_payment(
        path="/weather",
        pay_to_address=ADDRESS,
        facilitator_config={"url": "https://facilitator-test.aeon.xyz"},
        # price=TokenAmount(
        #     amount="1000",
        #     asset=TokenAsset(
        #         address="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        #         decimals=6,
        #         eip712=EIP712Domain(name="USD Coin", version="2"),
        #     ),
        # ),
        # price=TokenAmount(
        #     amount="1000",
        #     asset=TokenAsset(
        #         address="0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
        #         decimals=6,
        #         eip712=EIP712Domain(name="USDT", version="1"),
        #     ),
        # ),
        # network="base",
        # price=TokenAmount(
        #     amount="1000",
        #     asset=TokenAsset(
        #         address="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        #         decimals=6,
        #         eip712=EIP712Domain(name="USD Coin", version="2"),
        #     ),
        # ),
        # price=TokenAmount(
        #     amount="1000",
        #     asset=TokenAsset(
        #         address="0x55d398326f99059fF775485246999027B3197955",
        #         decimals=18,
        #         eip712=EIP712Domain(name="USDT", version="1"),
        #     ),
        # ),
        # network="bsc",
        price=TokenAmount(
            amount="1000",
            # asset=TokenAsset(
            #     address="0x74b7f16337b8972027f6196a17a631ac6de26d22",
            #     decimals=6,
            #     eip712=EIP712Domain(name="USD Coin", version="2"),
            # ),
            asset=TokenAsset(
                address="0x779ded0c9e1022225f8e0630b35a9b54be713736",
                decimals=6,
                eip712=EIP712Domain(name="USDT", version="1"),
            ),
        ),
        network="xLayer",
    )
)

# Apply payment middleware to premium routes
app.middleware("http")(
    require_payment(
        path="/premium/*",
        price=TokenAmount(
            amount="10000",
            asset=TokenAsset(
                address="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                decimals=6,
                eip712=EIP712Domain(name="USDC", version="2"),
            ),
        ),
        pay_to_address=ADDRESS,
        network="base-sepolia",
    )
)


@app.get("/weather")
async def get_weather() -> Dict[str, Any]:
    return {
        "report": {
            "weather": "sunny",
            "temperature": 70,
        }
    }


@app.get("/premium/content")
async def get_premium_content() -> Dict[str, Any]:
    return {
        "content": "This is premium content",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=4021)
