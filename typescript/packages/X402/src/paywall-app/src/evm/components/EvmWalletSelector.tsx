import { useState, useEffect } from "react";
import { WalletType } from "../context/EvmWalletContext";
import { getWalletIcon } from "@/utils/paymentUtils";

// Define the wallet interface
interface Wallet {
  id: WalletType;
  name: string;
  icon: string;
  type: "evm";
}

// Define chain support mapping type
type ChainSupport = {
  [K in WalletType]?: string[];
};

/**
 * EVM Wallet Selector Component
 * Dynamically detects available EVM wallets instead of hardcoding them
 */
export default function EvmWalletSelector({
  chainId,
  onWalletSelect,
  selectedWallet,
  disabled = false,
  isDarkMode
}: {
  chainId: string;
  onWalletSelect: (walletId: WalletType) => void;
  selectedWallet: WalletType | null;
  disabled: boolean;
  isDarkMode?: boolean;
}) {
  const [availableWallets, setAvailableWallets] = useState<Wallet[]>([]);

  useEffect(() => {
    const detectWallets = () => {
      const wallets: Wallet[] = [];

      if (window.ethereum?.isMetaMask && !window.ethereum?.isPhantom) {
        wallets.push({
          id: "metamask" as WalletType,
          name: "MetaMask",
          icon: getWalletIcon("metamask"),
          type: "evm",
        });
      }

      if (window.phantom && chainId !== "solana") {
        wallets.push({
          id: "phantom" as WalletType,
          name: "Phantom",
          icon: getWalletIcon("phantom"),
          type: "evm",
        });
      }

      wallets.push({
        id: "walletconnect" as WalletType,
        name: "WalletConnect",
        icon: getWalletIcon("walletconnect"),
        type: "evm",
      });

      const supportedWallets = wallets.filter((wallet) => {
        const chainSupport: ChainSupport = {
          metamask: ["bsc", "base", "polygon", "sei"],
          phantom: ["base", "polygon"],
          walletconnect: ["bsc", "base", "polygon", "sei"],
        };

        const isSupported = chainSupport[wallet.id]?.includes(chainId) || false;
        return isSupported;
      });

      setAvailableWallets(supportedWallets);
    };

    if (typeof window !== "undefined") {
      detectWallets();
    }
  }, [chainId]);

  const handleWalletSelect = (walletId: WalletType) => {
    if (!disabled) {
      onWalletSelect(walletId);
    }
  };

  if (availableWallets.length === 0) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">
          No supported EVM wallets found for {chainId.toUpperCase()} chain.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Select EVM wallet
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {availableWallets.map((wallet) => (
          <div
            key={wallet.id}
            className={`
              relative flex border items-center p-3 rounded-lg cursor-pointer transition-all duration-200
              ${
                selectedWallet === wallet.id
                  ? `border-blue-500 ring-2 ring-blue-500 ${isDarkMode ?  'bg-gray-900' : 'bg-blue-50'}`
                  : `${isDarkMode ? '!border-gray-600 hover:bg-gray-700' : '!border-gray-200 hover:bg-gray-50'}`
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            `}
            onClick={() => handleWalletSelect(wallet.id)}
          >
            <input
              type="radio"
              id={wallet.id}
              name="evm-wallet-selection"
              value={wallet.id || ""}
              checked={selectedWallet === wallet.id}
              onChange={() => handleWalletSelect(wallet.id)}
              disabled={disabled}
              className="sr-only"
            />

            <div className="w-6 h-6 mr-3 flex-shrink-0">
              <img
                src={wallet.icon}
                alt={wallet.name}
                className="w-6 h-6 object-contain"
              />
            </div>

            <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate`}>
              {wallet.name}
            </div>

            {selectedWallet === wallet.id && (
              <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
