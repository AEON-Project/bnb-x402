import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { type WalletClient, type PublicActions, publicActions } from "viem";
import { connect, disconnect } from "wagmi/actions";
import {
  injected,
  metaMask,
  walletConnect,
} from "wagmi/connectors";
import { getWalletClient } from "@wagmi/core";
import { config } from "../config/wagmi";
import { getChainId } from "../components/EvmPaymentHandler";
import { getChainConfig, handleChainSwitch } from "../utils/chainUtils";

// Export the WalletType for use in other components
export type WalletType =
  | "metamask"
  | "phantom"
  // | "coinbase"
  // | "rabby"
  // | "trust"
  | "walletconnect";

interface EvmWalletContextType {
  walletClient: (WalletClient & PublicActions) | null;
  connectedAddress: string;
  statusMessage: string;
  setStatusMessage: (message: string) => void;
  connectWallet: (walletType: WalletType, networkId?: string) => Promise<void>;
  disconnectWallet: () => Promise<void>;
}

// Create context with default values
const EvmWalletContext = createContext<EvmWalletContextType>({
  walletClient: null,
  connectedAddress: "",
  statusMessage: "",
  setStatusMessage: () => {},
  connectWallet: async () => {},
  disconnectWallet: async () => {},
});

// Hook to use the EVM wallet context
export const useEvmWallet = () => useContext(EvmWalletContext);

// Provider component for the EVM wallet context
export function EvmWalletProvider({ children }: { children: ReactNode }) {
  const [walletClient, setWalletClient] = useState<
    (WalletClient & PublicActions) | null
  >(null);
  const [connectedAddress, setConnectedAddress] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const connectWallet = useCallback(async (walletType: WalletType, networkId = "bsc") => {
    const { targetChain, networkName } = getChainConfig(networkId);
    try {
      setStatusMessage("Connecting wallet...");

      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error(
          "No Ethereum wallet detected. Please install MetaMask or another wallet extension."
        );
      }

      // Pick connector
      let connector;
      if (walletType === "metamask") {
        connector = metaMask();
      } else if(walletType === "phantom") {
        connector = injected({ shimDisconnect: true, target: "phantom" });
      // } else if (walletType === "coinbase") {
      //   connector = coinbaseWallet();
      // } else if (walletType === "rabby") {
      //   connector = injected({ shimDisconnect: true, target: "rabby" });
      // } else if (walletType === "trust" || walletType === "walletconnect") {
      } else if (walletType === "walletconnect") {
        const existingWC = window.ethereum?.isWalletConnect || 
                            localStorage.getItem('walletconnect') ||
                            document.querySelector('[data-testid*="walletconnect"]');

       
        if (typeof window !== "undefined" && window.indexedDB) {
          window.indexedDB.deleteDatabase("WALLET_CONNECT_V2_INDEXED_DB");
        }
        
        if (existingWC) {
          connector = injected({ shimDisconnect: true });
        }
        
        connector = walletConnect({
          projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "",
        });
      } else {
        connector = injected({ shimDisconnect: true });
      }

      const selectedChainId = Number(getChainId(networkId));

      console.log("[DEBUG] Connecting wallet", config);

      // Connect directly with the target chain for WalletConnect to avoid session conflicts
      const result = await connect(config, { 
        connector, 
        chainId: walletType === "walletconnect" ? selectedChainId : undefined 
      });

      console.log("[DEBUG] Connected wallet", {
        result,
      });

      if (!result.accounts?.[0]) {
        throw new Error("Please select an account in your wallet");
      }

      // For non-WalletConnect wallets, check if we need to switch chains
      if (walletType !== "walletconnect") {
        try {
          const baseInitialClient = await getWalletClient(config, {
            account: result.accounts[0],
          });

          if (baseInitialClient) {
            const initialClient = baseInitialClient.extend(publicActions) as unknown as WalletClient & PublicActions;
            const currentChainId = await initialClient.getChainId();

            // If not on correct chain, we need to switch
            if (currentChainId !== selectedChainId) {
              setStatusMessage(`Please switch to ${networkId.toUpperCase()} network in your wallet...`);

              try {
                // Request chain switch
                await handleChainSwitch({
                  initialClient,
                  targetChain,
                  networkName,
                  config,
                  account: result.accounts[0],
                  connector,
                  result: result,
                });
                console.log(`Chain switched successfully to ${networkId.toUpperCase()}`);
              } catch (switchError) {
                console.error("Failed to switch chain:", switchError);
                throw new Error(
                  `Please manually switch to ${networkId.toUpperCase()} in your wallet and try again.`
                );
              }
            }
          }
        } catch (checkError) {
          console.error("Error checking/switching chain:", checkError);
          throw new Error(`Please switch to ${networkId.toUpperCase()} network in your wallet...`);
        }
      }

      const baseClient = await getWalletClient(config, {
        account: result.accounts[0],
        chainId: selectedChainId,
      });

      if (!baseClient) {
        throw new Error("Failed to get wallet client");
      }

      // Extend with read-only public actions.
      // TS structurally mismatches the two `call` overloads, so we cast via `unknown`.
      const client = baseClient.extend(
        publicActions
      ) as unknown as WalletClient & PublicActions;

      const [address] = await client.getAddresses();
      if (!address) {
        throw new Error("Cannot access wallet account");
      }

      const chainId = await client.getChainId();
      if (chainId !== selectedChainId) {
        throw new Error(`Please switch to ${networkId.toUpperCase()} network`);
      }

      setWalletClient(client);
      setConnectedAddress(address);
      setStatusMessage("Wallet connected!");
    } catch (error) {
      console.error("EvmWalletContext - Connection error:", error);
      let message = "Failed to connect wallet";

      if (error instanceof Error) {
        if (error.message.includes("Unsupported chain")) {
          message =
            `This wallet doesn't support ${networkId.toUpperCase()}. Please use MetaMask or another ${walletType.toUpperCase()}-compatible wallet.`;
        } else if (error.message.includes("User rejected")) {
          message = "Connection rejected. Please try again.";
        } else if (error.message.includes("already pending")) {
          message = "Connection already pending. Check your wallet.";
        } else if (error.message.includes("No Ethereum provider")) {
          message =
            "No Ethereum provider found. Please install a wallet extension.";
        } else if (error.message.includes("chain of the connector") || error.message.includes("chain mismatch")) {
          message = `Please switch to ${networkId.toUpperCase()} in your wallet and try again.`;
        }
      }
      setStatusMessage(message);
      throw new Error(message);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      // Try to disconnect using wagmi, but don't wait for it to complete
      // as it might fail if the wallet doesn't support disconnection
      disconnect(config).catch((err) => {
        console.warn("Disconnect from wagmi failed:", err);
      });

      // Always clear the local state regardless of wagmi disconnect result
      setWalletClient(null);
      setConnectedAddress("");
      setStatusMessage("Wallet disconnected");

      // For MetaMask and some other wallets, we need to manually clear localStorage
      // to ensure the wallet is fully disconnected
      if (typeof window !== "undefined") {
        // Clear any wallet-related localStorage items
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes("wagmi") || key.includes("wallet"))) {
            keysToRemove.push(key);
          }
        }

        // Remove the keys in a separate loop to avoid issues with changing localStorage during iteration
        keysToRemove.forEach((key) => {
          localStorage.removeItem(key);
        });
      }
    } catch (error) {
      console.error("EvmWalletContext - Disconnect error:", error);
      // Even if there's an error, still clear the local state
      setWalletClient(null);
      setConnectedAddress("");
      setStatusMessage("Wallet disconnected (with errors)");
    }
  }, []);

  // Create the context value
  const contextValue = {
    walletClient,
    connectedAddress,
    statusMessage,
    setStatusMessage,
    connectWallet,
    disconnectWallet,
  };

  return (
    <EvmWalletContext.Provider value={contextValue}>
      {children}
    </EvmWalletContext.Provider>
  );
}
