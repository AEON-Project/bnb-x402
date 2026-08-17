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

// 创建 facilitator client，如果提供了 API Key，则配置认证头
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
            // AEON Chain 的 USDTEST。该代币没有 transferWithAuthorization，客户端会自动
            // 落到 needApprove 路径：签名 domain 用的是 Facilitator 合约
            // (0x555e3311…, name="Facilitator" version="1")，这里的 extra 只是必填校验。
            price: {
              asset: "0x27F5D486751721591537b6675247df11A17b0889",
              amount: "1000000000000000", // 0.001 USDTEST (18 decimals)
              extra: { name: "USDTEST", version: "1" },
            },
            network: "eip155:10025",
            payTo: evmAddress,
          },
          {
            scheme: "exact",
            // Arbitrum One 原生 USDC，链上读到的 EIP-712 domain 是 name="USD Coin" version="2"
            price: {
              asset: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              amount: "1000", // 0.001 USDC (6 decimals)
              extra: { name: "USD Coin", version: "2" },
            },
            network: "eip155:42161",
            payTo: evmAddress,
          },
          // {
          //   scheme: "exact",
          //   price: "$0.001",
          //   network: "eip155:196",
          //   payTo: evmAddress,
          // },
          // {
          //   scheme: "exact",
          //   price: "$0.001",
          //   network: "eip155:56",
          //   payTo: evmAddress,
          // },
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:2366",
            payTo: evmAddress,
          },
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:97",
            payTo: evmAddress,
          },
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:8453",
            payTo: evmAddress,
          },
        ],
        description: "Weather data",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(facilitatorClient)
      .register("eip155:196", new ExactEvmScheme())
        .register("eip155:56", new ExactEvmScheme())
        .register("eip155:8453", new ExactEvmScheme())
        .register("eip155:2366", new ExactEvmScheme())
        .register("eip155:97", new ExactEvmScheme())
        .register("eip155:42161", new ExactEvmScheme())
        .register("eip155:10025", new ExactEvmScheme())
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
