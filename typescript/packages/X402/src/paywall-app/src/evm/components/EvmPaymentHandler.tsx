import { useCallback, useEffect, useRef, useState } from "react";
import { createPaymentHeader, x402Version } from "@aeon-ai-pay/x402";
import { useEvmWallet, WalletType } from "@/evm/context/EvmWalletContext";
import PaymentButtonUI from "../../components/PaymentButton";
import type { PaymentButtonProps } from "@/types/payment";
import EvmWalletSelector from "./EvmWalletSelector";
import { useTheme } from "@/components/ThemeProvider";

/**
 * EVM-specific payment handler
 * Uses the EvmWalletContext for wallet integration
 */
export default function EvmPaymentHandler({
  amount,
  paymentRequirements,
  onSuccess,
  onError,
  paymentStatus,
  setPaymentStatus,
  className = "",
  networkId = "bsc",
}: PaymentButtonProps) {
  // State for the payment flow
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastNetworkId, setLastNetworkId] = useState(networkId);
  const { isDarkMode } = useTheme();

  // Get EVM wallet context
  const { walletClient, connectedAddress, connectWallet, disconnectWallet } = useEvmWallet();

  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);

  // Simplified ref to track payment attempts
  const paymentAttemptRef = useRef({
    attemptInProgress: false,
  });

  useEffect(() => {
    if (lastNetworkId !== networkId && connectedAddress) {
      disconnectWallet();
      setSelectedWallet(null);
      setLastNetworkId(networkId);
      // setSelectedNetwork?.({
      //   id: "",
      //   name: "",
      //   icon: "",
      //   coins: [],
      // });
    } else if (lastNetworkId !== networkId) {
      setLastNetworkId(networkId);
    }
  }, [networkId, lastNetworkId, connectedAddress, disconnectWallet]);

  // Handle button click for unified experience
  const handleButtonClick = async () => {
    console.log("[DEBUG] Button clicked", {
      hasWallet: !!walletClient,
      connectedAddress: connectedAddress?.slice(0, 8),
      currentStatus: paymentStatus,
    });

    // If not connected, connect first
    if (!connectedAddress) {
      await handleConnectWallet();
      return;
    }

    // If already connected, process payment
    setPaymentStatus("approving");
  };

  // Connect wallet handler
  const handleConnectWallet = async (walletId: WalletType = selectedWallet ?? "metamask") => {
    setErrorMessage(null);
    setPaymentStatus("connecting");

    try {

      // Default to MetaMask
      await connectWallet(walletId, networkId);

      // If we get here, connection was successful
      setPaymentStatus("approving"); // Go directly to payment approval
    } catch (err) {
      console.error("[DEBUG] EVM wallet connection error:", err);
      setPaymentStatus("error");
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMessage(errMsg);
      onError?.(err instanceof Error ? err : new Error(errMsg));
    }
  };

  const handleWalletSelect = (walletId: WalletType) => {
    setPaymentStatus("idle");
    setSelectedWallet(walletId);
  };

  // Update payment status callbacks
  const handlePaymentSuccess = useCallback(
    (paymentHeader: string) => {
      console.log("[DEBUG] Payment sent and signed");
      console.log("[DEBUG] Payment header:", paymentHeader);

      // Call onSuccess immediately - the parent will handle facilitator verification
      if (onSuccess) onSuccess(paymentHeader);
    },
    [onSuccess]
  );

  const handlePaymentError = useCallback(
    (err: Error) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log("[DEBUG] Payment error", { errMsg });

      // Check if this is a user cancellation
      const isUserCancellation =
        errMsg.includes("cancelled by user") ||
        errMsg.includes("User rejected");

      if (isUserCancellation) {
        console.log("[DEBUG] User cancelled payment");
        // Set status to error so the error message is displayed
        setPaymentStatus("error");
        setErrorMessage("Transaction cancelled by user");
      } else {
        setPaymentStatus("error");
        setErrorMessage(errMsg);
      }

      // Always reset payment tracking
      paymentAttemptRef.current.attemptInProgress = false;

      if (onError) onError(err instanceof Error ? err : new Error(errMsg));
    },
    [onError, setPaymentStatus]
  );

  const handlePaymentProcessing = useCallback(() => {
    console.log("[DEBUG] Payment processing started");
    setPaymentStatus("processing");
    // Mark payment as in progress
    paymentAttemptRef.current.attemptInProgress = true;
  }, [setPaymentStatus]);

  // Determine if the button is disabled
  const isDisabled = ["connecting", "processing", "success"].includes(
    paymentStatus
  ) || !selectedWallet;

  return (
    <div className="flex flex-col w-full space-y-4">
       <EvmWalletSelector
        chainId={networkId}
        onWalletSelect={handleWalletSelect}
        selectedWallet={selectedWallet}
        disabled={["approving", "connecting", "processing"].includes(paymentStatus)}
        isDarkMode={isDarkMode}
      />
      {/* Payment processor component that watches for wallet connection and status */}
      {connectedAddress &&
        walletClient &&
        paymentStatus === "approving" &&
        !paymentAttemptRef.current.attemptInProgress && (
          <EvmPaymentProcessor
            walletClient={walletClient}
            connectedAddress={connectedAddress}
            paymentRequirements={paymentRequirements}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onProcessing={handlePaymentProcessing}
            paymentAttemptRef={paymentAttemptRef}
            networkId={networkId}
          />
        )}

      <PaymentButtonUI
        paymentStatus={paymentStatus}
        amount={amount}
        errorMessage={errorMessage}
        onClick={handleButtonClick}
        disabled={isDisabled}
        className={className}
      />
    </div>
  );
}

/**
 * Get the chain ID for a given network
 */
export const getChainId = (network: string) => {
  switch (network) {
    case "bsc":
      return "56";
    case "base":
      return "8453";
    case "polygon":
      return "137";
    case "sei":
      return "1329";
    default:
      return "56";
  }
};

export const getNetworkName = (chainId: string) => {
  switch (chainId) {
    case "56":
      return "bsc";
    case "8453":
      return "base";
    case "137":
      return "polygon";
    case "1329":
      return "sei";
    default:
      return "bsc";
  }
};

// Payment processor component for EVM wallets
function EvmPaymentProcessor({
  walletClient,
  connectedAddress,
  paymentRequirements,
  onSuccess,
  onError,
  onProcessing,
  paymentAttemptRef,
  networkId = "bsc",
}: {
  walletClient: any;
  connectedAddress: string;
  paymentRequirements?: any;
  onSuccess: (paymentHeader: string) => void;
  onError: (error: Error) => void;
  onProcessing: () => void;
  paymentAttemptRef: React.RefObject<{ attemptInProgress: boolean }>;
  networkId: string;
}) {
  // Debug - Track if this component has already attempted a payment
  const hasAttemptedRef = useRef(false);

  // Process payment on mount
  useEffect(() => {
    console.log("[DEBUG] EvmPaymentProcessor mounted", {
      connectedAddress: connectedAddress?.slice(0, 8),
      hasAttempted: hasAttemptedRef.current,
      attemptInProgress: paymentAttemptRef.current?.attemptInProgress,
    });

    // Guard against multiple attempts
    if (
      hasAttemptedRef.current ||
      (paymentAttemptRef.current && paymentAttemptRef.current.attemptInProgress)
    ) {
      console.log("[DEBUG] Payment already in progress or attempted, skipping");
      return;
    }

    // Mark as attempted at the component level
    hasAttemptedRef.current = true;

    // Call processing callback - this will update the parent's ref
    onProcessing();

    const processPayment = async () => {
      try {
        if (!walletClient) {
          throw new Error("EVM wallet client not available");
        }

        const currentChainId = await walletClient.getChainId();
        const expectedChainId = parseInt(getChainId(networkId));

        if (currentChainId !== expectedChainId) {
          throw new Error(
            `Wallet is on wrong network. Please switch to ${networkId.toUpperCase()} network and try again.`
          );
        }

        // Set the appropriate namespace and networkId for EVM
        const finalPaymentRequirements = {
          ...paymentRequirements,
          namespace: "evm",
          networkId: getChainId(networkId),
          scheme: "exact",
          resource: paymentRequirements.resource || "payment", // Use provided resource or default
        };

        console.log("[DEBUG] Final EVM payment details:", {
          namespace: finalPaymentRequirements.namespace,
          networkId: finalPaymentRequirements.networkId,
          scheme: finalPaymentRequirements.scheme,
          tokenAddress: finalPaymentRequirements.tokenAddress,
          amountRequired: finalPaymentRequirements.amountRequired,
        });

        const paymentClients = {
          evmClient: walletClient,
        };

        console.log("[DEBUG] Calling createPayment for EVM");

        // Create payment using the h402 payment library
        const paymentHeader = await createPaymentHeader(
          paymentClients,
          x402Version,
          finalPaymentRequirements
        );
        console.log("[DEBUG] createPayment succeeded");
        onSuccess(paymentHeader);
      } catch (err) {
        console.error("[DEBUG] Payment error:", err);

        // Check if this is a user rejection
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.log("[DEBUG] Error message:", errorMessage);

        const isUserRejection = errorMessage.includes(
          "User rejected the request"
        );
        console.log("[DEBUG] Is user rejection:", isUserRejection);

        if (isUserRejection) {
          console.log(
            "[DEBUG] Transaction was rejected by user, handling gracefully"
          );
          onError(new Error("Transaction cancelled by user"));
        } else {
          onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    processPayment();
  }, [
    connectedAddress,
    walletClient,
    paymentRequirements,
    onSuccess,
    onError,
    onProcessing,
    paymentAttemptRef,
  ]);

  // This component doesn't render anything
  return null;
}
