import { Suspense, useEffect, useState } from "react";
import LoadingState from "@/components/LoadingState";
import Paywall from "@/components/Paywall";
import { useTheme } from "@/components/ThemeProvider";
import { imageGenerationPaymentRequirements } from "@/config/paymentRequirements";
import type { EnrichedPaymentRequirements } from "../../types";
import { EvmWalletProvider } from "./evm/context/EvmWalletContext";

function App() {
  const [paymentRequirements, setPaymentRequirements] = useState<
    EnrichedPaymentRequirements[]
  >([]);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    // Set favicon
    const setFavicon = (url: string) => {
      // Remove existing favicon links
      const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
      existingLinks.forEach(link => link.remove());

      // Add new favicon links
      const iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      iconLink.type = 'image/png';
      iconLink.href = url;
      document.head.appendChild(iconLink);

      const shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      shortcutLink.type = 'image/png';
      shortcutLink.href = url;
      document.head.appendChild(shortcutLink);
    };

    setFavicon('https://card-pulic-new.oss-cn-hongkong.aliyuncs.com/logo/20251031-153633.png');

    // Use server-injected payment requirements, fallback to local config if needed
    const requirements = window.x402?.paymentRequirements ?? (imageGenerationPaymentRequirements as EnrichedPaymentRequirements[]);
    console.log("[DEBUG] Payment requirements loaded:", requirements);
    console.log("[DEBUG] Number of payment options:", requirements.length);
    requirements.forEach((req, index) => {
      console.log(`[DEBUG] Payment option ${index}:`, {
        tokenSymbol: req.tokenSymbol,
        tokenAddress: req.tokenAddress,
        networkId: req.networkId,
        namespace: req.namespace
      });
    });
    setPaymentRequirements(requirements);
  }, []);

  if (!paymentRequirements || paymentRequirements.length === 0) {
    return <LoadingState message="Loading Payment Options" />;
  }

  return (
    <EvmWalletProvider>
        <div
          className={`w-dvw h-dvh text-black dark:text-white font-geist-sans antialiased ${
            isDarkMode ? "bg-gray-900" : "bg-white"
          }`}
        >
          <header className="flex justify-between items-center -mb-20 mr-2 px-4 pt-4">
            <div className="text-2xl font-bold text-white"></div>
            <div className="flex gap-4 items-center">
              <a
                href="https://github.com/AEON-Project/x402"
                className="bg-[#2E74FF] hover:bg-[#2361DB] dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-full font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </a>
            </div>
          </header>

          <main className="min-h-screen flex items-center justify-center">
            <div className="w-full max-w-[800px] mx-auto p-8">
              <h1 className="text-2xl font-semibold mb-2">
                Aeon X402 Payment Example
              </h1>

              <p className="text-gray-500 dark:text-gray-400 text-base mb-8">
                Connect your wallet and pay to access the resource
              </p>

              <Suspense fallback={<LoadingState />}>
                <Paywall paymentRequirements={paymentRequirements} />
              </Suspense>
            </div>
          </main>
        </div>
    </EvmWalletProvider>
  );
}

export default App;
