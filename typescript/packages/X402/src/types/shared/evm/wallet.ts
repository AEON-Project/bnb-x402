import {
  createPublicClient,
  createWalletClient,
  http,
  publicActions,
} from "viem";
import type {
  Chain,
  Transport,
  Client,
  Account,
  RpcSchema,
  PublicActions,
  WalletActions,
  PublicClient,
  LocalAccount,
} from "viem";
import {base, avalanche, baseSepolia, avalancheFuji, iotex, bsc, polygon, sei} from "viem/chains";
import {privateKeyToAccount} from "viem/accounts";
import {type Hex} from "viem";
import {EvmNetworkToChainId} from "../network.js";

// X Layer chain definition
const xlayer: Chain = {
  id: 196,
  name: 'X Layer',
  nativeCurrency: {
    decimals: 18,
    name: 'OKB',
    symbol: 'OKB',
  },
  rpcUrls: {
    default: {
      http: ['https://xlayerrpc.okx.com'],
    },
    public: {
      http: ['https://xlayerrpc.okx.com'],
    },
  },
  blockExplorers: {
    default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer' },
  },
  testnet: false,
};

// Create a public client for reading data
export type SignerWallet<
    chain extends Chain = Chain,
    transport extends Transport = Transport,
    account extends Account = Account
> = Client<
    transport,
    chain,
    account,
    RpcSchema,
    PublicActions<transport, chain, account> & WalletActions<chain, account>
>;

export type ConnectedClient<
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain,
    account extends Account | undefined = undefined
> = PublicClient<transport, chain, account>;

/**
 * Creates a public client based on the provided network ID
 *
 * @param networkId - The network ID to create a client for
 * @returns A public client instance for the specified network
 * @throws Error if the network ID is not supported
 */
export function getPublicClient(
    networkId: string
): ConnectedClient<Transport, any, undefined> {
  switch (networkId) {
    case EvmNetworkToChainId.get("base")?.toString():
      return createClientBase();
    case EvmNetworkToChainId.get("avalanche")?.toString():
      return createClientAvalanche();
    case EvmNetworkToChainId.get("iotex")?.toString():
      return createClientIotex();
    case EvmNetworkToChainId.get("bsc")?.toString():
      return createClientBsc();
    case EvmNetworkToChainId.get("polygon")?.toString():
      return createClientPolygon();
    case EvmNetworkToChainId.get("sei")?.toString():
      return createClientSei();
    case EvmNetworkToChainId.get("xlayer")?.toString():
      return createClientXLayer();
    default:
      throw new Error(`Unsupported network ID: ${networkId}`);
  }
}


/**
 * Creates a public client configured for the Base
 *
 * @returns A public client instance connected to Base
 */
export function createClientBase(): ConnectedClient<
    Transport,
    typeof base,
    undefined
> {
  return createPublicClient({
    chain: base,
    transport: http("https://base.drpc.org"),
  }).extend(publicActions);
}

/**
 * Creates a public client configured for the Base Sepolia testnet
 *
 * @returns A public client instance connected to Base Sepolia
 */
export function createClientSepolia(): ConnectedClient<
    Transport,
    typeof baseSepolia,
    undefined
> {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(),
  }).extend(publicActions);
}

/**
 * Creates a public client configured for the Avalanche
 *
 * @returns A public client instance connected to Avalanche
 */
export function createClientAvalanche(): ConnectedClient<
    Transport,
    typeof avalanche,
    undefined
> {
  return createPublicClient({
    chain: avalanche,
    transport: http(),
  }).extend(publicActions);
}

/**
 * Creates a public client configured for the Avalanche Fuji testnet
 *
 * @returns A public client instance connected to Avalanche Fuji
 */
export function createClientAvalancheFuji(): ConnectedClient<
    Transport,
    typeof avalancheFuji,
    undefined
> {
  return createPublicClient({
    chain: avalancheFuji,
    transport: http(),
  }).extend(publicActions);
}

/**
 * Creates a public client configured for the Iotex
 *
 * @returns A public client instance connected to Iotex
 */
export function createClientIotex(): ConnectedClient<
    Transport,
    typeof iotex,
    undefined
> {
  return createPublicClient({
    chain: iotex,
    transport: http(),
  }).extend(publicActions);
}

/**
 * Creates a public client configured for the BSC mainnet
 *
 * @returns A public client instance connected to BSC
 */
export function createClientBsc(): ConnectedClient<
    Transport,
    typeof bsc,
    undefined
> {
  return createPublicClient({
    chain: bsc,
    transport: http("https://few-boldest-spring.bsc.quiknode.pro/ec468d8a1ea2c310457b2e2f4eea257e62ba3b1e/"),
  }).extend(publicActions);
}

/**
 * Creates a public client configured for the Polygon
 *
 * @returns A public client instance connected to Polygon
 */
export function createClientPolygon(): ConnectedClient<
    Transport,
    typeof polygon,
    undefined
> {
  return createPublicClient({
    chain: polygon,
    transport: http(),
  }).extend(publicActions);
}

/**
 * Creates a public client configured for the Sei
 *
 * @returns A public client instance connected to Sei
 */
export function createClientSei(): ConnectedClient<
    Transport,
    typeof sei,
    undefined
> {
  return createPublicClient({
    chain: sei,
    transport: http(),
  }).extend(publicActions);
}

/**
 * Creates a public client configured for the X Layer
 *
 * @returns A public client instance connected to X Layer
 */
export function createClientXLayer(): ConnectedClient<
    Transport,
    typeof xlayer,
    undefined
> {
  return createPublicClient({
    chain: xlayer,
    transport: http(),
  }).extend(publicActions);
}


/**
 * Creates a wallet client configured for the Base with a private key
 *
 * @param privateKey - The private key to use for signing transactions
 * @returns A wallet client instance connected to Base with the provided private key
 */
export function createSignerBase(
    privateKey: Hex
): SignerWallet<typeof base> {
  return createWalletClient({
    chain: base,
    transport: http(),
    account: privateKeyToAccount(privateKey),
  }).extend(publicActions);
}

/**
 * Creates a wallet client configured for the Base with a private key
 *
 * @param privateKey - The private key to use for signing transactions
 * @returns A wallet client instance connected to Base with the provided private key
 */
export function createSignerSepolia(
    privateKey: Hex
): SignerWallet<typeof baseSepolia> {
  return createWalletClient({
    chain: baseSepolia,
    transport: http(),
    account: privateKeyToAccount(privateKey),
  }).extend(publicActions);
}

/**
 * Creates a wallet client configured for the Avalanche with a private key
 *
 * @param privateKey - The private key to use for signing transactions
 * @returns A wallet client instance connected to Avalanche with the provided private key
 */
export function createSignerAvalanche(
    privateKey: Hex
): SignerWallet<typeof avalanche> {
  return createWalletClient({
    chain: avalanche,
    transport: http(),
    account: privateKeyToAccount(privateKey),
  }).extend(publicActions);
}

/**
 * Creates a wallet client configured for the Avalanche with a private key
 *
 * @param privateKey - The private key to use for signing transactions
 * @returns A wallet client instance connected to Avalanche Fuji with the provided private key
 */
export function createSignerAvalancheFuji(
    privateKey: Hex
): SignerWallet<typeof avalancheFuji> {
  return createWalletClient({
    chain: avalancheFuji,
    transport: http(),
    account: privateKeyToAccount(privateKey),
  }).extend(publicActions);
}

/**
 * Creates a wallet client configured for the Iotex with a private key
 *
 * @param privateKey - The private key to use for signing transactions
 * @returns A wallet client instance connected to Iotex with the provided private key
 */
export function createSignerIotex(
    privateKey: Hex
): SignerWallet<typeof iotex> {
  return createWalletClient({
    chain: iotex,
    transport: http(),
    account: privateKeyToAccount(privateKey),
  }).extend(publicActions);
}

/**
 * Creates a wallet client configured for the BSC mainnet with a private key
 *
 * @param privateKey - The private key to use for signing transactions
 * @returns A wallet client instance connected to BSC with the provided private key
 */
export function createSignerBsc(privateKey: Hex): SignerWallet<typeof bsc> {
  return createWalletClient({
    chain: bsc,
    transport: http("https://few-boldest-spring.bsc.quiknode.pro/ec468d8a1ea2c310457b2e2f4eea257e62ba3b1e/"),
    account: privateKeyToAccount(privateKey),
  }).extend(publicActions);
}

/**
 * Creates a wallet client configured for the X Layer with a private key
 *
 * @param privateKey - The private key to use for signing transactions
 * @returns A wallet client instance connected to X Layer with the provided private key
 */
export function createSignerXLayer(
    privateKey: Hex
): SignerWallet<typeof xlayer> {
  return createWalletClient({
    chain: xlayer,
    transport: http(),
    account: privateKeyToAccount(privateKey),
  }).extend(publicActions);
}

/**
 * Checks if a wallet is a signer wallet
 *
 * @param wallet - The wallet to check
 * @returns True if the wallet is a signer wallet, false otherwise
 */
export function isSignerWallet<
    TChain extends Chain = Chain,
    TTransport extends Transport = Transport,
    TAccount extends Account = Account
>(
    wallet: SignerWallet<TChain, TTransport, TAccount> | Account
): wallet is SignerWallet<TChain, TTransport, TAccount> {
  return "chain" in wallet && "transport" in wallet;
}

/**
 * Checks if a wallet is an account
 *
 * @param wallet - The wallet to check
 * @returns True if the wallet is an account, false otherwise
 */
export function isAccount(wallet: SignerWallet | Account): wallet is Account {
  return "address" in wallet && "type" in wallet;
}

export type Wallet = SignerWallet | LocalAccount;
