import { z } from "zod";

// Define network types
export const EVMNetworkSchema = z.enum([
  "base", "avalanche", "iotex", "bsc", "polygon", "sei"
]);


// Combined network schema
export const NetworkSchema = EVMNetworkSchema;

export type EVMNetwork = z.infer<typeof EVMNetworkSchema>;
export type Network = z.infer<typeof NetworkSchema>;

// Network categorization
export const SupportedEVMNetworks: EVMNetwork[] = [
  "base",
  "avalanche",
  "iotex",
  "bsc",
  "polygon",
  "sei",
];


export const SupportedNetworks: Network[] = [
  ...SupportedEVMNetworks,
];

// EVM-specific mappings
export const EvmNetworkToChainId = new Map<EVMNetwork, number>([
  ["base", 8453],
  ["avalanche", 43114],
  ["iotex", 4689],
  ["bsc", 56],
  ["polygon", 137],
  ["sei", 1329],
]);

export const ChainIdToEvmNetwork = Object.fromEntries(
  SupportedEVMNetworks.map((network) => [
    EvmNetworkToChainId.get(network),
    network,
  ])
) as Record<number, EVMNetwork>;


// Utility functions for network type checking
export const isEVMNetwork = (network: Network): network is EVMNetwork => {
  return SupportedEVMNetworks.includes(network as EVMNetwork);
};


// Network metadata (optional - for display purposes)
export const NetworkMetadata = {
  // EVM Networks
  base: { name: "Base", type: "evm" },
  avalanche: { name: "Avalanche", type: "evm" },
  iotex: { name: "IoTeX", type: "evm" },
  bsc: { name: "BNB Smart Chain", type: "evm" },
  polygon: { name: "Polygon", type: "evm" },
  sei: { name: "Sei", type: "evm" },
} as const;

// Helper to get network type
export const getNetworkType = (_network: Network): "evm" => {
  return "evm";
};

// Check if a networkId/chainId corresponds to a supported EVM network
export const isSupportedEVMNetworkId = (
  networkId: number | string
): boolean => {
  const id =
    typeof networkId === "string" ? parseInt(networkId, 10) : networkId;
  return !isNaN(id) && ChainIdToEvmNetwork.hasOwnProperty(id);
};

// Get EVM network from networkId/chainId
export const getEVMNetworkById = (
  networkId: number | string
): EVMNetwork | undefined => {
  const id =
    typeof networkId === "string" ? parseInt(networkId, 10) : networkId;
  return !isNaN(id) ? ChainIdToEvmNetwork[id] : undefined;
};
