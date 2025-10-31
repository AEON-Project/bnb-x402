import { base, bsc, polygon, sei, type Chain } from "viem/chains";
import {
  type WalletClient,
  type PublicActions,
  type Address,
  publicActions,
} from "viem";
import { type Config, type ConnectReturnType, type CreateConnectorFn } from "@wagmi/core";
import { getWalletClient } from "@wagmi/core";
import { connect } from "wagmi/actions";

type WalletClientWithActions = WalletClient & PublicActions;

interface ChainSwitchParams {
  initialClient: WalletClientWithActions;
  targetChain: Chain;
  networkName: string;
  config: Config;
  account: Address;
  connector: CreateConnectorFn;
  result: ConnectReturnType<Config>;
}

type ChainSwitchResult = ConnectReturnType<Config>;
export async function switchChainViaClient(
  client: WalletClientWithActions,
  targetChain: Chain
): Promise<void> {
  await client.switchChain({ id: targetChain.id });
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

export async function addAndSwitchChain(targetChain: Chain): Promise<void> {
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: `0x${targetChain.id.toString(16)}`,
        chainName: targetChain.name,
        nativeCurrency: targetChain.nativeCurrency,
        rpcUrls: targetChain.rpcUrls.default.http,
        blockExplorerUrls: targetChain.blockExplorers?.default
          ? [targetChain.blockExplorers.default.url]
          : [],
      },
    ],
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: `0x${targetChain.id.toString(16)}` }],
  });

  await new Promise((resolve) => setTimeout(resolve, 1500));
}

export async function verifyChainSwitch(
  client: WalletClientWithActions,
  targetChain: Chain
): Promise<boolean> {
  const currentChainId = await client.getChainId();
  return currentChainId === targetChain.id;
}

export async function handleChainSwitch({
  initialClient,
  targetChain,
  networkName,
  config,
  account,
  connector,
  result,
}: ChainSwitchParams): Promise<ChainSwitchResult> {
  const currentChainId = await initialClient.getChainId();

  if (currentChainId === targetChain.id) {
    return result;
  }

  try {
    await switchChainViaClient(initialClient, targetChain);

    const baseClient = await getWalletClient(config, {
      account,
      chainId: targetChain.id,
    });

    const updatedClient = baseClient?.extend(
      publicActions
    ) as unknown as WalletClientWithActions;

    if (
      updatedClient &&
      (await verifyChainSwitch(updatedClient, targetChain))
    ) {
      return { ...result, chainId: targetChain.id };
    }

    throw new Error("Chain switch verification failed");
  } catch (switchError) {
    try {
      await addAndSwitchChain(targetChain);

      const baseClient = await getWalletClient(config, {
        account,
        chainId: targetChain.id,
      });

      const updatedClient = baseClient?.extend(
        publicActions
      ) as unknown as WalletClientWithActions;

      if (
        updatedClient &&
        (await verifyChainSwitch(updatedClient, targetChain))
      ) {
        return { ...result, chainId: targetChain.id };
      }

      return await connect(config, {
        connector,
        chainId: targetChain.id,
      });
    } catch (directSwitchError) {
      console.error("Direct chain switch failed:", directSwitchError);

      if (
        directSwitchError &&
        typeof directSwitchError === "object" &&
        "code" in directSwitchError &&
        directSwitchError.code === 4001
      ) {
        throw new Error(
          `You need to approve the network switch to ${networkName} in your wallet to continue.`
        );
      }

      throw new Error(
        `Unable to automatically switch to ${networkName}. Please manually switch to ${networkName} in your wallet and try again.`
      );
    }
  }
}

interface ChainConfig {
  targetChain: Chain;
  networkName: string;
}

export function getChainConfig(networkId: string): ChainConfig {
  switch (networkId) {
    case "base":
      return { targetChain: base, networkName: "Base" };
    case "polygon":
      return { targetChain: polygon, networkName: "Polygon" };
    case "sei":
      return { targetChain: sei, networkName: "Sei" };
    default:
      return { targetChain: bsc, networkName: "Binance Smart Chain (BSC)" };
  }
}

