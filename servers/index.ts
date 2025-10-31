import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { paymentMiddleware, Resource, createRouteConfigFromPrice, Network } from "@aeon-ai-pay/x402-hono";

config();

const facilitatorUrl = process.env.FACILITATOR_URL as Resource;  // https://facilitator.aeon.xyz
const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;
const network = process.env.NETWORK as Network;

if (!facilitatorUrl || !evmAddress || !network) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const app = new Hono();

console.log("Server is running");

app.use(
  paymentMiddleware(
    {
      // Multiple payment options for /weather route
      // "/weather": createRouteConfigFromPrice("$0.001", network, evmAddress),
      "/weather": {
        paymentRequirements: [
          {
            scheme: "exact",
            namespace: "evm",
            tokenAddress: "0x55d398326f99059ff775485246999027b3197955", // USDT on BSC
            amountRequired: 0.001,
            amountRequiredFormat: "humanReadable",
            networkId: "56",
            payToAddress: evmAddress,
            description: "Weather data access with USDT",
            tokenDecimals: 18,
            tokenSymbol: "USDT",
          },
          {
            scheme: "exact",
            namespace: "evm",
            tokenAddress: "0x6e3BCf81d331fa7Bd79Ac2642486c70BEAE2600E", // TESTU on BSC
            amountRequired: 0.01,
            amountRequiredFormat: "humanReadable",
            networkId: "56",
            payToAddress: evmAddress,
            description: "Weather data access with TESTU",
            tokenDecimals: 18,
            tokenSymbol: "TESTU",
          },
        ],
      },
      "/premium/*": {
        paymentRequirements: [
          {
            scheme: "exact",
            namespace: "evm",
            tokenAddress: "0x6e3BCf81d331fa7Bd79Ac2642486c70BEAE2600E",
            amountRequired: 0.01,
            amountRequiredFormat: "humanReadable",
            networkId: "56",
            payToAddress: evmAddress,
            description: "Premium content access with TESTU",
            tokenDecimals: 18,
            tokenSymbol: "TESTU",
          },
        ],
      },
    },
    {
      url: facilitatorUrl,  // https://facilitator.aeon.xyz
    },
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

app.get("/premium/content", c => {
  return c.json({
    content: "This is premium content accessible via multiple payment methods",
    supportedPayments: ["USDT on BSC"],
  });
});

serve({
  fetch: app.fetch,
  port: 4021,
});
