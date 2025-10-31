import {WalletClient, PublicActions, Hex, encodeFunctionData} from "viem";
import {
    signAuthorizationEip3009,
    signAuthorization,
    utils,
} from "./index.js";
import {evm} from "../../../shared/index.js";
import {
    PaymentRequirements,
    EvmPaymentPayload,
} from "../../../types/index.js";
import {verifyTransferWithAuthorizationSupport} from "./utils/contractUtils";

const TRANSFER_WITH_AUTHORIZATION_ABI = [
    {
        type: "function",
        name: "transferWithAuthorization",
        inputs: [...evm.authorizationTypes.TransferWithAuthorization],
        outputs: [],
        stateMutability: "nonpayable",
    },
] as const;


async function _createPayment(
    client: WalletClient & PublicActions,
    x402Version: number,
    paymentRequirements: PaymentRequirements
): Promise<EvmPaymentPayload> {
    if (!client?.account?.address) {
        throw new Error("Client account is required");
    }

    const from = client.account.address as Hex;
    const to = paymentRequirements.payToAddress as Hex;
    const value = paymentRequirements.amountRequired as bigint;

    const basePayment = {
        x402Version: x402Version,
        scheme: paymentRequirements.scheme!,
        namespace: paymentRequirements.namespace!,
        networkId: paymentRequirements.networkId,
        resource: paymentRequirements.resource!,
    };

    // Verify whether the token contract has a TransferWithAuthorization function
    const supportsTransferWithAuthorization = paymentRequirements.tokenAddress && paymentRequirements.tokenAddress !== evm.ZERO_ADDRESS
        ? await verifyTransferWithAuthorizationSupport(client, paymentRequirements.tokenAddress)
        : false;
    console.log("[log] tokenAddress:", paymentRequirements.tokenAddress);
    console.log("[log] supportsTransferWithAuthorization:", supportsTransferWithAuthorization);
    let authorizationResult;
    let typeResult: "authorization" | "authorizationEip3009";
    if (supportsTransferWithAuthorization) {
        typeResult = "authorizationEip3009";
        authorizationResult = await signAuthorizationEip3009(
            client,
            {from, to, value},
            paymentRequirements
        );
    } else {
        typeResult = "authorization";
        authorizationResult = await signAuthorization(
            client,
            {from, to, value},
            paymentRequirements
        );
    }

    return {
        ...basePayment,
        payload: {
            type: typeResult,
            signature: authorizationResult.signature,
            authorization: {
                from,
                to,
                value,
                validAfter: authorizationResult.validAfter,
                validBefore: authorizationResult.validBefore,
                nonce: authorizationResult.nonce,
                version: authorizationResult.version,
            },
        },
    };
}

async function createPayment(
    client: WalletClient & PublicActions,
    x402Version: number,
    paymentRequirements: PaymentRequirements
): Promise<string> {
    // Set defaults
    let paymentRequirementsWithDefaults = paymentRequirements;
    if (!paymentRequirements.resource) {
        paymentRequirementsWithDefaults.resource = `402 signature ${Date.now()}`;
    }
    if (!paymentRequirements.scheme) {
        paymentRequirementsWithDefaults.scheme = `exact`;
    }
    const payment = await _createPayment(
        client,
        x402Version,
        paymentRequirementsWithDefaults
    );
    return utils.encodePaymentPayload(payment);
}

export {createPayment};
