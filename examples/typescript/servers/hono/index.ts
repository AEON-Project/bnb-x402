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
            network: "eip155:8453",
            payTo: evmAddress,
          }
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
