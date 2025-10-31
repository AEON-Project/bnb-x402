import type { Context } from "hono";
import { Address, getAddress } from "viem";
import { utils as evmUtils } from "@aeon-ai-pay/x402/schemes/exact/evm";
import {
  computeRoutePatterns,
  findMatchingPaymentRequirements,
  findMatchingRoute,
  paywallHtml,
  toJsonSafe,
} from "@aeon-ai-pay/x402/shared";
import {
  FacilitatorConfig,
  EvmPaymentPayload,
  Resource,
  settleResponseHeader,
  RoutesConfig,
} from "@aeon-ai-pay/x402/types";
import { useFacilitator } from "@aeon-ai-pay/x402/verify";
import { VerifyResponse, SettleResponse } from "@aeon-ai-pay/x402/types";

/**
 * Creates a payment middleware factory for Hono
 *
 * @param routes - Configuration for protected routes and their payment requirements
 * @param facilitator - Optional configuration for the payment facilitator service
 * @returns A Hono middleware handler
 *
 * @example
 * ```typescript
 * // Simple configuration - All endpoints protected by $0.01 USDT on BSC
 * app.use(paymentMiddleware(
 *   {
 *     '*': '$0.01' // All routes protected by $0.01 USDT on BSC
 *   }
 * ));
 *
 * // Advanced configuration - Multiple payment options per route
 * app.use(paymentMiddleware(
 *   {
 *     '/weather/*': '$0.001', // Simple price for weather endpoints
 *     '/premium/*': {
 *       paymentRequirements: [
 *         {
 *           scheme: "exact",
 *           namespace: "evm",
 *           tokenAddress: "0x55d398326f99059ff775485246999027b3197955", // USDT on BSC
 *           amountRequired: 0.01,
 *           amountRequiredFormat: "humanReadable",
 *           networkId: "56",
 *           payToAddress: "0x123...",
 *           description: "Premium API access with USDT on BSC"
 *         },
 *       ]
 *     }
 *   }
 * ));
 * ```
 */
export function paymentMiddleware(routes: RoutesConfig, facilitator?: FacilitatorConfig) {
  const { verify, settle } = useFacilitator(facilitator);
  const x402Version = 1;

  // Pre-compile route patterns to regex and extract verbs
  const routePatterns = computeRoutePatterns(routes);

  return async function paymentMiddleware(c: Context, next: () => Promise<void>) {
    const matchingRoute = findMatchingRoute(routePatterns, c.req.path, c.req.method.toUpperCase());
    if (!matchingRoute) {
      return next();
    }

    // Get payment requirements from the route config
    const paymentRequirements = matchingRoute.config.paymentRequirements;
    if (!paymentRequirements || paymentRequirements.length === 0) {
      return next();
    }

    // Use the first payment requirement as the primary one
    const primaryRequirement = paymentRequirements[0];
    const resourceUrl: Resource = (primaryRequirement.resource || c.req.url) as Resource;

    // Update the resource URL in all payment requirements and validate addresses
    const updatedPaymentRequirements = paymentRequirements.map(requirement => {
      let validatedPayToAddress: string;

      if (requirement.namespace === "evm") {
        // Use viem's getAddress for EVM address validation and checksumming
        validatedPayToAddress = getAddress(requirement.payToAddress);
      } else {
        throw new Error(`Unsupported namespace: ${requirement.namespace}`);
      }

      return {
        ...requirement,
        resource: resourceUrl,
        payToAddress: validatedPayToAddress,
      };
    });

    // Determine namespace from payment header if available, otherwise use primary requirement
    let detectedNamespace = primaryRequirement.namespace;
    const payment = c.req.header("X-PAYMENT");

    // If payment is provided, try to detect namespace from the payment structure
    if (payment) {
      try {
        // Try to decode as base64 and check the structure
        const decoded = JSON.parse(atob(payment));
        if (decoded.namespace) {
          detectedNamespace = decoded.namespace;
        }
      } catch {
        // If decoding fails, fall back to primary requirement namespace
      }
    }

    const namespace = detectedNamespace;

    const userAgent = c.req.header("User-Agent") || "";
    const acceptHeader = c.req.header("Accept") || "";
    const isWebBrowser = acceptHeader.includes("text/html") && userAgent.includes("Mozilla");

    if (!payment) {
      if (isWebBrowser) {
        // Calculate display amount from the payment requirements
        let displayAmount: number;
        if (primaryRequirement.amountRequiredFormat === "humanReadable") {
          displayAmount = Number(primaryRequirement.amountRequired);
        } else {
          // Convert from atomic units to human readable
          const decimals = primaryRequirement.tokenDecimals || 6; // Default to USDC decimals
          displayAmount = Number(primaryRequirement.amountRequired) / 10 ** decimals;
        }

        // Inject the payment requirements data
        const injectScript = `<script>window.x402 = { paymentRequirements: ${JSON.stringify(updatedPaymentRequirements)} }</script>`;

        // Insert the script right before the closing </head> tag
        const html = paywallHtml.replace("</head>", `${injectScript}</head>`);
        return c.html(html, 402);
      }
      return c.json(
        {
          error: "X-PAYMENT header is required",
          accepts: updatedPaymentRequirements,
          x402Version,
        },
        402,
      );
    }

    // Verify payment
    let decodedPayment: EvmPaymentPayload;
    try {
      if (namespace === "evm") {
        decodedPayment = evmUtils.decodePaymentPayload(payment);
      } else {
        throw new Error(`Unsupported namespace: ${namespace}`);
      }
      decodedPayment.x402Version = x402Version;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Invalid or malformed payment header";
      console.error(
        `[x402-hono] Payment decoding failed for namespace ${namespace}:`,
        errorMessage,
      );

      return c.json(
        {
          error: errorMessage,
          accepts: updatedPaymentRequirements,
          x402Version,
        },
        402,
      );
    }

    console.log("paymentMiddleware decodedPayment:", JSON.stringify(toJsonSafe(decodedPayment), null, 2));
    if (decodedPayment.payload?.authorization) {
      console.log("paymentMiddleware authorization details:", {
        from: decodedPayment.payload.authorization.from,
        to: decodedPayment.payload.authorization.to,
        value: decodedPayment.payload.authorization.value,
        valueAsNumber: Number(decodedPayment.payload.authorization.value),
        valueAsString: String(decodedPayment.payload.authorization.value)
      });
    }
    console.log("paymentMiddleware available requirements:", updatedPaymentRequirements.map(req => ({
      scheme: req.scheme,
      networkId: req.networkId,
      tokenAddress: req.tokenAddress,
      tokenSymbol: req.tokenSymbol,
      amountRequired: req.amountRequired,
      payToAddress: req.payToAddress
    })));

    const selectedPaymentRequirements = findMatchingPaymentRequirements(
      updatedPaymentRequirements,
      decodedPayment,
    );

    console.log("paymentMiddleware selectedPaymentRequirements", selectedPaymentRequirements);

    if (!selectedPaymentRequirements) {
      console.error(`[x402-hono] No matching payment requirements found for:`, {
        scheme: decodedPayment.scheme,
        namespace: decodedPayment.namespace,
        networkId: decodedPayment.networkId,
        availableRequirements: updatedPaymentRequirements.map(req => ({
          scheme: req.scheme,
          namespace: req.namespace,
          networkId: req.networkId,
        })),
      });

      return c.json(
        {
          error: "Unable to find matching payment requirements",
          accepts: toJsonSafe(updatedPaymentRequirements),
          x402Version,
        },
        402,
      );
    }

    const verification: VerifyResponse = await verify(payment, selectedPaymentRequirements);

    console.log("paymentMiddleware verification", verification);

    if (!verification.isValid) {
      return c.json(
        {
          error: new Error(verification.invalidReason),
          accepts: updatedPaymentRequirements,
          payer: verification.payer,
          x402Version,
        },
        402,
      );
    }

    // Proceed with request
    await next();

    let res = c.res;

    // If the response from the protected route is >= 400, do not settle payment
    if (res.status >= 400) {
      return;
    }

    // For signAndSendTransaction payments (type: "transaction"), the payment is already executed
    // Skip settlement and proceed with the response
    if (verification.type === "transaction") {
      console.log(
        "paymentMiddleware: Payment already executed (signAndSendTransaction), skipping settlement",
      );
      return;
    }

    c.res = undefined;

    // For authorization and signedTransaction payments (type: "payload"), settlement is required
    // Settle payment before processing the request, as Hono middleware does not allow us to set headers after the response has been sent
    try {
      console.log(
        "paymentMiddleware attempting settlement with:",
        JSON.stringify({ payment, selectedPaymentRequirements }, null, 2),
      );
      const settlement: SettleResponse = await settle(payment, selectedPaymentRequirements);
      console.log("paymentMiddleware settlement", settlement);

      if (settlement.success) {
        const responseHeader = settleResponseHeader(settlement);
        res.headers.set("X-PAYMENT-RESPONSE", responseHeader);
      } else {
        console.log("paymentMiddleware settlement failed, settlement:", settlement);
        throw new Error(settlement.error || "Settlement failed with undefined data");
      }
    } catch (error) {
      console.log("paymentMiddleware settlement error:", error);
      res = c.json(
        {
          error: error instanceof Error ? error : new Error("Failed to settle payment"),
          accepts: updatedPaymentRequirements,
          x402Version,
        },
        402,
      );
    }

    c.res = res;
  };
}

export type {
  Money,
  Network,
  MiddlewareConfig,
  Resource,
  RouteConfig,
} from "@aeon-ai-pay/x402/types";
export { createRouteConfigFromPrice } from "@aeon-ai-pay/x402/shared";
